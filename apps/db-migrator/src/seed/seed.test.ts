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
    modules: await database
      .collection<ModuleDocument>("modules")
      .find()
      .sort({ key: 1 })
      .toArray(),
    permissions: await database
      .collection<PermissionDocument>("permissions")
      .find()
      .sort({ key: 1 })
      .toArray(),
    dataScopeTargets: await database
      .collection<SeededDocument>("data_scope_targets")
      .find()
      .sort({ collection: 1 })
      .toArray(),
    relationships: await database
      .collection<RelationshipDocument>("core_relationships")
      .find()
      .sort({ type: 1, firstId: 1, secondId: 1 })
      .toArray(),
  }));
}

const hex = (ids: ObjectId[] | undefined): string[] | undefined =>
  ids?.map((id) => id.toHexString());

/** 以 _id 反查種子文件的 key(核心關聯的兩端只存 id)。 */
const keyOf =
  (documents: { key?: string; _id: ObjectId }[]) =>
  (id: ObjectId | undefined): string | undefined =>
    documents.find((document) => id !== undefined && document._id.equals(id))
      ?.key;

/** 模組節點的觀察欄位(正本:docs/modules/*.md 模組樹;欄位形狀:module.schema.ts)。 */
interface ModuleDocument {
  key?: string;
  name?: string;
  parentId?: ObjectId | null;
  ancestors?: ObjectId[];
  route?: string;
  sidebarType?: string;
  order?: number;
  enabled?: boolean;
  isSystem?: boolean;
  [field: string]: unknown;
}

