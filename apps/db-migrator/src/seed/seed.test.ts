import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { verify as verifyArgon2 } from "@node-rs/argon2";
import { MongoClient, type ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const TSX_CLI = path.join(
  PACKAGE_ROOT,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
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

interface AccountDocument {
  account?: string;
  email?: string;
  name?: string;
  passwordHash?: string;
  enabled?: boolean;
  [field: string]: unknown;
}

interface RelationshipDocument {
  type?: string;
  firstId?: ObjectId;
  secondId?: ObjectId;
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

function fixtureRegistryPath(fixtureName: string): string {
  return path.join(
    PACKAGE_ROOT,
    "test",
    "fixtures",
    fixtureName,
    "registry.ts",
  );
}

/** 欄位選項的觀察欄位(正本:docs/modules/field-manager.md「種子內容」)。 */
interface FieldDocument {
  key?: string;
  categoryId?: ObjectId;
  orgId?: ObjectId | null;
  value?: string;
  label?: string;
  order?: number;
  enabled?: boolean;
  isSystem?: boolean;
  [field: string]: unknown;
}

/** 讀出全部種子文件(含 _id 與時間戳),供前後比對。 */
async function readSeededDocuments(databaseUri: string) {
  return withDatabase(databaseUri, async (database) => ({
    orgs: await database.collection<SeededDocument>("orgs").find().toArray(),
    roles: await database
      .collection<SeededDocument>("roles")
      .find()
      .sort({ key: 1 })
      .toArray(),
    fieldCategories: await database
      .collection<SeededDocument>("field_categories")
      .find()
      .sort({ key: 1 })
      .toArray(),
    fields: await database
      .collection<FieldDocument>("fields")
      .find()
      .sort({ key: 1 })
      .toArray(),
  }));
}

/** 帳號相關最終狀態:使用者、根組織、超級管理員角色、核心關聯。 */
async function readAccountState(databaseUri: string) {
  return withDatabase(databaseUri, async (database) => ({
    users: await database.collection<AccountDocument>("users").find().toArray(),
    rootOrg: await database
      .collection<SeededDocument>("orgs")
      .findOne({ key: "root" }),
    superAdminRole: await database
      .collection<SeededDocument>("roles")
      .findOne({ key: "super-admin" }),
    relationships: await database
      .collection<RelationshipDocument>("core_relationships")
      .find()
      .sort({ type: 1 })
      .toArray(),
  }));
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

    const { orgs, roles } = await readSeededDocuments(databaseUri);

    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({
      key: "root",
      name: "CookHome",
      parentId: null,
      ancestors: [],
      isSystem: true,
      enabled: true,
    });

    expect(roles.map((role) => role.key)).toEqual([
      "super-admin",
      "tenant-admin",
    ]);
    for (const role of roles) {
      expect(role).toMatchObject({ isSystem: true, enabled: true });
      expect(typeof role.name).toBe("string");
    }

    // 摘要:新增 N / 更新 M / 未變 K(根組織 1 + 種子角色 2 至少 3 筆新增)
    expect(result.stdout).toMatch(/新增 \d+ \/ 更新 0 \/ 未變 0/);
  }, 120_000);

  it("種子角色的擁有組織為根組織(org_role),重跑不重複建立", async () => {
    const databaseUri = createTestDatabaseUri("org-role");

    expect(runSeedCommand(databaseUri).status).toBe(0);
    expect(runSeedCommand(databaseUri).status).toBe(0);

    const { orgRoles, rootOrg, roles } = await withDatabase(
      databaseUri,
      async (database) => ({
        orgRoles: await database
          .collection<RelationshipDocument>("core_relationships")
          .find({ type: "org_role" })
          .toArray(),
        rootOrg: await database
          .collection<SeededDocument>("orgs")
          .findOne({ key: "root" }),
        roles: await database
          .collection<SeededDocument>("roles")
          .find()
          .toArray(),
      }),
    );

    expect(orgRoles).toHaveLength(2);
    expect(
      new Set(orgRoles.map((link) => link.secondId?.toHexString())),
    ).toEqual(new Set(roles.map((role) => role._id.toHexString())));
    for (const link of orgRoles) {
      expect(link.firstId?.toHexString()).toBe(rootOrg?._id.toHexString());
    }
  }, 120_000);

  it("重跑第二次 0 新增 0 更新(冪等),既有文件的 id 與時間戳不動", async () => {
    const databaseUri = createTestDatabaseUri("rerun");

    const firstRun = runSeedCommand(databaseUri);
    expect(firstRun.status).toBe(0);
    const firstSnapshot = await readSeededDocuments(databaseUri);

    const secondRun = runSeedCommand(databaseUri);
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toMatch(/新增 0 \/ 更新 0 \/ 未變 [1-9]\d*/);

    const secondSnapshot = await readSeededDocuments(databaseUri);
    expect(secondSnapshot).toEqual(firstSnapshot);
  }, 120_000);

  it("修改宣告檔後重跑:變更同步到資料庫、計數正確(以夾具 registry 驗證)", async () => {
    const databaseUri = createTestDatabaseUri("declaration-change");

    const firstRun = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-v1"),
    });
    expect(firstRun.stderr).toBe("");
    expect(firstRun.status).toBe(0);
    expect(firstRun.stdout).toContain("新增 2 / 更新 0 / 未變 0");

    const secondRun = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-v2"),
    });
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toContain("新增 1 / 更新 1 / 未變 1");

    const items = await withDatabase(databaseUri, (database) =>
      database
        .collection<SeededDocument>("seed_fixture_items")
        .find()
        .sort({ key: 1 })
        .toArray(),
    );
    expect(items.map((item) => [item.key, item.name])).toEqual([
      ["alpha", "Alpha 2"],
      ["beta", "Beta"],
      ["gamma", "Gamma"],
    ]);
    for (const item of items) {
      expect(item.isSystem).toBe(true);
    }
  }, 120_000);
});

