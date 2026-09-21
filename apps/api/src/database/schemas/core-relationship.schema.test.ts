import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Model, Types } from "mongoose";

import {
  HOOK_TIMEOUT_MS,
  type TestDatabase,
  openTestDatabase,
} from "../test-support/mongo-connection";
import {
  CORE_RELATIONSHIP_TYPES,
  CoreRelationship,
  CoreRelationshipSchema,
  type CoreRelationshipType,
} from "./core-relationship.schema";

describe("core_relationships schema(ADR-0001)", () => {
  let database: TestDatabase;
  let model: Model<CoreRelationship>;

  beforeAll(async () => {
    database = await openTestDatabase("cookhome-test-core-relationships");
    model = database.connection.model<CoreRelationship>(
      CoreRelationship.name,
      CoreRelationshipSchema,
    );
    await model.syncIndexes();
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await database.close();
  }, HOOK_TIMEOUT_MS);

  it("封閉 enum 完整清單 = ADR-0001 的五種,且五種皆可寫入", async () => {
    // 完整清單的正本:ADR-0001(命名順序 Org > User > Role > Module > Permission)
    expect([...CORE_RELATIONSHIP_TYPES]).toEqual([
      "org_user",
      "org_role",
      "user_role",
      "role_module",
      "role_permission",
    ]);

    for (const type of CORE_RELATIONSHIP_TYPES) {
      await model.create({
        type,
        firstId: new Types.ObjectId(),
        secondId: new Types.ObjectId(),
      });
    }
    await expect(model.countDocuments()).resolves.toBe(5);
  });

  it("清單外的 type 被拒絕(封閉 enum)", async () => {
    await expect(
      model.create({
        // 型別上也是封閉的;此處刻意繞過編譯期檢查,驗證資料庫層的拒絕
        type: "org_permission" as CoreRelationshipType,
        firstId: new Types.ObjectId(),
        secondId: new Types.ObjectId(),
      }),
    ).rejects.toThrow(/org_permission/);
  });

  it("同一組(type, firstId, secondId)重複寫入被唯一索引擋下", async () => {
    const firstId = new Types.ObjectId();
    const secondId = new Types.ObjectId();
    await model.create({ type: "org_user", firstId, secondId });
    await expect(
      model.create({ type: "org_user", firstId, secondId }),
    ).rejects.toMatchObject({ code: 11_000 });
  });

  it("org_role 於 second(role)側唯一:一個角色僅一個擁有組織;其他 type 不受限", async () => {
    const roleId = new Types.ObjectId();
    await model.create({
      type: "org_role",
      firstId: new Types.ObjectId(),
      secondId: roleId,
    });
    await expect(
      model.create({
        type: "org_role",
        firstId: new Types.ObjectId(),
        secondId: roleId,
      }),
    ).rejects.toMatchObject({ code: 11_000 });

    // user_role 沒有 second 側唯一:同一角色可授予多位使用者
    const sharedRoleId = new Types.ObjectId();
    await model.create({
      type: "user_role",
      firstId: new Types.ObjectId(),
      secondId: sharedRoleId,
    });
    await model.create({
      type: "user_role",
      firstId: new Types.ObjectId(),
      secondId: sharedRoleId,
    });
    await expect(
      model.countDocuments({ type: "user_role", secondId: sharedRoleId }),
    ).resolves.toBe(2);
  });

  it("各 type 查詢用索引(type, firstId)/(type, secondId)已就位", async () => {
    const indexes = (await model.collection.listIndexes().toArray()) as {
      key: Record<string, number>;
    }[];
    const keys = indexes.map((index) => index.key);
    expect(keys).toContainEqual({ type: 1, firstId: 1 });
    expect(keys).toContainEqual({ type: 1, secondId: 1 });
  });
});