/** 權限的觀察欄位(正本:docs/modules/demo*.md 權限表;欄位形狀:permission.schema.ts)。 */
interface PermissionDocument {
  key?: string;
  name?: string;
  moduleId?: ObjectId;
  enabled?: boolean;
  isSystem?: boolean;
  [field: string]: unknown;
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

describe("模組樹、權限、資料範圍目標種子(#29;正本:docs/modules/*.md)", () => {
  it("示範家族 10 節點依正本落庫:parentId/ancestors 指向該環境的 _id、sidebarType、order;全部 enabled", async () => {
    const databaseUri = createTestDatabaseUri("module-tree");

    const result = runSeedCommand(databaseUri);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const { modules } = await readSeededDocuments(databaseUri);
    const byKey = new Map(modules.map((module) => [module.key, module]));
    const idOf = (key: string): string | undefined =>
      byKey.get(key)?._id.toHexString();

    // 正本:docs/modules/demo.sub.sample-one.md「家族模組樹」+ demo.sample-two.md「模組節點」
    const expectedTree: [string, string, string, string | null][] = [
      ["demo", "示範群組", "group", null],
      ["demo.sub", "示範次群組", "group", "demo"],
      ["demo.sub.sample-one", "示範模組1", "link", "demo.sub"],
      [
        "demo.sub.sample-one.view-page",
        "示範項目詳情",
        "hidden",
        "demo.sub.sample-one",
      ],
      [
        "demo.sub.sample-one.create-page",
        "新增示範項目",
        "hidden",
        "demo.sub.sample-one",
      ],
      [
        "demo.sub.sample-one.edit-page",
        "編輯示範項目",
        "hidden",
        "demo.sub.sample-one",
      ],
      ["demo.sample-two", "示範模組2", "link", "demo"],
      ["demo.sample-two.view-page", "詳情", "hidden", "demo.sample-two"],
      ["demo.sample-two.create-page", "新增", "hidden", "demo.sample-two"],
      ["demo.sample-two.edit-page", "編輯", "hidden", "demo.sample-two"],
    ];
    for (const [key, name, sidebarType, parentKey] of expectedTree) {
      const module = byKey.get(key);
      expect(module).toBeDefined();
      expect(module).toMatchObject({
        name,
        sidebarType,
        isSystem: true,
        enabled: true,
      });
      expect(typeof module?.order).toBe("number");
      expect(typeof module?.route).toBe("string");
      expect(module?.parentId?.toHexString() ?? null).toBe(
        parentKey === null ? null : idOf(parentKey),
      );
    }

    // 物化路徑:祖先由根到父依序
    expect(hex(byKey.get("demo")?.ancestors)).toEqual([]);
    expect(hex(byKey.get("demo.sub.sample-one.edit-page")?.ancestors)).toEqual([
      idOf("demo"),
      idOf("demo.sub"),
      idOf("demo.sub.sample-one"),
    ]);
    expect(hex(byKey.get("demo.sample-two.view-page")?.ancestors)).toEqual([
      idOf("demo"),
      idOf("demo.sample-two"),
    ]);

    // 同層 order 不重複,側欄才有確定順序
    const siblingsOfDemo = modules.filter(
      (module) => module.parentId?.toHexString() === idOf("demo"),
    );
    expect(new Set(siblingsOfDemo.map((module) => module.order)).size).toBe(
      siblingsOfDemo.length,
    );

    // 樹全種(#29 留言定案):治理模組、資料範圍、隱藏 api 模組也在,且皆 enabled(D4:不分環境)
    for (const key of [
      "overview",
      "system",
      "system.org-manager",
      "system.org-manager.tenant-ops",
      "system.user-manager",
      "system.role-manager",
      "system.module-manager",
      "system.field-manager",
      "system.data-scope",
      "api",
    ]) {
      expect(byKey.get(key)).toMatchObject({ isSystem: true, enabled: true });
    }
    expect(byKey.get("api")?.sidebarType).toBe("hidden");

    // 租戶作業:組織管理底下的隱藏權限容器,沒有路由(docs/modules/org-manager.md 模組樹)
    const tenantOps = byKey.get("system.org-manager.tenant-ops");
    expect(tenantOps).toMatchObject({
      name: "租戶作業",
      sidebarType: "hidden",
    });
    expect(tenantOps).not.toHaveProperty("route");
    expect(tenantOps?.parentId?.toHexString()).toBe(idOf("system.org-manager"));
    expect(hex(tenantOps?.ancestors)).toEqual([
      idOf("system"),
      idOf("system.org-manager"),
    ]);
  }, 120_000);

  it("示範家族 12 筆 + 組織管理 9 筆(7 + 租戶作業 2)+ 使用者管理 8 筆 + 角色管理 7 筆 + 模組與權限 3 筆 + 欄位管理 4 筆 + 資料範圍 2 筆個別權限依正本落庫(moduleId 綁「所在的那一頁」);全部 20 個模組各一筆 wildcard,共 65 筆", async () => {
    const databaseUri = createTestDatabaseUri("permissions");

    const firstRun = runSeedCommand(databaseUri);
    expect(firstRun.status).toBe(0);
    expect(firstRun.stdout).toContain("permissions:新增 65 / 更新 0 / 未變 0");
    // 冪等:重跑 0 新增 / 0 更新 / 全部未變
    const secondRun = runSeedCommand(databaseUri);
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toContain("permissions:新增 0 / 更新 0 / 未變 65");

    const { modules, permissions } = await readSeededDocuments(databaseUri);
    const moduleIdOf = (key: string): string | undefined =>
      modules.find((module) => module.key === key)?._id.toHexString();

    // 正本:demo.sub.sample-one.md 權限表(9)+ demo.sample-two.md 權限表(5)
    const expectedOwners: Record<string, string> = {
      "demo.sub.sample-one.view": "demo.sub.sample-one",
      "demo.sub.sample-one.create": "demo.sub.sample-one",
      "demo.sub.sample-one.edit": "demo.sub.sample-one",
      "demo.sub.sample-one.delete": "demo.sub.sample-one",
      "demo.sub.sample-one.show-internal-note": "demo.sub.sample-one",
      "demo.sub.sample-one.edit-internal-note": "demo.sub.sample-one",
      "demo.sub.sample-one.create-page.show-tips":
        "demo.sub.sample-one.create-page",
      "demo.sub.sample-one.edit-page.show-history":
        "demo.sub.sample-one.edit-page",
      "demo.sample-two.view": "demo.sample-two",
      "demo.sample-two.create": "demo.sample-two",
      "demo.sample-two.edit": "demo.sample-two",
      "demo.sample-two.delete": "demo.sample-two",
      // 正本:docs/modules/org-manager.md 權限表(7 + 租戶作業 2;
      // set-visibility 2026-09-19 從 tenant-ops 搬到組織管理層,#187 / ADR-0005)
      "system.org-manager.view": "system.org-manager",
      "system.org-manager.create-child": "system.org-manager",
      "system.org-manager.edit": "system.org-manager",
      "system.org-manager.toggle-enabled": "system.org-manager",
      "system.org-manager.move": "system.org-manager",
      "system.org-manager.delete": "system.org-manager",
      "system.org-manager.set-visibility": "system.org-manager",
      "system.org-manager.tenant-ops.provision":
        "system.org-manager.tenant-ops",
      "system.org-manager.tenant-ops.transfer-owner":
        "system.org-manager.tenant-ops",
      // 正本:docs/modules/user-manager.md 權限表(8)
      "system.user-manager.view": "system.user-manager",
      "system.user-manager.create": "system.user-manager",
      "system.user-manager.edit": "system.user-manager",
      "system.user-manager.toggle-enabled": "system.user-manager",
      "system.user-manager.manage-orgs": "system.user-manager",
      "system.user-manager.assign-roles": "system.user-manager",
      "system.user-manager.show-national-id": "system.user-manager",
      "system.user-manager.edit-national-id": "system.user-manager",
      // 正本:docs/modules/role-manager.md 權限表(7)
      "system.role-manager.view": "system.role-manager",
      "system.role-manager.create": "system.role-manager",
      "system.role-manager.edit": "system.role-manager",
      "system.role-manager.edit-matrix": "system.role-manager",
      "system.role-manager.assign-users": "system.role-manager",
      "system.role-manager.toggle-enabled": "system.role-manager",
      "system.role-manager.delete": "system.role-manager",
      // 正本:docs/modules/module-manager.md 權限表(3;根組織專屬模組)
      "system.module-manager.view": "system.module-manager",
      "system.module-manager.toggle-enabled": "system.module-manager",
      "system.module-manager.set-icon": "system.module-manager",
      // 正本:docs/modules/field-manager.md 權限表(4)
      "system.field-manager.view": "system.field-manager",
      "system.field-manager.create": "system.field-manager",
      "system.field-manager.edit": "system.field-manager",
      "system.field-manager.toggle-enabled": "system.field-manager",
      // 正本:docs/modules/data-scope.md 權限表(2;根組織專屬模組)
      "system.data-scope.view": "system.data-scope",
      "system.data-scope.edit": "system.data-scope",
    };

    // D3:wildcard 只代表該模組自己這一層 → 每個模組(含群組、隱藏頁、api 樹)各一筆 `<key>.*`
    for (const module of modules) {
      expectedOwners[`${String(module.key)}.*`] = String(module.key);
    }
    expect(modules).toHaveLength(20);
    expect(permissions).toHaveLength(65);
    for (const [key, ownerKey] of Object.entries(expectedOwners)) {
      const permission = permissions.find((entry) => entry.key === key);
      expect(permission).toMatchObject({ isSystem: true, enabled: true });
      expect(typeof permission?.name).toBe("string");
      expect(permission?.moduleId?.toHexString()).toBe(moduleIdOf(ownerKey));
    }
  }, 120_000);

  it("示範模組1 的 dataScopeTarget 落庫至 data_scope_targets(collection 為識別鍵,不多掛 key 欄位),重跑冪等", async () => {
    const databaseUri = createTestDatabaseUri("data-scope-targets");

    expect(runSeedCommand(databaseUri).status).toBe(0);
    const secondRun = runSeedCommand(databaseUri);
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toContain(
      "data_scope_targets:新增 0 / 更新 0 / 未變 1",
    );

    const { dataScopeTargets } = await readSeededDocuments(databaseUri);
    expect(dataScopeTargets).toHaveLength(1);
    // 業務欄位目錄照宣告落庫(#246 的 2:enum 的固定選項);基礎欄位不入庫,由 api 查詢時附加
    expect(dataScopeTargets[0]).toMatchObject({
      collection: "demo_items_one",
      isSystem: true,
      fields: [
        {
          name: "status",
          label: "狀態",
          type: "enum",
          options: [
            { value: "draft", label: "草稿" },
            { value: "published", label: "已發布" },
            { value: "archived", label: "已封存" },
          ],
        },
      ],
    });
    expect(typeof dataScopeTargets[0]?.name).toBe("string");
    expect(dataScopeTargets[0]).not.toHaveProperty("key");
  }, 120_000);

  it("enabled 是「初始 seed 值的欄位」:建立後在系統內改為 false,重跑 seed 為未變、值仍為 false;宣告的其他欄位改了仍同步", async () => {
    const databaseUri = createTestDatabaseUri("initial-seed-value");

    expect(runSeedCommand(databaseUri).status).toBe(0);
    await withDatabase(databaseUri, async (database) => {
      await database
        .collection("modules")
        .updateOne({ key: "demo.sample-two" }, { $set: { enabled: false } });
      await database
        .collection("roles")
        .updateOne({ key: "tenant-admin" }, { $set: { enabled: false } });
    });

    const secondRun = runSeedCommand(databaseUri);
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toMatch(/新增 0 \/ 更新 0 \/ 未變 [1-9]\d*/);

    const { modules, roles } = await readSeededDocuments(databaseUri);
    expect(
      modules.find((module) => module.key === "demo.sample-two")?.enabled,
    ).toBe(false);
    expect(roles.find((role) => role.key === "tenant-admin")?.enabled).toBe(
      false,
    );
    // 其他模組不受影響
    expect(modules.find((module) => module.key === "demo")?.enabled).toBe(true);
  }, 120_000);

  it("icon 初值依正本落庫;人在系統內改過(含清成 null)重跑不被覆蓋,欄位缺漏才補初值(#288)", async () => {
    const databaseUri = createTestDatabaseUri("module-icon");

    expect(runSeedCommand(databaseUri).status).toBe(0);

    const seeded = await readSeededDocuments(databaseUri);
    const iconOf = (key: string): unknown =>
      seeded.modules.find((module) => module.key === key)?.icon;
    // 初值正本:apps/db-migrator/seeds/modules/*.ts(對照表見 docs/modules/module-manager.md)
    expect(iconOf("overview")).toBe("dashboard");
    expect(iconOf("system")).toBe("settings");
    expect(iconOf("system.org-manager")).toBe("business");
    expect(iconOf("system.org-manager.tenant-ops")).toBe("key");
    expect(iconOf("api")).toBe("tune");
    // 沒宣告圖示的隱藏頁落庫為 null(欄位在、值為 null = 側欄用預設圖示)
    expect(iconOf("demo.sample-two.view-page")).toBeNull();

    await withDatabase(databaseUri, async (database) => {
      // 人改過:一筆換成別的 key、一筆清成 null(setModuleIcon 寫的就是 null,不是 $unset)
      await database
        .collection("modules")
        .updateOne({ key: "overview" }, { $set: { icon: "home" } });
      await database
        .collection("modules")
        .updateOne({ key: "system" }, { $set: { icon: null } });
      // 舊環境的文件根本沒有這一欄(#288 之前種下的資料):重跑要補初值,否則新功能等於沒上線
      await database
        .collection("modules")
        .updateOne({ key: "api" }, { $unset: { icon: "" } });
    });

    const secondRun = runSeedCommand(databaseUri);
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);

    const after = await readSeededDocuments(databaseUri);
    const afterIconOf = (key: string): unknown =>
      after.modules.find((module) => module.key === key)?.icon;
    expect(afterIconOf("overview")).toBe("home");
    expect(afterIconOf("system")).toBeNull();
    expect(afterIconOf("api")).toBe("tune");
  }, 120_000);

  it("初始 seed 值的欄位改了不算變更,每次都 seed 的欄位改了仍同步(以夾具 registry 驗證)", async () => {
    const databaseUri = createTestDatabaseUri("initial-seed-value-fixture");

    const firstRun = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-initial-v1"),
    });
    expect(firstRun.stderr).toBe("");
    expect(firstRun.status).toBe(0);
    expect(firstRun.stdout).toContain("新增 2 / 更新 0 / 未變 0");

    // v2:alpha 的 enabled 改 false(初始 seed 值,不同步)、beta 的 name 改了(每次都 seed,同步)
    const secondRun = runSeedCommand(databaseUri, {
      registryPath: fixtureRegistryPath("seeds-initial-v2"),
    });
    expect(secondRun.stderr).toBe("");
    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toContain("新增 0 / 更新 1 / 未變 1");

    const items = await withDatabase(databaseUri, (database) =>
      database
        .collection<SeededDocument>("seed_fixture_items")
        .find()
        .sort({ key: 1 })
        .toArray(),
    );
    expect(items.map((item) => [item.key, item.name, item.enabled])).toEqual([
      ["alpha", "Alpha", true],
      ["beta", "Beta 2", true],
    ]);
  }, 120_000);
});