describe("欄位類別與全域選項種子(docs/modules/field-manager.md「種子內容」)", () => {
  it("空資料庫執行後具備兩個全域類別與七個全域選項(orgId=null、isSystem=true),選項以 categoryId 指向所屬類別", async () => {
    const databaseUri = createTestDatabaseUri("fields");

    const result = runSeedCommand(databaseUri);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const { fieldCategories, fields } = await readSeededDocuments(databaseUri);

    expect(
      fieldCategories.map((category) => [category.key, category.name]),
    ).toEqual([
      ["demo-category", "示範分類"],
      ["gender", "性別"],
    ]);
    for (const category of fieldCategories) {
      expect(category.isSystem).toBe(true);
    }

    const categoryIdOf = (key: string): string | undefined =>
      fieldCategories
        .find((category) => category.key === key)
        ?._id.toHexString();

    // 正本表格:類別 key → [value, label, order]
    const expectedOptions: Record<string, [string, string, number][]> = {
      gender: [
        ["male", "男", 1],
        ["female", "女", 2],
        ["other", "其他", 3],
        ["undisclosed", "不透露", 4],
      ],
      "demo-category": [
        ["staple", "主食", 1],
        ["side-dish", "小菜", 2],
        ["drink", "飲品", 3],
      ],
    };

    expect(fields).toHaveLength(7);
    for (const [categoryKey, options] of Object.entries(expectedOptions)) {
      const seeded = fields.filter(
        (field) =>
          field.categoryId?.toHexString() === categoryIdOf(categoryKey),
      );
      expect(seeded).toHaveLength(options.length);
      for (const [value, label, order] of options) {
        expect(seeded).toContainEqual(
          expect.objectContaining({ value, label, order }),
        );
      }
    }
    for (const field of fields) {
      expect(field).toMatchObject({
        orgId: null,
        isSystem: true,
        enabled: true,
      });
    }

    // 「甜點」是租戶自訂選項的示意,不是種子
    expect(fields.map((field) => field.label)).not.toContain("甜點");
  }, 120_000);
});

