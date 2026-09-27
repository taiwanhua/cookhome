import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Db, MongoClient, ObjectId, type WithId } from "mongodb";
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
const RESET_ENTRY = path.join(PACKAGE_ROOT, "src", "reset", "run.ts");

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

const usedDatabaseUris: string[] = [];

/**
 * 測試資料庫一律以 `-dev` 結尾:目標環境由資料庫名推得(`reset-safety.ts`),
 * 其餘名字一律被當成 production 而拒絕 —— 測試走的就是正式那條判斷。
 */
function createTestDatabaseUri(suffix: string): string {
  const databaseUri = buildDatabaseUri(
    `db-migrator-reset-test-${String(process.pid)}-${suffix}`,
  );
  usedDatabaseUris.push(databaseUri);
  return databaseUri;
}

interface RunOptions {
  env?: Record<string, string | undefined>;
}

function runSeedCommand(databaseUri: string, options: RunOptions = {}) {
  return spawnSync(process.execPath, [TSX_CLI, SEED_ENTRY], {
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

interface RunResetOptions extends RunOptions {
  mode: string;
  /** 預設與連線字串的資料庫名一致(安全閥放行);測負面案例時另外給。 */
  confirm?: string;
}

/** 以子行程執行 reset 指令(等同 `pnpm --filter @repo/db-migrator reset …`)。 */
function runResetCommand(databaseUri: string, options: RunResetOptions) {
  const databaseName = new URL(databaseUri).pathname.replace(/^\//, "");
  return spawnSync(
    process.execPath,
    [
      TSX_CLI,
      RESET_ENTRY,
      `--mode=${options.mode}`,
      `--confirm=${options.confirm ?? databaseName}`,
    ],
    {
      cwd: PACKAGE_ROOT,
      env: {
        ...process.env,
        ...ROOT_ADMIN_ENV,
        MONGODB_URI: databaseUri,
        RESET_ALLOW_ENV: "dev",
        ...options.env,
      },
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

interface Keyed {
  key?: string;
  [field: string]: unknown;
}

interface Relationship {
  type?: string;
  firstId?: ObjectId;
  secondId?: ObjectId;
  [field: string]: unknown;
}

/** 以種子 key 反查該環境的 _id(核心關聯的兩端只存 id)。 */
const idOf = (documents: WithId<Keyed>[], key: string): ObjectId | undefined =>
  documents.find((document) => document.key === key)?._id;

const relation = (
  type: string,
  firstId: ObjectId,
  secondId: ObjectId,
): Record<string, unknown> => ({
  type,
  firstId,
  secondId,
  thirdId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * 灌一份「人建的資料」:開通一個租戶之後資料庫會多出來的那些
 * —— 租戶組織、租戶使用者、租戶副本角色與自建角色、它們的四種核心關聯、
 * 租戶自訂的欄位選項、資料範圍規則、人新增的示範項目,以及四張純業務表。
 */
async function insertHumanData(database: Db): Promise<void> {
  const now = new Date();
  const rootModule = await database.collection("modules").findOne({});
  const rootPermission = await database.collection("permissions").findOne({});
  const rootOrg = await database.collection("orgs").findOne({ key: "root" });

  const { insertedId: tenantOrgId } = await database
    .collection("orgs")
    .insertOne({
      name: "人建的租戶",
      parentId: rootOrg?._id ?? null,
      ancestors: rootOrg ? [rootOrg._id] : [],
      enabled: true,
      isSystem: false,
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

  const { insertedId: tenantUserId } = await database
    .collection("users")
    .insertOne({
      name: "人建的使用者",
      account: "tenant-user",
      email: "tenant-user@example.com",
      passwordHash: ["not", "a", "real", "hash"].join("-"),
      enabled: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

  const roles = database.collection("roles");
  // 開通租戶時複製的租戶管理員副本(沒有 key,ADR-0009)
  const { insertedId: tenantRoleId } = await roles.insertOne({
    name: "租戶管理員",
    enabled: true,
    isSystem: false,
    settings: {},
    createdAt: now,
    updatedAt: now,
  });
  // 租戶自建角色
  const { insertedId: customRoleId } = await roles.insertOne({
    name: "門市店長",
    enabled: true,
    isSystem: false,
    settings: {},
    createdAt: now,
    updatedAt: now,
  });

  await database
    .collection("core_relationships")
    .insertMany([
      relation("org_user", tenantOrgId, tenantUserId),
      relation("org_role", tenantOrgId, tenantRoleId),
      relation("org_role", tenantOrgId, customRoleId),
      relation("user_role", tenantUserId, tenantRoleId),
      relation("role_module", tenantRoleId, rootModule?._id ?? new ObjectId()),
      relation(
        "role_permission",
        tenantRoleId,
        rootPermission?._id ?? new ObjectId(),
      ),
    ]);

  await database.collection("fields").insertOne({
    categoryId: new ObjectId(),
    orgId: tenantOrgId,
    value: "dessert",
    label: "甜點",
    order: 9,
    enabled: true,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  });

  await database.collection("data_scope_rules").insertOne({
    collection: "demo_items_one",
    rules: [],
    createdAt: now,
    updatedAt: now,
  });

  await database.collection("demo_items_one").insertOne({
    orgId: tenantOrgId,
    name: "人建的示範項目",
    category: "staple",
    status: "draft",
    enabled: true,
    createdBy: tenantUserId,
    createdAt: now,
    updatedAt: now,
  });

  for (const collection of [
    "audit_logs",
    "action_tokens",
    "refresh_tokens",
    "customers",
  ]) {
    await database
      .collection(collection)
      .insertOne({ orgId: tenantOrgId, createdAt: now, updatedAt: now });
  }
}

/** 人在系統內改過的初始 seed 值欄位(ADR-0002):`data` 模式必須原封不動。 */
async function tweakInitialSeedValues(database: Db): Promise<void> {
  await database
    .collection("modules")
    .updateOne({ key: "demo.sample-two" }, { $set: { enabled: false } });
  await database
    .collection("modules")
    .updateOne({ key: "overview" }, { $set: { icon: "home" } });
}

async function readState(databaseUri: string) {
  return withDatabase(databaseUri, async (database) => {
    const documentsIn = (name: string) =>
      database.collection<Keyed>(name).find().sort({ key: 1 }).toArray();
    const existing = await database
      .listCollections({}, { nameOnly: true })
      .toArray();
    return {
      collections: existing.map(({ name }) => name),
      orgs: await documentsIn("orgs"),
      users: await documentsIn("users"),
      roles: await documentsIn("roles"),
      modules: await documentsIn("modules"),
      permissions: await documentsIn("permissions"),
      fields: await documentsIn("fields"),
      fieldCategories: await documentsIn("field_categories"),
      dataScopeTargets: await documentsIn("data_scope_targets"),
      dataScopeRules: await documentsIn("data_scope_rules"),
      demoItemsOne: await documentsIn("demo_items_one"),
      demoItemsTwo: await documentsIn("demo_items_two"),
      auditLogs: await documentsIn("audit_logs"),
      actionTokens: await documentsIn("action_tokens"),
      refreshTokens: await documentsIn("refresh_tokens"),
      customers: await documentsIn("customers"),
      relationships: await database
        .collection<Relationship>("core_relationships")
        .find()
        .toArray(),
      changelog: await database.collection("changelog").find().toArray(),
    };
  });
}

/** 種子 + 人建資料 + 人改過的開關 / 圖示。 */
async function prepareDatabase(databaseUri: string): Promise<void> {
  expect(runSeedCommand(databaseUri).status).toBe(0);
  await withDatabase(databaseUri, async (database) => {
    await insertHumanData(database);
    await tweakInitialSeedValues(database);
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

describe("reset --mode=data(對真 MongoDB)", () => {
  it("只刪人建的資料:seed 文件與人改過的 enabled / icon 原封不動,示範項目補回,事後重跑 seed 為 0 / 0 / K", async () => {
    const databaseUri = createTestDatabaseUri("data-dev");
    await prepareDatabase(databaseUri);

    const result = runResetCommand(databaseUri, { mode: "data" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const state = await readState(databaseUri);

    // 人建的都不在
    expect(state.orgs.map((org) => org.key)).toEqual(["root"]);
    expect(state.users.map((user) => user.account)).toEqual([
      ROOT_ADMIN_ENV.ROOT_ADMIN_ACCOUNT,
    ]);
    expect(state.roles.map((role) => role.key)).toEqual([
      "super-admin",
      "tenant-admin",
    ]);
    expect(state.dataScopeRules).toHaveLength(0);
    expect(state.auditLogs).toHaveLength(0);
    expect(state.actionTokens).toHaveLength(0);
    expect(state.refreshTokens).toHaveLength(0);
    expect(state.customers).toHaveLength(0);
    // 租戶自訂的欄位選項被刪,seed 宣告的七筆留著(判準是 registry 的 key,不是 isSystem)
    expect(state.fields).toHaveLength(7);
    expect(state.fields.map((field) => field.label)).not.toContain("甜點");

    // seed 管的設定留著(數量正本:src/seed/seed.test.ts 的模組 / 權限斷言)
    expect(state.modules).toHaveLength(33);
    expect(state.permissions).toHaveLength(103);
    expect(state.fieldCategories).toHaveLength(2);
    expect(state.dataScopeTargets).toHaveLength(3);

    // 人改過的初始 seed 值欄位沒有被翻回宣告值(ADR-0002)
    const moduleBy = (key: string) =>
      state.modules.find((module) => module.key === key);
    expect(moduleBy("demo.sample-two")?.enabled).toBe(false);
    expect(moduleBy("overview")?.icon).toBe("home");

    // 示範項目:人新增的那筆不在,宣告的十筆由同一次執行的 seed 補回
    expect(state.demoItemsOne).toHaveLength(5);
    expect(state.demoItemsTwo).toHaveLength(5);
    expect(state.demoItemsOne.map((item) => item.name)).not.toContain(
      "人建的示範項目",
    );
    for (const item of [...state.demoItemsOne, ...state.demoItemsTwo]) {
      expect(typeof item.key).toBe("string");
    }

    // 事後重跑 seed:完全冪等
    const rerun = runSeedCommand(databaseUri);
    expect(rerun.status).toBe(0);
    expect(rerun.stdout).toMatch(/新增 0 \/ 更新 0 \/ 未變 [1-9]\d*/);
  }, 300_000);

  it("核心關聯只刪「任一端指向被刪文件」的那些:root ↔ 根組織、root ↔ 超級管理員、種子角色的綁定都留著", async () => {
    const databaseUri = createTestDatabaseUri("data-relations-dev");
    await prepareDatabase(databaseUri);

    expect(runResetCommand(databaseUri, { mode: "data" }).status).toBe(0);

    const state = await readState(databaseUri);
    const rootOrgId = idOf(state.orgs, "root");
    const rootUserId = state.users[0]?._id;
    const superAdminId = idOf(state.roles, "super-admin");
    const tenantAdminId = idOf(state.roles, "tenant-admin");
    const countOf = (type: string, firstId: ObjectId | undefined) =>
      state.relationships.filter(
        (link) =>
          link.type === type &&
          firstId !== undefined &&
          link.firstId?.equals(firstId),
      ).length;

    expect(state.relationships).toContainEqual(
      expect.objectContaining({
        type: "org_user",
        firstId: rootOrgId,
        secondId: rootUserId,
      }),
    );
    expect(state.relationships).toContainEqual(
      expect.objectContaining({
        type: "user_role",
        firstId: rootUserId,
        secondId: superAdminId,
      }),
    );
    // 種子角色的擁有組織兩筆 + 租戶管理員模板的 30 + 30 綁定(正本:src/seed/seed.test.ts)
    expect(countOf("org_role", rootOrgId)).toBe(2);
    expect(countOf("role_module", tenantAdminId)).toBe(30);
    expect(countOf("role_permission", tenantAdminId)).toBe(30);
    // 掛在被刪租戶 / 使用者 / 角色上的六筆關聯全數消失
    expect(state.relationships).toHaveLength(2 + 1 + 1 + 30 + 30);
  }, 300_000);
});

describe("reset --mode=full(對真 MongoDB)", () => {
  it("資料庫從空重建:人建的資料與其 collection 都不在,初始 seed 值欄位回到宣告值,遷移重新跑過", async () => {
    const databaseUri = createTestDatabaseUri("full-dev");
    await prepareDatabase(databaseUri);

    const result = runResetCommand(databaseUri, { mode: "full" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dropDatabase");

    const state = await readState(databaseUri);

    expect(state.orgs.map((org) => org.key)).toEqual(["root"]);
    expect(state.users).toHaveLength(1);
    expect(state.roles).toHaveLength(2);
    expect(state.modules).toHaveLength(33);
    expect(state.demoItemsOne).toHaveLength(5);
    expect(state.demoItemsTwo).toHaveLength(5);
    // 整庫 drop:純業務表連 collection 都不再存在
    expect(state.collections).not.toContain("customers");
    // data_scope_rules 的 collection 會被遷移(建唯一索引)重新建出來,但人建的規則不在
    expect(state.dataScopeRules).toHaveLength(0);
    // 全新安裝:初始 seed 值欄位也回到宣告值(這是與 data 模式唯一的差別)
    const moduleBy = (key: string) =>
      state.modules.find((module) => module.key === key);
    expect(moduleBy("demo.sample-two")?.enabled).toBe(true);
    expect(moduleBy("overview")?.icon).toBe("dashboard");
    // migrate 在 seed 之前重跑過(changelog 是 dropDatabase 後重新長出來的)
    expect(state.changelog.length).toBeGreaterThan(1);
  }, 300_000);
});

describe("reset 的安全閥(拒絕時 exit 1 並印原因)", () => {
  it("--confirm 與連線字串的資料庫名不符時拒絕,且一筆都沒刪", async () => {
    const databaseUri = createTestDatabaseUri("guard-confirm-dev");
    await prepareDatabase(databaseUri);

    const result = runResetCommand(databaseUri, {
      mode: "data",
      confirm: "cookhome-dev",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--confirm 必須等於連線字串的資料庫名");

    const state = await readState(databaseUri);
    expect(state.orgs).toHaveLength(2);
    expect(state.customers).toHaveLength(1);
  }, 300_000);

  it("資料庫名被判定為 production 時永遠拒絕(名稱含 prod,或不以 -dev / -staging 結尾)", () => {
    const databaseUri = createTestDatabaseUri("guard-prod");

    const result = runResetCommand(databaseUri, {
      mode: "data",
      env: { RESET_ALLOW_ENV: "dev,staging,production" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("永不對 production 執行");
  }, 120_000);

  it("RESET_ALLOW_ENV 不含目標環境時拒絕", () => {
    const databaseUri = createTestDatabaseUri("guard-allow-env-dev");

    const notSet = runResetCommand(databaseUri, {
      mode: "data",
      env: { RESET_ALLOW_ENV: undefined },
    });
    expect(notSet.status).toBe(1);
    expect(notSet.stderr).toContain("RESET_ALLOW_ENV");
    expect(notSet.stderr).toContain("不含目標環境 dev");

    const otherEnv = runResetCommand(databaseUri, {
      mode: "data",
      env: { RESET_ALLOW_ENV: "staging" },
    });
    expect(otherEnv.status).toBe(1);
    expect(otherEnv.stderr).toContain("不含目標環境 dev");
  }, 120_000);
});
