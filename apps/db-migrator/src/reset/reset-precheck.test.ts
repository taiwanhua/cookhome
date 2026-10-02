import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Db, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * reset 的零刪除預檢(對真 MongoDB):registry 之後種不回去時,`data` 與 `full` 都要在**刪除之前**拒絕。
 * 以夾具 registry 驗(`--registry=`):登記了版本化定義(這個入口還沒有發布處理)、組裝時撞 key。
 */

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const TSX_CLI = path.join(
  PACKAGE_ROOT,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const SEED_ENTRY = path.join(PACKAGE_ROOT, "src", "seed", "run.ts");
const RESET_ENTRY = path.join(PACKAGE_ROOT, "src", "reset", "run.ts");

/** 測試用 root 初始帳號;密碼為測試假值。 */
const ROOT_ADMIN_ENV = {
  ROOT_ADMIN_ACCOUNT: "root-admin",
  ROOT_ADMIN_EMAIL: "root-admin@example.com",
  ROOT_ADMIN_PASSWORD: ["initial", "secret", "123"].join("-"),
};

let memoryServer: MongoMemoryServer | undefined;
let baseUri: string;
const usedDatabaseUris: string[] = [];

/** 資料庫名以 `-dev` 結尾,安全閥才放行(`reset-safety.ts`)。 */
function createTestDatabaseUri(suffix: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/db-migrator-reset-precheck-${String(process.pid)}-${suffix}-dev`;
  usedDatabaseUris.push(uri.toString());
  return uri.toString();
}

function fixtureRegistryPath(fixtureName: string): string {
  return path.join(
    PACKAGE_ROOT,
    "test",
    "fixtures",
    fixtureName,
    "registry.ts",
  );
}

function commandEnv(databaseUri: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...ROOT_ADMIN_ENV,
    MONGODB_URI: databaseUri,
    RESET_ALLOW_ENV: "dev",
  };
}

function runSeedCommand(databaseUri: string) {
  return spawnSync(process.execPath, [TSX_CLI, SEED_ENTRY], {
    cwd: PACKAGE_ROOT,
    env: commandEnv(databaseUri),
    encoding: "utf8",
  });
}

function runResetCommand(
  databaseUri: string,
  mode: "data" | "full",
  fixtureName: string,
) {
  const databaseName = new URL(databaseUri).pathname.replace(/^\//, "");
  return spawnSync(
    process.execPath,
    [
      TSX_CLI,
      RESET_ENTRY,
      `--mode=${mode}`,
      `--confirm=${databaseName}`,
      `--registry=${fixtureRegistryPath(fixtureName)}`,
    ],
    {
      cwd: PACKAGE_ROOT,
      env: commandEnv(databaseUri),
      encoding: "utf8",
    },
  );
}

async function withDatabase<T>(
  databaseUri: string,
  work: (database: Db) => Promise<T>,
): Promise<T> {
  const client = await MongoClient.connect(databaseUri);
  try {
    return await work(client.db());
  } finally {
    await client.close();
  }
}

/** 每個 collection 的全部文件(依 _id 排序):前後完全相同 = 一筆都沒刪、沒改。 */
async function dumpDatabase(
  databaseUri: string,
): Promise<Record<string, unknown[]>> {
  return withDatabase(databaseUri, async (database) => {
    const collections = await database
      .listCollections({}, { nameOnly: true })
      .toArray();
    const names = collections
      .map(({ name }) => name)
      .toSorted((left, right) => left.localeCompare(right, "zh-Hant"));
    const dump: Record<string, unknown[]> = {};
    for (const name of names) {
      dump[name] = await database
        .collection(name)
        .find()
        .sort({ _id: 1 })
        .toArray();
    }
    return dump;
  });
}

/** 正式種子 + 一些人建的資料(租戶組織、業務表、既有的表單版本),reset 成功的話這些會被刪掉。 */
async function prepareDatabase(databaseUri: string): Promise<void> {
  expect(runSeedCommand(databaseUri).status).toBe(0);
  await withDatabase(databaseUri, async (database) => {
    const now = new Date();
    await database.collection("orgs").insertOne({
      name: "人建的租戶",
      enabled: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    await database.collection("customers").insertOne({ name: "客戶甲" });
    await database
      .collection("form_versions")
      .insertOne({ formKey: "ui_built_form", version: 1, fields: [] });
    await database
      .collection("workflow_versions")
      .insertOne({ workflowKey: "ui_built_flow", version: 1, steps: [] });
  });
}

beforeAll(async () => {
  if (process.env.MONGODB_URI) {
    baseUri = process.env.MONGODB_URI;
  } else {
    memoryServer = await MongoMemoryServer.create();
    baseUri = memoryServer.getUri();
  }
}, 600_000);

afterAll(async () => {
  for (const databaseUri of usedDatabaseUris) {
    await withDatabase(databaseUri, async (database) => {
      await database.dropDatabase();
    });
  }
  await memoryServer?.stop();
}, 60_000);

describe("reset 的零刪除預檢", () => {
  it.each(["data", "full"] as const)(
    "%s:registry 登記了版本化定義而入口沒有發布處理 → 刪除之前就拒絕,資料庫原封不動",
    async (mode) => {
      const databaseUri = createTestDatabaseUri(`definition-${mode}`);
      await prepareDatabase(databaseUri);
      const before = await dumpDatabase(databaseUri);

      const result = runResetCommand(databaseUri, mode, "seeds-definition");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("登記了 2 份版本化定義");
      expect(result.stderr).toContain("form-definition:project_request@r1");
      expect(result.stdout).toBe("");

      const after = await dumpDatabase(databaseUri);
      expect(Object.keys(after)).toEqual(Object.keys(before));
      expect(after).toEqual(before);
      // 人建的資料與既有的版本資料都還在
      expect(after.customers).toHaveLength(1);
      expect(after.form_versions).toHaveLength(1);
      expect(after.workflow_versions).toHaveLength(1);
    },
    180_000,
  );

  it.each(["data", "full"] as const)(
    "%s:registry 組裝不合法(專案重宣告底座的種子)→ 刪除之前就拒絕,資料庫原封不動",
    async (mode) => {
      const databaseUri = createTestDatabaseUri(`collision-${mode}`);
      await prepareDatabase(databaseUri);
      const before = await dumpDatabase(databaseUri);

      const result = runResetCommand(databaseUri, mode, "seeds-collision");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("orgs.root 重複宣告(base 與 project)");
      expect(result.stdout).toBe("");
      expect(await dumpDatabase(databaseUri)).toEqual(before);
    },
    180_000,
  );

  it("對照組:同一個資料庫用合法的夾具 registry(底座 + 專案來源,沒有定義)做 data reset 會照常刪人建資料並補種", async () => {
    const databaseUri = createTestDatabaseUri("valid-data");
    await prepareDatabase(databaseUri);

    const result = runResetCommand(databaseUri, "data", "seeds-project");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const after = await dumpDatabase(databaseUri);
    expect(after.customers).toEqual([]);
    expect(after.orgs).toHaveLength(1);
    // 專案來源的模組由同一次執行的 seed 補上
    expect(after.modules).toHaveLength(38 + 8);
  }, 180_000);
});