describe("種子文件之間的引用(seedRef → 該環境的 _id)", () => {
  it("引用改指向另一筆種子後重跑:同步為新目標的 _id、計為 1 筆更新(以夾具 registry 驗證)", async () => {
    const databaseUri = createTestDatabaseUri("ref-change");

    const firstRun = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-ref-v1"),
    });
    expect(firstRun.stderr).toBe("");
    expect(firstRun.status).toBe(0);
    expect(firstRun.stdout).toContain("新增 3 / 更新 0 / 未變 0");

    const secondRun = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-ref-v2"),
    });
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toContain("新增 0 / 更新 1 / 未變 2");

    const { groupB, member } = await withDatabase(
      databaseUri,
      async (database) => ({
        groupB: await database
          .collection<SeededDocument>("seed_fixture_groups")
          .findOne({ key: "b" }),
        member: await database
          .collection<{ groupId?: ObjectId; [field: string]: unknown }>(
            "seed_fixture_members",
          )
          .findOne({ key: "m" }),
      }),
    );
    expect(member?.groupId?.toHexString()).toBe(groupB?._id.toHexString());
  }, 120_000);

  it("引用到不存在的種子文件時以非零結束並指出缺哪一筆", () => {
    const databaseUri = createTestDatabaseUri("ref-missing");

    const result = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-ref-missing"),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("seed_fixture_groups.nowhere");
  }, 120_000);
});

describe("root 初始超級管理員帳號(ADR-0002)", () => {
  it("帳號不存在時建立:密碼 argon2id 雜湊、加入根組織(org_user)、綁定超級管理員(user_role)", async () => {
    const databaseUri = createTestDatabaseUri("root-admin");

    const result = runSeedCommand(databaseUri);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const { users, rootOrg, superAdminRole, relationships } =
      await readAccountState(databaseUri);

    expect(users).toHaveLength(1);
    const rootAdmin = users[0];
    expect(rootAdmin).toMatchObject({
      account: ROOT_ADMIN_ENV.ROOT_ADMIN_ACCOUNT,
      email: ROOT_ADMIN_ENV.ROOT_ADMIN_EMAIL,
      enabled: true,
    });
    expect(typeof rootAdmin?.name).toBe("string");
    expect(rootAdmin?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(rootAdmin?.passwordHash).not.toContain(
      ROOT_ADMIN_ENV.ROOT_ADMIN_PASSWORD,
    );
    await expect(
      verifyArgon2(
        rootAdmin?.passwordHash ?? "",
        ROOT_ADMIN_ENV.ROOT_ADMIN_PASSWORD,
      ),
    ).resolves.toBe(true);

    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: "org_user",
        firstId: rootOrg?._id,
        secondId: rootAdmin?._id,
      }),
    );
    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: "user_role",
        firstId: rootAdmin?._id,
        secondId: superAdminRole?._id,
      }),
    );
  }, 120_000);

  it("帳號已存在時完全不動:重跑(即使密碼環境變數改了)不重設密碼、不重複建立關聯", async () => {
    const databaseUri = createTestDatabaseUri("root-admin-rerun");

    const firstRun = runSeedCommand(databaseUri);
    expect(firstRun.status).toBe(0);
    const before = await readAccountState(databaseUri);

    const secondRun = runSeedCommand(databaseUri, {
      env: { ROOT_ADMIN_PASSWORD: ["changed", "secret", "456"].join("-") },
    });
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);

    const after = await readAccountState(databaseUri);
    expect(after.users).toEqual(before.users);
    expect(after.relationships).toEqual(before.relationships);
  }, 120_000);

  it("缺少 ROOT_ADMIN_* 環境變數時以非零結束並指出缺哪一個", () => {
    const databaseUri = createTestDatabaseUri("root-admin-missing-env");

    const result = runSeedCommand(databaseUri, {
      env: { ROOT_ADMIN_PASSWORD: undefined },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ROOT_ADMIN_PASSWORD");
  }, 120_000);
});
