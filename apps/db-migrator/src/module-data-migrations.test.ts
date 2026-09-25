import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Db, MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const MIGRATE_MONGO_BIN = path.join(
  PACKAGE_ROOT,
  "node_modules",
  "migrate-mongo",
  "bin",
  "migrate-mongo.js",
);

/** 本地起 mongodb-memory-server;CI 沿用既有 MongoDB service container(MONGODB_URI)。 */
let memoryServer: MongoMemoryServer | undefined;
let client: MongoClient;
let databaseUri: string;
let database: Db;

function runMigrateUp() {
  return spawnSync(process.execPath, [MIGRATE_MONGO_BIN, "up"], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, MONGODB_URI: databaseUri },
    encoding: "utf8",
  });
}

const rootOrgId = new ObjectId();
const tenantId = new ObjectId("0000000000000000000abc12");
const deptId = new ObjectId();
const otherTenantId = new ObjectId();

/**
 * 模組資料 / 資料範圍依模組 / 短碼 / 權限來源 / 模組 engine 的回填(ADR-0002 遷移)。
 * 先以 driver 放一份「欄位加上之前」的資料,跑 `migrate up`,再驗回填結果與重跑冪等。
 */
describe("回填遷移(模組資料欄位、資料範圍依模組、orgs.slug、permissions.source、modules.engine)", () => {
  beforeAll(async () => {
    let baseUri = process.env.MONGODB_URI;
    if (!baseUri) {
      memoryServer = await MongoMemoryServer.create();
      baseUri = memoryServer.getUri();
    }
    const uri = new URL(baseUri);
    uri.pathname = `/db-migrator-test-${String(process.pid)}-module-data`;
    databaseUri = uri.toString();
    client = await MongoClient.connect(databaseUri);
    database = client.db();

    await database.collection("orgs").insertMany([
      { _id: rootOrgId, name: "根", parentId: null, ancestors: [] },
      {
        _id: tenantId,
        name: "租戶甲",
        parentId: rootOrgId,
        ancestors: [rootOrgId],
      },
      {
        _id: deptId,
        name: "部門",
        parentId: tenantId,
        ancestors: [rootOrgId, tenantId],
      },
      {
        _id: otherTenantId,
        name: "已有短碼的租戶",
        parentId: rootOrgId,
        ancestors: [rootOrgId],
        // 故意佔走「租戶甲」依後 6 碼會得到的短碼,驗撞名時改用後 12 碼
        slug: "tenant_0abc12",
      },
    ]);
    await database.collection("demo_items_one").insertMany([
      { name: "根的", orgId: rootOrgId },
      { name: "部門的", orgId: deptId },
    ]);
    await database
      .collection("demo_items_two")
      .insertOne({ name: "租戶的", orgId: tenantId });
    await database
      .collection("data_scope_targets")
      .createIndex({ collection: 1 }, { unique: true });
    await database.collection("data_scope_targets").insertOne({
      collection: "demo_items_one",
      name: "示範項目",
      fields: [],
    });
    await database
      .collection("data_scope_rules")
      .createIndex({ collection: 1 }, { unique: true });
    await database.collection("data_scope_rules").insertOne({
      collection: "demo_items_one",
      combineOp: "OR",
      rules: [],
    });
    await database
      .collection("permissions")
      .insertOne({ key: "demo.sub.sample-one.view", name: "檢視" });
    await database
      .collection("modules")
      .insertOne({ key: "demo.sub.sample-one", name: "示範模組1" });

    const result = runMigrateUp();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 600_000);

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
    await memoryServer?.stop();
  }, 60_000);

  it("示範兩表:moduleKey 寫死模組 key,tenantId 依 orgId 的祖先推導(根組織為 null)", async () => {
    const one = await database
      .collection("demo_items_one")
      .find({}, { sort: { name: 1 } })
      .toArray();
    expect(
      one.map((item) => ({
        name: item.name as unknown,
        moduleKey: item.moduleKey as unknown,
        tenantId: item.tenantId === null ? null : String(item.tenantId),
      })),
    ).toEqual(
      expect.arrayContaining([
        { name: "根的", moduleKey: "demo.sub.sample-one", tenantId: null },
        {
          name: "部門的",
          moduleKey: "demo.sub.sample-one",
          tenantId: String(tenantId),
        },
      ]),
    );
    const two = await database.collection("demo_items_two").findOne({});
    expect(two?.moduleKey).toBe("demo.sample-two");
    expect(String(two?.tenantId)).toBe(String(tenantId));
  });

  it("資料範圍:目標與規則補 moduleKey,唯一索引改成 (collection, moduleKey)", async () => {
    const target = await database.collection("data_scope_targets").findOne({});
    const rule = await database.collection("data_scope_rules").findOne({});
    expect(target?.moduleKey).toBe("demo.sub.sample-one");
    expect(rule?.moduleKey).toBe("demo.sub.sample-one");
    for (const name of ["data_scope_targets", "data_scope_rules"]) {
      const indexes = await database.collection(name).indexes();
      const keys = indexes.map((index) => JSON.stringify(index.key));
      expect(keys).toContain(JSON.stringify({ collection: 1, moduleKey: 1 }));
      expect(keys).not.toContain(JSON.stringify({ collection: 1 }));
    }
  });

  it("orgs.slug:租戶頂層補 tenant_<id 後 6 碼>,撞到既有短碼改用後 12 碼;其他組織不補", async () => {
    const tenant = await database.collection("orgs").findOne({ _id: tenantId });
    expect(tenant?.slug).toBe("tenant_0000000abc12");
    const root = await database.collection("orgs").findOne({ _id: rootOrgId });
    const dept = await database.collection("orgs").findOne({ _id: deptId });
    expect(root?.slug).toBeUndefined();
    expect(dept?.slug).toBeUndefined();
    const other = await database
      .collection("orgs")
      .findOne({ _id: otherTenantId });
    expect(other?.slug).toBe("tenant_0abc12");
  });

  it("permissions 補 source = seed、retiredAt = null;modules 補 engine = fixed", async () => {
    const permission = await database.collection("permissions").findOne({});
    expect(permission?.source).toBe("seed");
    expect(permission?.retiredAt).toBeNull();
    const module = await database.collection("modules").findOne({});
    expect(module?.engine).toBe("fixed");
  });

  it("重跑 migrate up 不重複執行(changelog 防重跑),回填結果不變", async () => {
    const before = await database.collection("demo_items_one").find().toArray();
    const result = runMigrateUp();
    expect(result.status).toBe(0);
    const after = await database.collection("demo_items_one").find().toArray();
    expect(after).toEqual(before);
  });
});