describe("種子角色綁定(ADR-0004 wildcard 只存 *、ADR-0009 模板扣除根組織專屬模組)", () => {
  it("租戶管理員模板綁全部非根組織專屬模組(role_module)與各該模組各自的 wildcard(role_permission,一一對應);超級管理員不造任何綁定;重跑不重複", async () => {
    const databaseUri = createTestDatabaseUri("role-bindings");

    expect(runSeedCommand(databaseUri).status).toBe(0);
    expect(runSeedCommand(databaseUri).status).toBe(0);

    const { roles, modules, permissions, relationships } =
      await readSeededDocuments(databaseUri);
    const tenantAdmin = roles.find((role) => role.key === "tenant-admin");
    const superAdmin = roles.find((role) => role.key === "super-admin");
    const boundBy = (roleId: ObjectId | undefined, type: string) =>
      relationships.filter(
        (link) =>
          link.type === type &&
          roleId !== undefined &&
          link.firstId?.equals(roleId),
      );

    const boundModuleKeys = boundBy(tenantAdmin?._id, "role_module").map(
      (link) => keyOf(modules)(link.secondId),
    );
    const allModuleKeys = modules.map((module) => module.key);
    // 根組織專屬:模組與權限(system.module-manager)、資料範圍(system.data-scope)、
    // 租戶作業(system.org-manager.tenant-ops,隱藏權限容器)— docs/modules/*.md
    const rootOnlyKeys = new Set([
      "system.module-manager",
      "system.data-scope",
      "system.org-manager.tenant-ops",
    ]);
    const tenantModuleKeys = allModuleKeys.filter(
      (key) => key !== undefined && !rootOnlyKeys.has(key),
    );
    expect(new Set(boundModuleKeys)).toEqual(new Set(tenantModuleKeys));
    expect(boundModuleKeys).toHaveLength(17);
    // 租戶作業(開通、轉移擁有者)永遠不進模板(ADR-0009 第 3 步:整個 rootOnly 模組被扣除)
    expect(boundModuleKeys).not.toContain("system.org-manager.tenant-ops");
    // 反面:可見範圍開關搬到組織管理層後,模板靠 `system.org-manager.*` 自動取得(#187 / ADR-0005)—
    // 模板不綁個別權限,所以這裡驗的是「它的擁有模組在模板綁的模組內」
    expect(boundModuleKeys).toContain("system.org-manager");
    const setVisibility = permissions.find(
      (permission) => permission.key === "system.org-manager.set-visibility",
    );
    expect(
      modules.find((module) => module._id.equals(setVisibility?.moduleId))?.key,
    ).toBe("system.org-manager");

    const boundPermissionKeys = boundBy(
      tenantAdmin?._id,
      "role_permission",
    ).map((link) => keyOf(permissions)(link.secondId));
    // D3:wildcard 只代表自己這一層 → 綁的每個模組各自的 `*`(含 overview、system 群組、api、六個隱藏頁)
    expect(new Set(boundPermissionKeys)).toEqual(
      new Set(tenantModuleKeys.map((key) => `${String(key)}.*`)),
    );
    expect(boundPermissionKeys).toHaveLength(17);

    // 超級管理員:解析時 bypass,不靠記錄(ADR-0004)
    expect(boundBy(superAdmin?._id, "role_module")).toHaveLength(0);
    expect(boundBy(superAdmin?._id, "role_permission")).toHaveLength(0);
  }, 120_000);
});
