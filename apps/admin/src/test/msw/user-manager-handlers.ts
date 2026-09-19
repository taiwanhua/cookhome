import { HttpResponse } from "msw";

import {
  type AssignUserRolesMutationVariables,
  type CreateUserMutationVariables,
  type OrgQuery,
  type OrgQueryVariables,
  type OrgTreeQuery,
  type SetUserEnabledMutationVariables,
  type SetUserOrgsMutationVariables,
  type UpdateUserMutationVariables,
  type UserQuery,
  type UsersQueryVariables,
} from "@repo/graphql";

import { type AuthErrorCode, graphqlError } from "./auth-handlers";
import { api } from "./server";

/** 測試夾具的一筆使用者 = `user(id)` 的完整形狀(清單投影掉細節欄位)。 */
export type TestUser = UserQuery["user"];
export type TestOrgNode = OrgTreeQuery["orgTree"][number];
export type TestOrg = OrgQuery["org"];

interface OrgNodeLike {
  id: string;
  children?: readonly OrgNodeLike[];
}

/** 組織子樹的 id 集合(清單範圍 = 選中組織的子樹,ADR-0005)。 */
const subtreeIds = (
  nodes: readonly OrgNodeLike[],
  orgId: string,
): Set<string> => {
  const collect = (node: OrgNodeLike): string[] => [
    node.id,
    ...(node.children ?? []).flatMap((child) => collect(child)),
  ];
  const find = (list: readonly OrgNodeLike[]): OrgNodeLike | null => {
    for (const node of list) {
      if (node.id === orgId) {
        return node;
      }
      const hit = find(node.children ?? []);
      if (hit !== null) {
        return hit;
      }
    }
    return null;
  };
  const root = find(nodes);
  return new Set(root === null ? [orgId] : collect(root));
};

/** 清單投影:`users` 只回這幾個欄位(`nationalId` 等細節只在 `user(id)`)。 */
const listItem = (user: TestUser) => ({
  id: user.id,
  account: user.account,
  name: user.name,
  email: user.email,
  enabled: user.enabled,
  orgs: user.orgs,
  roles: user.roles,
});

export interface UserWorldOptions {
  users?: TestUser[];
  orgTree?: TestOrgNode[];
  /** `org(樹根 id)` 的回應:`parentId` 決定是不是根組織視角、`ownerUserId` 是受保護的擁有者 */
  rootOrg?: TestOrg;
  pageSize?: number;
  /** `setUserOrgs(dryRun: true)` 要回的失去資格清單 */
  dryRun?: {
    removedOrgs: { id: string; name: string }[];
    unqualifiedRoles: {
      roleId: string;
      roleName: string;
      ownerOrgId: string | null;
      ownerOrgName: string | null;
      reasons: string[];
      ownerProtected: boolean;
    }[];
  };
  /** 指定某個 mutation 一律回某個錯誤碼(驗 OWNER_PROTECTED / ROLE_OUT_OF_REACH 的提示) */
  failures?: Partial<
    Record<
      | "CreateUser"
      | "UpdateUser"
      | "SetUserEnabled"
      | "SetUserOrgs"
      | "AssignUserRoles",
      AuthErrorCode | "OWNER_PROTECTED" | "LAST_ORG" | "ROLE_OUT_OF_REACH"
    >
  >;
}

export interface UserWorld {
  handlers: ReturnType<typeof api.query>[];
  /** 各操作收到的輸入(依序),用來斷言「送出去的是什麼」 */
  inputs: {
    users: UsersQueryVariables["input"][];
    createUser: CreateUserMutationVariables["input"][];
    updateUser: UpdateUserMutationVariables["input"][];
    setUserEnabled: SetUserEnabledMutationVariables["input"][];
    setUserOrgs: SetUserOrgsMutationVariables["input"][];
    assignUserRoles: AssignUserRolesMutationVariables["input"][];
  };
}

/**
 * 使用者管理頁的假 api(#136 的 `users` / `user` / 五個 mutation + #134 的 `orgTree` / `org`)。
 * 清單範圍照 ADR-0005:給 `orgId` 就是該組織子樹,不給就是全部;關鍵字比對姓名與 Email。
 */
