import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Types } from "mongoose";

import { HOOK_TIMEOUT_MS } from "../database/test-support/mongo-connection";
import { type AuthTestApp, startAuthTestApp } from "../auth/test-support/auth-app";
import { createOrg, createUser } from "../auth/test-support/fixtures";
import { createRole } from "./test-support/fixtures";

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
    }
  }
`;

const ME_MODULES = /* GraphQL */ `
  query MeModules {
    me {
      id
      modules {
        id
        key
        name
        parentId
        sidebarType
        order
        route
        permissions
      }
    }
  }
`;

interface LoginData {
  login: { accessToken: string };
}

interface MeModule {
  id: string;
  key: string;
  name: string;
  parentId: string | null;
  sidebarType: string;
  order: number;
  route: string | null;
  permissions: string[];
}

interface MeModulesData {
  me: { id: string; modules: MeModule[] };
}

const PASSWORD = ["test", "pass", "word"].join("-");

function byKey(modules: MeModule[], key: string): MeModule {
  const found = modules.find((module) => module.key === key);
  if (!found) {
    throw new Error(`me.modules 沒有 ${key}`);
  }
  return found;
}

/** 不看順序、看成員完全相同(auth.test.ts 的既有寫法)。 */
function expectSameMembers(actual: string[], expected: string[]): void {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
}

describe("登入線2:me.modules(PermissionResolver,ADR-0011 七步)+ @RequirePermission 守門(GraphQL 端點,對真 Nest app + 真 MongoDB)", () => {
  let api: AuthTestApp;
  let tenantId: Types.ObjectId;
  let userSequence = 0;

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-permission");
    tenantId = await createOrg(api.connection, { name: "租戶甲" });
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  /** 建一個租戶甲的使用者並登入,回 userId 與 access token。 */
  async function createLoggedInUser(): Promise<{
    userId: Types.ObjectId;
    accessToken: string;
  }> {
    userSequence += 1;
    const account = `perm-user-${String(userSequence)}`;
    const userId = await createUser(api.connection, {
      account,
      password: PASSWORD,
      orgIds: [tenantId],
    });
    const result = await api.graphql<LoginData>(LOGIN, {
      input: { account, password: PASSWORD },
    });
    expect(result.errors).toBeUndefined();
    const accessToken = result.data?.login.accessToken;
    if (!accessToken) {
      throw new Error("login 沒有回 accessToken");
    }
    return { userId, accessToken };
  }

  async function fetchModules(accessToken: string): Promise<MeModule[]> {
    const result = await api.graphql<MeModulesData>(
      ME_MODULES,
      {},
      { accessToken },
    );
    expect(result.errors).toBeUndefined();
    return result.data?.me.modules ?? [];
  }

  describe("me.modules:一般角色", () => {
    it("只回綁定的模組(樹完整),每筆 permissions 為該模組的有效權限;未綁的模組不出現", async () => {
      const { userId, accessToken } = await createLoggedInUser();
      await createRole(api.app, api.connection, {
        name: "只綁示範模組2",
        ownerOrgId: tenantId,
        moduleKeys: ["demo", "demo.sample-two"],
        permissionKeys: ["demo.sample-two.view", "demo.sample-two.edit"],
        assignTo: [userId],
      });

      const modules = await fetchModules(accessToken);
      expectSameMembers(
        modules.map((module) => module.key),
        ["demo", "demo.sample-two"],
      );

      const demo = byKey(modules, "demo");
      expect(demo).toMatchObject({
        name: "示範群組",
        parentId: null,
        sidebarType: "GROUP",
        order: 2,
        route: "/demo",
        permissions: [],
      });

      const sampleTwo = byKey(modules, "demo.sample-two");
      expect(sampleTwo).toMatchObject({
        name: "示範模組2",
        parentId: demo.id,
        sidebarType: "LINK",
        order: 2,
        route: "/demo/sample-two",
      });
      expectSameMembers(sampleTwo.permissions, [
        "demo.sample-two.edit",
        "demo.sample-two.view",
      ]);
    });
  });
});
