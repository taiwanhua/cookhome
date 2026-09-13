import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const TSX_CLI = path.join(PACKAGE_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SEED_ENTRY = path.join(PACKAGE_ROOT, "src", "seed", "run.ts");

/** 測試用 root 初始帳號(正式環境自 Secret Manager 注入,ADR-0002);密碼為測試假值。 */
const ROOT_ADMIN_ENV = {
  ROOT_ADMIN_ACCOUNT: "root-admin",
  ROOT_ADMIN_EMAIL: "root-admin@example.com",
  ROOT_ADMIN_PASSWORD: ["initial", "secret", "123"].join("-"),
};

/** 本地起 mongodb-memory-server;CI 沿用既有 MongoDB service container(MONGODB_URI)。 */
let memoryServer: MongoMemoryServer | undefined;
let baseUri: string;

function buildDatabaseUri(databaseName: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
}

/** 種子文件的觀察欄位(僅測試斷言用,不是 schema 正本)。 */
interface SeededDocument {
  key?: string;
  name?: string;
  isSystem?: boolean;
  enabled?: boolean;
  [field: string]: unknown;
}

interface RunSeedOptions {
  env?: Record<string, string | undefined>;
  registryPath?: string;
}

/** 以子行程執行 seed 指令(等同 `pnpm --filter db-migrator seed`)。 */
function runSeedCommand(databaseUri: string, options: RunSeedOptions = {}) {
  const args = [TSX_CLI, SEED_ENTRY];
  if (options.registryPath) {
    args.push(options.registryPath);
  }
  return spawnSync(process.execPath, args, {
    cwd: PACKAGE_ROOT,
    env: {
      ...process.env,
      ...ROOT_ADMIN_ENV,
      MONGODB_URI: databaseUri,
      ...options.env,
    },
    encoding: "utf8",
  });
}

async function withDatabase<T>(
  databaseUri: string,
  work: (database: ReturnType<MongoClient["db"]>) => Promise<T>,
): Promise<T> {
  const client = await MongoClient.connect(databaseUri);
  try {
    return await work(client.db());
  } finally {
    await client.close();
  }
}

const usedDatabaseUris: string[] = [];

function createTestDatabaseUri(suffix: string): string {
  const databaseUri = buildDatabaseUri(
    `db-migrator-seed-test-${String(process.pid)}-${suffix}`,
  );
  usedDatabaseUris.push(databaseUri);
  return databaseUri;
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

describe("seed 指令(對真 MongoDB)", () => {
  it("空資料庫執行後具備根組織與兩個種子角色(isSystem=true),並輸出摘要", async () => {
    const databaseUri = createTestDatabaseUri("fresh");

    const result = runSeedCommand(databaseUri);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const { orgs, roles } = await withDatabase(databaseUri, async (database) => ({
      orgs: await database.collection<SeededDocument>("orgs").find().toArray(),
      roles: await database
        .collection<SeededDocument>("roles")
        .find()
        .sort({ key: 1 })
        .toArray(),
    }));

    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({
      key: "root",
      name: "CookHome",
      parentId: null,
      ancestors: [],
      isSystem: true,
      enabled: true,
    });

    expect(roles.map((role) => role.key)).toEqual(["super-admin", "tenant-admin"]);
    for (const role of roles) {
      expect(role).toMatchObject({ isSystem: true, enabled: true });
      expect(typeof role.name).toBe("string");
    }

    // 摘要:新增 N / 更新 M / 未變 K(根組織 1 + 種子角色 2 至少 3 筆新增)
    expect(result.stdout).toMatch(/新增 \d+ \/ 更新 0 \/ 未變 0/);
  }, 120_000);
});
