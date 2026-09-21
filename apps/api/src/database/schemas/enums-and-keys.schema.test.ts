import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Model, Types } from "mongoose";

import {
  HOOK_TIMEOUT_MS,
  type TestDatabase,
  openTestDatabase,
} from "../test-support/mongo-connection";
import {
  ActionToken,
  ActionTokenSchema,
  type ActionTokenType,
} from "./action-token.schema";
import { Module, ModuleSchema, type ModuleSidebarType } from "./module.schema";
import {
  type AccountType,
  RefreshToken,
  RefreshTokenSchema,
} from "./refresh-token.schema";

describe("封閉 enum 與種子 key 唯一性(對真 MongoDB 驗證)", () => {
  let database: TestDatabase;
  let moduleModel: Model<Module>;
  let refreshTokenModel: Model<RefreshToken>;
  let actionTokenModel: Model<ActionToken>;

  beforeAll(async () => {
    database = await openTestDatabase("cookhome-test-enums");
    moduleModel = database.connection.model<Module>(Module.name, ModuleSchema);
    refreshTokenModel = database.connection.model<RefreshToken>(
      RefreshToken.name,
      RefreshTokenSchema,
    );
    actionTokenModel = database.connection.model<ActionToken>(
      ActionToken.name,
      ActionTokenSchema,
    );
    await moduleModel.syncIndexes();
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await database.close();
  }, HOOK_TIMEOUT_MS);

  it("modules.sidebarType 只接受 group/link/hidden", async () => {
    await expect(
      moduleModel.create({
        key: "invalid-sidebar",
        name: "非法側欄型別",
        sidebarType: "sidebar" as ModuleSidebarType,
      }),
    ).rejects.toThrow(/sidebarType/);
    await expect(
      moduleModel.create({
        key: "ok-group",
        name: "群組",
        sidebarType: "group",
      }),
    ).resolves.toBeDefined();
  });

  it("modules.key 重複被唯一索引擋下", async () => {
    await moduleModel.create({
      key: "dup-module",
      name: "第一個",
      sidebarType: "link",
    });
    await expect(
      moduleModel.create({
        key: "dup-module",
        name: "第二個",
        sidebarType: "link",
      }),
    ).rejects.toMatchObject({ code: 11_000 });
  });

  it("refresh_tokens.accountType 只接受 user/customer", async () => {
    await expect(
      refreshTokenModel.create({
        accountId: new Types.ObjectId(),
        accountType: "admin" as AccountType,
        tokenHash: "hash",
        expiresAt: new Date(),
      }),
    ).rejects.toThrow(/accountType/);
  });

  it("action_tokens.type 只接受 activation/password-reset", async () => {
    await expect(
      actionTokenModel.create({
        userId: new Types.ObjectId(),
        type: "magic-link" as ActionTokenType,
        tokenHash: "hash",
        expiresAt: new Date(),
      }),
    ).rejects.toThrow(/type/);
  });
});