export const userWorld = (options: UserWorldOptions = {}): UserWorld => {
  const {
    users = [],
    orgTree = [],
    rootOrg,
    pageSize = 10,
    dryRun = { removedOrgs: [], unqualifiedRoles: [] },
    failures = {},
  } = options;

  const inputs: UserWorld["inputs"] = {
    users: [],
    createUser: [],
    updateUser: [],
    setUserEnabled: [],
    setUserOrgs: [],
    assignUserRoles: [],
  };

  const fail = (operation: keyof typeof failures) => {
    const code = failures[operation];
    return code === undefined ? null : graphqlError(code as AuthErrorCode);
  };

  const handlers = [
    api.query("OrgTree", () => HttpResponse.json({ data: { orgTree } })),
    api.query("Org", ({ variables }) => {
      const { id } = variables as OrgQueryVariables;
      if (rootOrg === undefined) {
        return graphqlError("FORBIDDEN", "No org");
      }
      return HttpResponse.json({ data: { org: { ...rootOrg, id } } });
    }),
    api.query("Users", ({ variables }) => {
      const { input } = variables as UsersQueryVariables;
      inputs.users.push(input);
      const scope =
        input.orgId === null || input.orgId === undefined
          ? null
          : subtreeIds(orgTree, input.orgId);
      const needle = (input.keyword ?? "").toLowerCase();
      const matched = users.filter(
        (user) =>
          (scope === null || user.orgs.some((org) => scope.has(org.id))) &&
          (needle === "" ||
            user.name.toLowerCase().includes(needle) ||
            user.email.toLowerCase().includes(needle)),
      );
      const size = input.pageSize ?? pageSize;
      const page = input.page ?? 1;
      return HttpResponse.json({
        data: {
          users: {
            totalCount: matched.length,
            page,
            pageSize: size,
            items: matched
              .slice((page - 1) * size, page * size)
              .map((user) => listItem(user)),
          },
        },
      });
    }),
    api.query("User", ({ variables }) => {
      const { id } = variables as { id: string };
      const user = users.find((item) => item.id === id);
      return user === undefined
        ? graphqlError("FORBIDDEN", "No such user")
        : HttpResponse.json({ data: { user } });
    }),
    api.mutation("CreateUser", ({ variables }) => {
      const { input } = variables as CreateUserMutationVariables;
      inputs.createUser.push(input);
      return (
        fail("CreateUser") ??
        HttpResponse.json({
          data: {
            createUser: {
              user: {
                id: "user-new",
                account: input.account,
                email: input.email,
                mustChangePassword: input.activation.initialPassword !== null,
              },
            },
          },
        })
      );
    }),
    api.mutation("UpdateUser", ({ variables }) => {
      const { input } = variables as UpdateUserMutationVariables;
      inputs.updateUser.push(input);
      const current = users.find((item) => item.id === input.id);
      return (
        fail("UpdateUser") ??
        HttpResponse.json({
          data: { updateUser: { user: { ...current, ...input } } },
        })
      );
    }),
    api.mutation("SetUserEnabled", ({ variables }) => {
      const { input } = variables as SetUserEnabledMutationVariables;
      inputs.setUserEnabled.push(input);
      return (
        fail("SetUserEnabled") ??
        HttpResponse.json({
          data: {
            setUserEnabled: {
              user: { id: input.id, enabled: input.enabled },
            },
          },
        })
      );
    }),
    api.mutation("SetUserOrgs", ({ variables }) => {
      const { input } = variables as SetUserOrgsMutationVariables;
      inputs.setUserOrgs.push(input);
      const user = users.find((item) => item.id === input.userId);
      return (
        fail("SetUserOrgs") ??
        HttpResponse.json({
          data: {
            setUserOrgs: {
              user: {
                id: input.userId,
                orgs: user?.orgs ?? [],
                roles: user?.roles ?? [],
              },
              removedOrgs: dryRun.removedOrgs,
              unqualifiedRoles: dryRun.unqualifiedRoles,
              revokedRoleIds: [],
            },
          },
        })
      );
    }),
    api.mutation("AssignUserRoles", ({ variables }) => {
      const { input } = variables as AssignUserRolesMutationVariables;
      inputs.assignUserRoles.push(input);
      const user = users.find((item) => item.id === input.userId);
      return (
        fail("AssignUserRoles") ??
        HttpResponse.json({
          data: {
            assignUserRoles: {
              user: { id: input.userId, roles: user?.roles ?? [] },
            },
          },
        })
      );
    }),
  ];

  return { handlers, inputs };
};
