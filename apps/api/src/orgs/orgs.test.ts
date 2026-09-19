import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Types } from "mongoose";

import {
  type AuthTestApp,
  ROOT_ADMIN,
  startAuthTestApp,
} from "../auth/test-support/auth-app";
import {
  createOrg,
  createUser,
  findRootOrgId,
} from "../auth/test-support/fixtures";
import { HOOK_TIMEOUT_MS } from "../database/test-support/mongo-connection";
import { createRole, setRoleEnabled } from "../permission/test-support/fixtures";

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
    }
  }
`;

/** 樹的深度:根組織 > 租戶 > 部門 > 子部門 > 再一層,夠本檔的夾具用。 */
const ORG_TREE = /* GraphQL */ `
  fragment NodeFields on OrgNode {
    id
    name
    parentId
    enabled
    outOfScope
  }
  query OrgTree {
    orgTree {
      ...NodeFields
      children {
        ...NodeFields
        children {
          ...NodeFields
          children {
            ...NodeFields
            children {
              ...NodeFields
            }
          }
        }
      }
    }
  }
`;

const ORG = /* GraphQL */ `
  query Org($id: ID!) {
    org(id: $id) {
      id
      name
      description
      parentId
      enabled
      isSystem
      ownerUserId
      visibility
      logoUrl
    }
  }
`;

const CREATE_CHILD_ORG = /* GraphQL */ `
  mutation CreateChildOrg($input: CreateChildOrgInput!) {
    createChildOrg(input: $input) {
      org {
        id
        name
        description
        parentId
        enabled
      }
    }
  }
`;

const UPDATE_ORG = /* GraphQL */ `
  mutation UpdateOrg($input: UpdateOrgInput!) {
    updateOrg(input: $input) {
      org {
        id
        name
        description
        logoUrl
      }
    }
  }
`;

const SET_ORG_ENABLED = /* GraphQL */ `
  mutation SetOrgEnabled($input: SetOrgEnabledInput!) {
    setOrgEnabled(input: $input) {
      org {
        id
        enabled
      }
    }
  }
`;

const MOVE_ORG = /* GraphQL */ `
  mutation MoveOrg($input: MoveOrgInput!) {
    moveOrg(input: $input) {
      org {
        id
        parentId
      }
    }
  }
`;

const SET_ORG_VISIBILITY = /* GraphQL */ `
  mutation SetOrgVisibility($input: SetOrgVisibilityInput!) {
    setOrgVisibility(input: $input) {
      org {
        id
        visibility
      }
    }
  }
`;

const DELETE_ORG = /* GraphQL */ `
  mutation DeleteOrg($input: DeleteOrgInput!) {
    deleteOrg(input: $input) {
      success
      deletedId
    }
  }
`;

interface LoginData {
  login: { accessToken: string };
}

interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  enabled: boolean;
  outOfScope: boolean;
  children?: TreeNode[];
}

interface OrgTreeData {
  orgTree: TreeNode[];
}

interface OrgData {
  org: {
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    enabled: boolean;
    isSystem: boolean;
    ownerUserId: string | null;
    visibility: string | null;
    logoUrl: string | null;
  };
}

interface CreateChildOrgData {
  createChildOrg: {
    org: {
      id: string;
      name: string;
      description: string | null;
      parentId: string;
      enabled: boolean;
    };
  };
}

interface UpdateOrgData {
  updateOrg: {
    org: {
      id: string;
      name: string;
      description: string | null;
      logoUrl: string | null;
    };
  };
}

interface DeleteOrgData {
  deleteOrg: { success: boolean; deletedId: string };
}

interface SetOrgVisibilityData {
  setOrgVisibility: { org: { id: string; visibility: string | null } };
}

interface OrgRow {
  _id: Types.ObjectId;
  name: string;
  parentId: Types.ObjectId | null;
  ancestors: Types.ObjectId[];
  enabled: boolean;
  logoPath?: string;
  ownerUserId?: Types.ObjectId;
  settings: Record<string, unknown>;
  deletedAt: Date | null;
}

interface AuditRow {
  actorId: Types.ObjectId;
  action: string;
  targetType?: string;
  targetId?: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  orgId?: Types.ObjectId;
}

const PASSWORD = ["orgs", "test", "pass"].join("-");
const LOGO_PATH = "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png";
const OTHER_LOGO_PATH = "org-logos/6ba7b810-9dad-11d1-80b4-00c04fd430c8.webp";
const ORG_MANAGER_MODULE = "system.org-manager";

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

function nodeOf(nodes: TreeNode[], id: Types.ObjectId): TreeNode | undefined {
  return flatten(nodes).find((node) => node.id === String(id));
}

describe("組織管理(#134:樹查詢 / 新增子組織 / 編輯 / 停用連動 / 搬移 / 刪除前置;對真 Nest + 真 MongoDB)", () => {
  let api: AuthTestApp;
  let rootOrgId: Types.ObjectId;
  let rootToken: string;
  /** 租戶 A(可見範圍開關 = subtree,讓部門使用者看得到自己的下層) */
  let tenantAId: Types.ObjectId;
  let deptOneId: Types.ObjectId;
  let deptOneSubId: Types.ObjectId;
  let deptTwoId: Types.ObjectId;
  /** 租戶 B(**沒有**可見性開關 = own):驗「管理範圍不受開關影響」 */
  let tenantBId: Types.ObjectId;
  let deptBId: Types.ObjectId;
  /** 租戶 A 的管理員(擁有組織 = 租戶頂層)與部門使用者(擁有組織 = A 部門一) */
  let tenantAdminToken: string;
  let deptUserToken: string;
  /** 租戶 B 的管理員(擁有組織 = 租戶 B 頂層,開關為 own) */
  let tenantBAdminToken: string;
  /** 持兩個沒有共同上層的角色(擁有組織 = A 部門一 / A 部門二):驗多根樹 */
  let multiRootToken: string;
  /** 只靠一個之後會被停用的角色進來:驗「管理範圍只算啟用中角色」 */
  let toggledRoleId: Types.ObjectId;
  let toggledRoleToken: string;
  /**
   * 租戶 C:操作者的**管理範圍與可見範圍刻意不重疊** —
   * 所屬組織是 C 部門一(開關 own → 可見範圍只有它),角色的擁有組織是 C 部門二。
   */
  let cDeptTwoId: Types.ObjectId;
  let crossScopeToken: string;
  /** 有登入、沒有任何角色的使用者 */
  let nobodyToken: string;

  async function loginAccessToken(
    account: string,
    password: string,
  ): Promise<string> {
    const result = await api.graphql<LoginData>(LOGIN, {
      input: { account, password },
    });
    expect(result.errors).toBeUndefined();
    const token = result.data?.login.accessToken;
    if (!token) {
      throw new Error("login 沒有回 accessToken");
    }
    return token;
  }

  /** 讀回 DB 裡的最終狀態(測試只信資料庫,不信回傳值)。 */
  function orgRow(id: Types.ObjectId): Promise<OrgRow | null> {
    return api.connection.collection("orgs").findOne<OrgRow>({ _id: id });
  }

  async function enabledOf(id: Types.ObjectId): Promise<boolean | undefined> {
    const row = await orgRow(id);
    return row?.enabled;
  }

  async function parentIdOf(id: Types.ObjectId): Promise<string | undefined> {
    const row = await orgRow(id);
    return row?.parentId === null || row?.parentId === undefined
      ? undefined
      : String(row.parentId);
  }

  async function deletedAtOf(id: Types.ObjectId): Promise<Date | null> {
    const row = await orgRow(id);
    return row?.deletedAt ?? null;
  }

  async function logoPathOf(id: Types.ObjectId): Promise<string | undefined> {
    const row = await orgRow(id);
    return row?.logoPath;
  }

  async function auditRows(
    action: string,
    targetId: Types.ObjectId,
  ): Promise<AuditRow[]> {
    return api.connection
      .collection("audit_logs")
      .find<AuditRow>({ action, targetId })
      .toArray();
  }

  /** 建一個新的空組織掛在租戶 A 底下(每個會寫入的測試各自用一棵,避免互踩)。 */
  function newOrgUnderTenantA(name: string): Promise<Types.ObjectId> {
    return createOrg(api.connection, { name, parentId: tenantAId });
  }

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-orgs");
    rootOrgId = await findRootOrgId(api.connection);
    rootToken = await loginAccessToken(ROOT_ADMIN.account, ROOT_ADMIN.password);

    tenantAId = await createOrg(api.connection, {
      name: "租戶A",
      settings: { visibility: "subtree" },
    });
    tenantBId = await createOrg(api.connection, { name: "租戶B" });
    deptBId = await createOrg(api.connection, {
      name: "B 部門",
      parentId: tenantBId,
    });
    deptOneId = await createOrg(api.connection, {
      name: "A 部門一",
      parentId: tenantAId,
    });
    deptOneSubId = await createOrg(api.connection, {
      name: "A 部門一之一",
      parentId: deptOneId,
    });
    deptTwoId = await createOrg(api.connection, {
      name: "A 部門二",
      parentId: tenantAId,
    });

    const tenantAdminId = await createUser(api.connection, {
      account: "orgs-tenant-admin",
      password: PASSWORD,
      orgIds: [tenantAId],
    });
    await createRole(api.app, api.connection, {
      name: "租戶A 組織管理員",
      ownerOrgId: tenantAId,
      moduleKeys: [ORG_MANAGER_MODULE],
      permissionKeys: [`${ORG_MANAGER_MODULE}.*`],
      assignTo: [tenantAdminId],
    });
    tenantAdminToken = await loginAccessToken("orgs-tenant-admin", PASSWORD);

    const deptUserId = await createUser(api.connection, {
      account: "orgs-dept-user",
      password: PASSWORD,
      orgIds: [deptOneId],
    });
    await createRole(api.app, api.connection, {
      name: "A 部門一 檢視者",
      ownerOrgId: deptOneId,
      moduleKeys: [ORG_MANAGER_MODULE],
      permissionKeys: [`${ORG_MANAGER_MODULE}.view`],
      assignTo: [deptUserId],
    });
    deptUserToken = await loginAccessToken("orgs-dept-user", PASSWORD);

    // 租戶 B 的管理員:所屬組織是 B 部門(不是頂層),角色的擁有組織才是租戶 B 頂層 —
    // 管理範圍由角色決定、與所屬哪裡無關(ADR-0003),而租戶 B 的可見性開關是 own
    const tenantBAdminId = await createUser(api.connection, {
      account: "orgs-tenant-b-admin",
      password: PASSWORD,
      orgIds: [deptBId],
    });
    await createRole(api.app, api.connection, {
      name: "租戶B 組織管理員",
      ownerOrgId: tenantBId,
      moduleKeys: [ORG_MANAGER_MODULE],
      permissionKeys: [`${ORG_MANAGER_MODULE}.*`],
      assignTo: [tenantBAdminId],
    });
    tenantBAdminToken = await loginAccessToken("orgs-tenant-b-admin", PASSWORD);

    // 兩個沒有共同上層的角色 → 管理範圍是兩棵子樹的聯集 → 樹有兩個根
    const multiRootId = await createUser(api.connection, {
      account: "orgs-multi-root",
      password: PASSWORD,
      orgIds: [tenantAId],
    });
    for (const [name, ownerOrgId] of [
      ["A 部門一 檢視者(多根)", deptOneId],
      ["A 部門二 檢視者(多根)", deptTwoId],
    ] as const) {
      await createRole(api.app, api.connection, {
        name,
        ownerOrgId,
        moduleKeys: [ORG_MANAGER_MODULE],
        permissionKeys: [`${ORG_MANAGER_MODULE}.view`],
        assignTo: [multiRootId],
      });
    }
    multiRootToken = await loginAccessToken("orgs-multi-root", PASSWORD);

    const toggledId = await createUser(api.connection, {
      account: "orgs-toggled-role",
      password: PASSWORD,
      orgIds: [tenantAId],
    });
    toggledRoleId = await createRole(api.app, api.connection, {
      name: "A 部門二 檢視者(可停用)",
      ownerOrgId: deptTwoId,
      moduleKeys: [ORG_MANAGER_MODULE],
      permissionKeys: [`${ORG_MANAGER_MODULE}.view`],
      assignTo: [toggledId],
    });
    toggledRoleToken = await loginAccessToken("orgs-toggled-role", PASSWORD);

    const tenantCId = await createOrg(api.connection, { name: "租戶C" });
    const cDeptOneId = await createOrg(api.connection, {
      name: "C 部門一",
      parentId: tenantCId,
    });
    cDeptTwoId = await createOrg(api.connection, {
      name: "C 部門二",
      parentId: tenantCId,
    });
    const crossScopeId = await createUser(api.connection, {
      account: "orgs-cross-scope",
      password: PASSWORD,
      orgIds: [cDeptOneId],
    });
    await createRole(api.app, api.connection, {
      name: "C 部門二 管理員",
      ownerOrgId: cDeptTwoId,
      moduleKeys: [ORG_MANAGER_MODULE],
      permissionKeys: [`${ORG_MANAGER_MODULE}.*`],
      assignTo: [crossScopeId],
    });
    crossScopeToken = await loginAccessToken("orgs-cross-scope", PASSWORD);

    await createUser(api.connection, {
      account: "orgs-nobody",
      password: PASSWORD,
      orgIds: [tenantAId],
    });
    nobodyToken = await loginAccessToken("orgs-nobody", PASSWORD);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  describe("orgTree:管理範圍與視角(CONTEXT.md「管理範圍」;ADR-0003 / ADR-0005)", () => {
    it("根組織視角:以根組織為根,看得到全部租戶,沒有節點被標 outOfScope", async () => {
      const result = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: rootToken },
      );

      expect(result.errors).toBeUndefined();
      const tree = result.data?.orgTree ?? [];
      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe(String(rootOrgId));
      expect(tree[0]?.parentId).toBeNull();
      const all = flatten(tree);
      expect(all.map((node) => node.id)).toEqual(
        expect.arrayContaining([String(tenantAId), String(tenantBId)]),
      );
      expect(all.every((node) => !node.outOfScope)).toBe(true);
    });

    it("租戶視角:樹根 = 角色的擁有組織(租戶頂層),看不到別的租戶", async () => {
      const result = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: tenantAdminToken },
      );

      expect(result.errors).toBeUndefined();
      const tree = result.data?.orgTree ?? [];
      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe(String(tenantAId));
      // `parentId` 一律是真的上層,即使它不在樹上 — 前端靠它分得出「平台根組織」與「租戶頂層」
      expect(tree[0]?.parentId).toBe(String(rootOrgId));
      const ids = flatten(tree).map((node) => node.id);
      expect(ids).toEqual(
        expect.arrayContaining([String(deptOneId), String(deptOneSubId)]),
      );
      expect(ids).not.toContain(String(tenantBId));
      expect(ids).not.toContain(String(rootOrgId));
    });

    it("擁有組織 = 部門的角色:樹根 = 該部門,租戶頂層與別的部門都不在樹上(不再有 outOfScope 節點)", async () => {
      const result = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: deptUserToken },
      );

      expect(result.errors).toBeUndefined();
      const tree = result.data?.orgTree ?? [];
      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe(String(deptOneId));
      expect(tree[0]?.parentId).toBe(String(tenantAId));
      // 管理範圍外的組織不回傳(#187:`outOfScope` 的灰節點取消)
      expect(nodeOf(tree, tenantAId)).toBeUndefined();
      expect(nodeOf(tree, deptTwoId)).toBeUndefined();
      // 自己這棵子樹完整
      expect(nodeOf(tree, deptOneSubId)?.outOfScope).toBe(false);
      expect(flatten(tree).every((node) => !node.outOfScope)).toBe(true);
    });

    it("租戶管理員在可見性開關為 own 時仍管得到整個租戶(管理範圍不看開關,ADR-0005)", async () => {
      // 租戶 B 沒設 settings.visibility(= own),且這位管理員的所屬組織只有 B 部門
      const tenantB = await orgRow(tenantBId);
      expect(tenantB?.settings.visibility).toBeUndefined();

      const result = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: tenantBAdminToken },
      );

      expect(result.errors).toBeUndefined();
      const tree = result.data?.orgTree ?? [];
      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe(String(tenantBId));
      expect(nodeOf(tree, deptBId)).toBeDefined();
      expect(nodeOf(tree, tenantAId)).toBeUndefined();
    });

    it("多根:持有兩個沒有共同上層的角色 → 兩個樹根,各自的子樹完整", async () => {
      const result = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: multiRootToken },
      );

      expect(result.errors).toBeUndefined();
      const tree = result.data?.orgTree ?? [];
      expect(new Set(tree.map((node) => node.id))).toEqual(
        new Set([String(deptOneId), String(deptTwoId)]),
      );
      // 兩個根都指向自己真正的上層(租戶頂層),即使它不在樹上
      expect(tree.every((node) => node.parentId === String(tenantAId))).toBe(
        true,
      );
      expect(nodeOf(tree, deptOneSubId)).toBeDefined();
      // 共同上層(租戶頂層)不是任何一個角色的擁有組織,不進樹
      expect(nodeOf(tree, tenantAId)).toBeUndefined();
    });

    it("管理範圍只算**啟用中**的角色:停用唯一的角色後,治理端點整個關上", async () => {
      const before = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: toggledRoleToken },
      );
      expect(before.data?.orgTree.map((node) => node.id)).toEqual([
        String(deptTwoId),
      ]);

      await setRoleEnabled(api.connection, toggledRoleId, false);
      const after = await api.graphql(
        ORG_TREE,
        {},
        { accessToken: toggledRoleToken },
      );
      // 停用的角色不給權限也不給管理範圍(ADR-0011 步驟 2):先撞到權限這一關
      expect(after.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
      await setRoleEnabled(api.connection, toggledRoleId, true);
    });

    it("沒有 view 權限進不來:FORBIDDEN;沒登入:UNAUTHENTICATED", async () => {
      const forbidden = await api.graphql(
        ORG_TREE,
        {},
        { accessToken: nobodyToken },
      );
      expect(forbidden.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

      const anonymous = await api.graphql(ORG_TREE);
      expect(anonymous.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("org(id):單筆", () => {
    it("回名稱 / 描述 / 狀態 / 擁有者 / 可見範圍開關;租戶頂層的 visibility 有值", async () => {
      const result = await api.graphql<OrgData>(
        ORG,
        { id: String(tenantAId) },
        { accessToken: rootToken },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.org).toMatchObject({
        id: String(tenantAId),
        name: "租戶A",
        parentId: String(rootOrgId),
        enabled: true,
        isSystem: false,
        ownerUserId: null,
        visibility: "SUBTREE",
        logoUrl: null,
      });
    });

    it("非租戶頂層的 visibility 為 null(開關只掛在租戶頂層)", async () => {
      const result = await api.graphql<OrgData>(
        ORG,
        { id: String(deptOneId) },
        { accessToken: rootToken },
      );
      expect(result.data?.org.visibility).toBeNull();
    });

    it("管理範圍外的組織視為不存在:NOT_FOUND", async () => {
      const result = await api.graphql(
        ORG,
        { id: String(tenantBId) },
        { accessToken: tenantAdminToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");
    });
  });

  describe("createChildOrg", () => {
    it("掛在選中的組織下、ancestors 續上,並留一筆 org.create-child 審計", async () => {
      const result = await api.graphql<CreateChildOrgData>(
        CREATE_CHILD_ORG,
        {
          input: {
            parentId: String(deptOneId),
            name: "  新小組  ",
            description: "描述",
          },
        },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors).toBeUndefined();
      const created = result.data?.createChildOrg.org;
      expect(created).toMatchObject({
        name: "新小組",
        description: "描述",
        parentId: String(deptOneId),
        enabled: true,
      });
      const createdId = new Types.ObjectId(created?.id);
      const row = await orgRow(createdId);
      expect(row?.ancestors.map(String)).toEqual([
        String(rootOrgId),
        String(tenantAId),
        String(deptOneId),
      ]);

      const audits = await auditRows("org.create-child", createdId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        targetType: "org",
        after: { name: "新小組", parentId: String(deptOneId) },
      });
      expect(audits[0]?.orgId).toBeDefined();
    });

    it("名稱只有空白:VALIDATION_FAILED", async () => {
      const result = await api.graphql(
        CREATE_CHILD_ORG,
        { input: { parentId: String(deptOneId), name: " ".repeat(3) } },
        { accessToken: tenantAdminToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("VALIDATION_FAILED");
    });

    it("上層在可見範圍外:NOT_FOUND;只有 view 權限:FORBIDDEN", async () => {
      const crossTenant = await api.graphql(
        CREATE_CHILD_ORG,
        { input: { parentId: String(tenantBId), name: "偷建" } },
        { accessToken: tenantAdminToken },
      );
      expect(crossTenant.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");

      const viewOnly = await api.graphql(
        CREATE_CHILD_ORG,
        { input: { parentId: String(deptOneId), name: "偷建" } },
        { accessToken: deptUserToken },
      );
      expect(viewOnly.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    });
  });

  describe("updateOrg", () => {
    it("改名稱 / 描述 / 商標,審計的 before / after 只放有變的欄位", async () => {
      const orgId = await newOrgUnderTenantA("待編輯");
      const result = await api.graphql<UpdateOrgData>(
        UPDATE_ORG,
        {
          input: {
            id: String(orgId),
            name: "已編輯",
            description: "新描述",
            logoPath: LOGO_PATH,
          },
        },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateOrg.org).toMatchObject({
        name: "已編輯",
        description: "新描述",
      });
      // 商標對外只給簽名網址(ADR-0010),DB 存路徑
      expect(result.data?.updateOrg.org.logoUrl).toContain(LOGO_PATH);
      expect(await logoPathOf(orgId)).toBe(LOGO_PATH);

      const audits = await auditRows("org.edit", orgId);
      expect(audits).toHaveLength(1);
      expect(audits[0]?.before).toEqual({
        name: "待編輯",
        description: null,
        logoPath: null,
      });
      expect(audits[0]?.after).toEqual({
        name: "已編輯",
        description: "新描述",
        logoPath: LOGO_PATH,
      });
    });

    it("只送有變的欄位:沒變的不進審計;完全沒變則不留審計", async () => {
      const orgId = await newOrgUnderTenantA("局部編輯");
      await api.graphql(
        UPDATE_ORG,
        { input: { id: String(orgId), name: "局部編輯", description: "只改這個" } },
        { accessToken: tenantAdminToken },
      );
      const afterFirst = await auditRows("org.edit", orgId);
      expect(afterFirst).toHaveLength(1);
      expect(afterFirst[0]?.after).toEqual({ description: "只改這個" });

      await api.graphql(
        UPDATE_ORG,
        { input: { id: String(orgId), name: "局部編輯" } },
        { accessToken: tenantAdminToken },
      );
      expect(await auditRows("org.edit", orgId)).toHaveLength(1);
    });

    it("描述 / 商標給 null 是清空", async () => {
      const orgId = await newOrgUnderTenantA("待清空");
      await api.graphql(
        UPDATE_ORG,
        {
          input: {
            id: String(orgId),
            description: "先有描述",
            logoPath: OTHER_LOGO_PATH,
          },
        },
        { accessToken: tenantAdminToken },
      );
      const result = await api.graphql<UpdateOrgData>(
        UPDATE_ORG,
        { input: { id: String(orgId), description: null, logoPath: null } },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateOrg.org.description).toBeNull();
      expect(result.data?.updateOrg.org.logoUrl).toBeNull();
      const row = await orgRow(orgId);
      expect(row?.logoPath).toBeUndefined();
    });

    it("logoPath 不是 createUploadUrl 簽出來的路徑:VALIDATION_FAILED,資料不動", async () => {
      const orgId = await newOrgUnderTenantA("壞商標");
      const result = await api.graphql(
        UPDATE_ORG,
        { input: { id: String(orgId), logoPath: "secrets/passwords.png" } },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors?.[0]?.extensions?.code).toBe("VALIDATION_FAILED");
      expect(await logoPathOf(orgId)).toBeUndefined();
    });

    it("動不到擁有者與可見範圍開關(那是租戶作業 #135:input 根本沒有這兩個欄位)", async () => {
      const ownerUserId = new Types.ObjectId();
      await api.connection
        .collection("orgs")
        .updateOne({ _id: tenantAId }, { $set: { ownerUserId } });

      const rejected = await api.graphql(
        /* GraphQL */ `
          mutation UpdateOrgOwner($input: UpdateOrgInput!) {
            updateOrg(input: $input) {
              org {
                id
              }
            }
          }
        `,
        {
          input: {
            id: String(tenantAId),
            ownerUserId: String(new Types.ObjectId()),
          },
        },
        { accessToken: tenantAdminToken },
      );
      // schema 沒有這個欄位 → GraphQL 驗證階段就擋掉
      expect(rejected.errors?.[0]?.message).toContain("ownerUserId");

      await api.graphql(
        UPDATE_ORG,
        { input: { id: String(tenantAId), name: "租戶A" } },
        { accessToken: tenantAdminToken },
      );
      const row = await orgRow(tenantAId);
      expect(String(row?.ownerUserId)).toBe(String(ownerUserId));
      expect(row?.settings.visibility).toBe("subtree");
    });
  });

  describe("setOrgEnabled:停用連動子樹", () => {
    it("停用連動整棵子樹;啟用只啟用自己這一節", async () => {
      const branchId = await newOrgUnderTenantA("連動測試");
      const childId = await createOrg(api.connection, {
        name: "連動子",
        parentId: branchId,
      });
      const grandChildId = await createOrg(api.connection, {
        name: "連動孫",
        parentId: childId,
      });

      const turnedOff = await api.graphql(
        SET_ORG_ENABLED,
        { input: { id: String(branchId), enabled: false } },
        { accessToken: tenantAdminToken },
      );
      expect(turnedOff.errors).toBeUndefined();
      expect(await enabledOf(branchId)).toBe(false);
      expect(await enabledOf(childId)).toBe(false);
      expect(await enabledOf(grandChildId)).toBe(false);
      // 別的子樹不受影響
      expect(await enabledOf(deptTwoId)).toBe(true);

      const enabled = await api.graphql(
        SET_ORG_ENABLED,
        { input: { id: String(branchId), enabled: true } },
        { accessToken: tenantAdminToken },
      );
      expect(enabled.errors).toBeUndefined();
      expect(await enabledOf(branchId)).toBe(true);
      expect(await enabledOf(childId)).toBe(false);

      const audits = await auditRows("org.toggle-enabled", branchId);
      expect(audits).toHaveLength(2);
      expect(audits[0]).toMatchObject({
        before: { enabled: true },
        after: { enabled: false, cascadedDescendants: 2 },
      });
      expect(audits[1]).toMatchObject({
        before: { enabled: false },
        after: { enabled: true },
      });
    });

    it("根組織不可停用:VALIDATION_FAILED", async () => {
      const result = await api.graphql(
        SET_ORG_ENABLED,
        { input: { id: String(rootOrgId), enabled: false } },
        { accessToken: rootToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("VALIDATION_FAILED");
      expect(await enabledOf(rootOrgId)).toBe(true);
    });
  });

  describe("moveOrg", () => {
    it("同租戶搬移:自己與整棵子樹的 ancestors 重算,留一筆 org.move", async () => {
      const branchId = await newOrgUnderTenantA("待搬");
      const childId = await createOrg(api.connection, {
        name: "待搬子",
        parentId: branchId,
      });

      const result = await api.graphql(
        MOVE_ORG,
        { input: { id: String(branchId), newParentId: String(deptTwoId) } },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors).toBeUndefined();
      const moved = await orgRow(branchId);
      expect(String(moved?.parentId)).toBe(String(deptTwoId));
      expect(moved?.ancestors.map(String)).toEqual([
        String(rootOrgId),
        String(tenantAId),
        String(deptTwoId),
      ]);
      const child = await orgRow(childId);
      expect(child?.ancestors.map(String)).toEqual([
        String(rootOrgId),
        String(tenantAId),
        String(deptTwoId),
        String(branchId),
      ]);

      const audits = await auditRows("org.move", branchId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        before: { parentId: String(tenantAId) },
        after: { parentId: String(deptTwoId), movedDescendants: 1 },
      });
    });

    it("搬進自己的子樹:CYCLIC_MOVE(搬到自己身上也是)", async () => {
      const intoSubtree = await api.graphql(
        MOVE_ORG,
        { input: { id: String(deptOneId), newParentId: String(deptOneSubId) } },
        { accessToken: tenantAdminToken },
      );
      expect(intoSubtree.errors?.[0]?.extensions?.code).toBe("CYCLIC_MOVE");

      const ontoItself = await api.graphql(
        MOVE_ORG,
        { input: { id: String(deptOneId), newParentId: String(deptOneId) } },
        { accessToken: tenantAdminToken },
      );
      expect(ontoItself.errors?.[0]?.extensions?.code).toBe("CYCLIC_MOVE");
      expect(await parentIdOf(deptOneId)).toBe(
        String(tenantAId),
      );
    });

    it("跨租戶搬移:CROSS_TENANT(根組織看得到兩邊也不准)", async () => {
      const result = await api.graphql(
        MOVE_ORG,
        { input: { id: String(deptOneId), newParentId: String(tenantBId) } },
        { accessToken: rootToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("CROSS_TENANT");
      expect(await parentIdOf(deptOneId)).toBe(
        String(tenantAId),
      );
    });

    it("租戶頂層不可搬:租戶內的人即使管得到整個租戶也拒(FORBIDDEN;只有根組織能動租戶頂層)", async () => {
      const result = await api.graphql(
        MOVE_ORG,
        { input: { id: String(tenantAId), newParentId: String(deptOneId) } },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
      expect(await parentIdOf(tenantAId)).toBe(String(rootOrgId));
    });

    it("新上層在管理範圍外:NOT_FOUND(候選 = 管理範圍 ∩ 同租戶 − 自己的子樹)", async () => {
      const result = await api.graphql(
        MOVE_ORG,
        { input: { id: String(deptOneId), newParentId: String(tenantBId) } },
        { accessToken: tenantAdminToken },
      );

      // 範圍外不透露「存在但跨租戶」,一律當不存在
      expect(result.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");
      expect(await parentIdOf(deptOneId)).toBe(String(tenantAId));
    });

    it("把租戶頂層搬到根組織下也算跨租戶:CROSS_TENANT;根組織自己不可搬:VALIDATION_FAILED", async () => {
      const tenantToTenant = await api.graphql(
        MOVE_ORG,
        { input: { id: String(tenantAId), newParentId: String(tenantBId) } },
        { accessToken: rootToken },
      );
      expect(tenantToTenant.errors?.[0]?.extensions?.code).toBe("CROSS_TENANT");

      const rootMove = await api.graphql(
        MOVE_ORG,
        { input: { id: String(rootOrgId), newParentId: String(tenantAId) } },
        { accessToken: rootToken },
      );
      expect(rootMove.errors?.[0]?.extensions?.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("setOrgVisibility:權限搬到組織管理層、範圍由管理範圍決定(#187 / ADR-0005)", () => {
    it("租戶管理員設得了自己租戶的頂層(不再是根組織專屬):DB 寫入 + 審計", async () => {
      const result = await api.graphql<SetOrgVisibilityData>(
        SET_ORG_VISIBILITY,
        { input: { orgId: String(tenantBId), visibility: "SUBTREE" } },
        { accessToken: tenantBAdminToken },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.setOrgVisibility.org.visibility).toBe("SUBTREE");
      const stored = await orgRow(tenantBId);
      expect(stored?.settings.visibility).toBe("subtree");

      const audits = await auditRows("org.set-visibility", tenantBId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        before: { visibility: "OWN" },
        after: { visibility: "SUBTREE" },
      });
    });

    it("設別的租戶的頂層:管理範圍外 → NOT_FOUND,資料不動", async () => {
      const result = await api.graphql(
        SET_ORG_VISIBILITY,
        { input: { orgId: String(tenantAId), visibility: "OWN" } },
        { accessToken: tenantBAdminToken },
      );

      expect(result.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");
      const untouched = await orgRow(tenantAId);
      expect(untouched?.settings.visibility).toBe("subtree");
    });

    it("對象不是租戶頂層:VALIDATION_FAILED(開關只掛租戶頂層)", async () => {
      const result = await api.graphql(
        SET_ORG_VISIBILITY,
        { input: { orgId: String(deptBId), visibility: "SUBTREE" } },
        { accessToken: tenantBAdminToken },
      );

      expect(result.errors?.[0]?.extensions?.code).toBe("VALIDATION_FAILED");
    });

    it("沒有 set-visibility 權限:FORBIDDEN(只有 view 的人連開關都送不出去)", async () => {
      const result = await api.graphql(
        SET_ORG_VISIBILITY,
        { input: { orgId: String(tenantAId), visibility: "OWN" } },
        { accessToken: deptUserToken },
      );

      expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    });
  });

  describe("deleteOrg:前置檢查(四項)與軟刪除", () => {
    it("有子組織:ORG_NOT_DELETABLE,reasons 含 HAS_CHILDREN", async () => {
      const parentId = await newOrgUnderTenantA("有子組織");
      await createOrg(api.connection, { name: "子", parentId });

      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(parentId) } },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors?.[0]?.extensions?.code).toBe("ORG_NOT_DELETABLE");
      expect(result.errors?.[0]?.extensions).toMatchObject({
        reasons: ["HAS_CHILDREN"],
      });
      expect(await deletedAtOf(parentId)).toBeNull();
    });

    it("有成員:reasons 含 HAS_MEMBERS", async () => {
      const orgId = await newOrgUnderTenantA("有成員");
      await createUser(api.connection, {
        account: "orgs-member",
        password: PASSWORD,
        orgIds: [orgId],
      });

      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(orgId) } },
        { accessToken: tenantAdminToken },
      );
      expect(result.errors?.[0]?.extensions).toMatchObject({
        code: "ORG_NOT_DELETABLE",
        reasons: ["HAS_MEMBERS"],
      });
    });

    it("是角色的擁有組織:reasons 含 OWNS_ROLES", async () => {
      const orgId = await newOrgUnderTenantA("有角色");
      await createRole(api.app, api.connection, {
        name: "掛在這個組織的角色",
        ownerOrgId: orgId,
      });

      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(orgId) } },
        { accessToken: tenantAdminToken },
      );
      expect(result.errors?.[0]?.extensions).toMatchObject({
        code: "ORG_NOT_DELETABLE",
        reasons: ["OWNS_ROLES"],
      });
    });

    it("還有業務資料掛著:reasons 含 HAS_BUSINESS_DATA", async () => {
      const orgId = await newOrgUnderTenantA("有業務資料");
      const now = new Date();
      await api.connection.collection("customers").insertOne({
        name: "會員",
        account: "orgs-customer",
        email: "orgs-customer@example.com",
        orgId,
        enabled: true,
        settings: {},
        createdAt: now,
        updatedAt: now,
        createdBy: null,
        updatedBy: null,
        deletedAt: null,
      });

      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(orgId) } },
        { accessToken: tenantAdminToken },
      );
      expect(result.errors?.[0]?.extensions).toMatchObject({
        code: "ORG_NOT_DELETABLE",
        reasons: ["HAS_BUSINESS_DATA"],
      });
    });

    it("業務資料的前置檢查不吃操作者的可見範圍:管得到、看不到的組織照樣擋得下來", async () => {
      // 這位操作者的管理範圍是 C 部門二子樹,可見範圍只有 C 部門一(開關 own)—
      // 若用可見範圍去數業務資料,這一筆會數成 0,還掛著會員的組織就被誤判成可刪
      const orgId = await createOrg(api.connection, {
        name: "C 部門二之一",
        parentId: cDeptTwoId,
      });
      const now = new Date();
      await api.connection.collection("customers").insertOne({
        name: "C 會員",
        account: "orgs-c-customer",
        email: "orgs-c-customer@example.com",
        orgId,
        enabled: true,
        settings: {},
        createdAt: now,
        updatedAt: now,
        createdBy: null,
        updatedBy: null,
        deletedAt: null,
      });

      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(orgId) } },
        { accessToken: crossScopeToken },
      );

      expect(result.errors?.[0]?.extensions).toMatchObject({
        code: "ORG_NOT_DELETABLE",
        reasons: ["HAS_BUSINESS_DATA"],
      });
      expect(await deletedAtOf(orgId)).toBeNull();
    });

    it("根組織不可刪:reasons 含 SYSTEM_ORG", async () => {
      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(rootOrgId) } },
        { accessToken: rootToken },
      );
      const reasons = (
        result.errors?.[0]?.extensions as { reasons?: string[] } | undefined
      )?.reasons;
      expect(result.errors?.[0]?.extensions?.code).toBe("ORG_NOT_DELETABLE");
      expect(reasons).toContain("SYSTEM_ORG");
    });

    it("前置全過:軟刪除(資料留著、樹上消失),留一筆 org.delete 審計", async () => {
      const orgId = await newOrgUnderTenantA("可刪除");

      const result = await api.graphql<DeleteOrgData>(
        DELETE_ORG,
        { input: { id: String(orgId) } },
        { accessToken: tenantAdminToken },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.deleteOrg).toEqual({
        success: true,
        deletedId: String(orgId),
      });
      const row = await orgRow(orgId);
      expect(row).not.toBeNull();
      expect(row?.deletedAt).toBeInstanceOf(Date);

      const tree = await api.graphql<OrgTreeData>(
        ORG_TREE,
        {},
        { accessToken: tenantAdminToken },
      );
      expect(nodeOf(tree.data?.orgTree ?? [], orgId)).toBeUndefined();

      const audits = await auditRows("org.delete", orgId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        targetType: "org",
        before: { name: "可刪除", parentId: String(tenantAId) },
      });
    });

    it("只有 view 權限刪不了:FORBIDDEN", async () => {
      const orgId = await newOrgUnderTenantA("權限不足");
      const result = await api.graphql(
        DELETE_ORG,
        { input: { id: String(orgId) } },
        { accessToken: deptUserToken },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
      expect(await deletedAtOf(orgId)).toBeNull();
    });
  });

  describe("審計:每個寫入動作都記在操作者身上", () => {
    it("actorId 是操作者、orgId 是操作者的當前組織", async () => {
      const created = await api.graphql<CreateChildOrgData>(
        CREATE_CHILD_ORG,
        { input: { parentId: String(deptTwoId), name: "審計對象" } },
        { accessToken: tenantAdminToken },
      );
      const createdId = new Types.ObjectId(created.data?.createChildOrg.org.id);
      const [audit] = await auditRows("org.create-child", createdId);

      const actor = await api.connection
        .collection("users")
        .findOne<{ _id: Types.ObjectId }>({ account: "orgs-tenant-admin" });
      expect(String(audit?.actorId)).toBe(String(actor?._id));
      expect(String(audit?.orgId)).toBe(String(tenantAId));
    });
  });
});
