import { graphql, graphqlOk } from "./graphql";

/**
 * 前置資料要用到的 GraphQL 操作(正本是 `packages/graphql/src/documents/*.graphql`,
 * 這裡只抄 e2e 需要的欄位)。新增操作時對照那份文件,不要憑印象補欄位。
 */

const LOGIN = `
mutation Login($input: LoginInput!) {
  login(input: $input) { accessToken }
}`;

const SET_PASSWORD = `
mutation SetPassword($input: SetPasswordInput!) {
  setPassword(input: $input) { accessToken }
}`;

const CHANGE_PASSWORD = `
mutation ChangePassword($input: ChangePasswordInput!) {
  changePassword(input: $input) { success }
}`;

const TENANT_MODULE_OPTIONS = `
query TenantModuleOptions { tenantModuleOptions { key } }`;

const PROVISION_TENANT = `
mutation ProvisionTenant($input: ProvisionTenantInput!) {
  provisionTenant(input: $input) { org { id name } ownerUserId roleId }
}`;

const CREATE_CHILD_ORG = `
mutation CreateChildOrg($input: CreateChildOrgInput!) {
  createChildOrg(input: $input) { org { id name } }
}`;

const CREATE_USER = `
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) { user { id account } }
}`;

const SET_USER_ORGS = `
mutation SetUserOrgs($input: SetUserOrgsInput!) {
  setUserOrgs(input: $input) { user { id orgs { id name } } }
}`;

const CREATE_ROLE = `
mutation CreateRole($input: CreateRoleInput!) {
  createRole(input: $input) { role { id name } }
}`;

const MATRIX_NODE = `
  id key name
  permissions { key action }`;

const ROLE_MATRIX = `
query RoleMatrix($roleId: ID!) {
  roleMatrix(roleId: $roleId) {
    granted { moduleKeys permissionKeys }
    modules {
      ${MATRIX_NODE}
      children {
        ${MATRIX_NODE}
        children {
          ${MATRIX_NODE}
          children { ${MATRIX_NODE} }
        }
      }
    }
  }
}`;

const SAVE_ROLE_MATRIX = `
mutation SaveRoleMatrix($input: SaveRoleMatrixInput!) {
  saveRoleMatrix(input: $input) { granted { moduleKeys permissionKeys } }
}`;

const GRANT_ROLE_USERS = `
mutation GrantRoleUsers($input: GrantRoleUsersInput!) {
  grantRoleUsers(input: $input) { totalCount }
}`;

const SWITCH_ORG = `
mutation SwitchOrg($input: SwitchOrgInput!) {
  switchOrg(input: $input) { accessToken }
}`;

const CREATE_DEMO_ITEM_ONE = `
mutation CreateDemoItemOne($input: CreateDemoItemOneInput!) {
  createDemoItemOne(input: $input) { item { id name } }
}`;

const CREATE_DEMO_ITEM_TWO = `
mutation CreateDemoItemTwo($input: CreateDemoItemTwoInput!) {
  createDemoItemTwo(input: $input) { item { id name } }
}`;

const SET_DEMO_ITEM_ONE_STATUS = `
mutation UpdateDemoItemOne($input: UpdateDemoItemOneInput!) {
  updateDemoItemOne(input: $input) { item { id status } }
}`;

const SAVE_DATA_SCOPE_RULE = `
mutation SaveDataScopeRule($input: SaveDataScopeRuleInput!) {
  saveDataScopeRule(input: $input) {
    rule {
      collection
      combineOp
      rules { audience { type ids } filter }
    }
  }
}`;

const UPDATE_DEMO_ITEM_ONE = `
mutation UpdateDemoItemOne($input: UpdateDemoItemOneInput!) {
  updateDemoItemOne(input: $input) { item { id name internalNote } }
}`;

const DEMO_ITEM_ONE_HISTORY = `
query DemoItemOneHistory($id: ID!) {
  demoItemOneHistory(id: $id) {
    items { id action before after createdAt }
    totalCount
  }
}`;

export interface MatrixPermission {
  key: string;
  action: string;
}

export interface MatrixModule {
  id: string;
  key: string;
  name: string;
  permissions: MatrixPermission[];
  children?: MatrixModule[];
}

export interface RoleGrant {
  moduleKeys: string[];
  permissionKeys: string[];
}

export async function login(
  account: string,
  password: string,
): Promise<string> {
  const data = await graphqlOk<{ login: { accessToken: string } }>(LOGIN, {
    input: { account, password },
  });
  return data.login.accessToken;
}

/** 啟用信 / 重設信共用;成功直接回登入 token(免再登入一次)。 */
export async function setPassword(
  token: string,
  password: string,
): Promise<string> {
  const data = await graphqlOk<{ setPassword: { accessToken: string } }>(
    SET_PASSWORD,
    { input: { token, newPassword: password } },
  );
  return data.setPassword.accessToken;
}

/** 清掉首登強改旗標(`activation: PASSWORD` 建出來的帳號一律帶著它)。 */
export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await graphqlOk(
    CHANGE_PASSWORD,
    { input: { currentPassword, newPassword } },
    accessToken,
  );
}

export async function tenantModuleOptionKeys(
  accessToken: string,
): Promise<string[]> {
  const data = await graphqlOk<{ tenantModuleOptions: { key: string }[] }>(
    TENANT_MODULE_OPTIONS,
    {},
    accessToken,
  );
  return data.tenantModuleOptions.map((module) => module.key);
}

export interface ProvisionTenantResult {
  orgId: string;
  ownerUserId: string;
  roleId: string;
}

export async function provisionTenant(
  accessToken: string,
  input: {
    name: string;
    adminAccount: string;
    adminEmail: string;
    moduleKeys: readonly string[];
  },
): Promise<ProvisionTenantResult> {
  const data = await graphqlOk<{
    provisionTenant: {
      org: { id: string };
      ownerUserId: string;
      roleId: string;
    };
  }>(PROVISION_TENANT, { input }, accessToken);
  return {
    orgId: data.provisionTenant.org.id,
    ownerUserId: data.provisionTenant.ownerUserId,
    roleId: data.provisionTenant.roleId,
  };
}

export async function createChildOrg(
  accessToken: string,
  parentId: string,
  name: string,
): Promise<string> {
  const data = await graphqlOk<{ createChildOrg: { org: { id: string } } }>(
    CREATE_CHILD_ORG,
    { input: { parentId, name } },
    accessToken,
  );
  return data.createChildOrg.org.id;
}

export async function createUserWithPassword(
  accessToken: string,
  input: {
    account: string;
    name: string;
    email: string;
    orgIds: readonly string[];
    initialPassword: string;
  },
): Promise<string> {
  const data = await graphqlOk<{ createUser: { user: { id: string } } }>(
    CREATE_USER,
    {
      input: {
        account: input.account,
        name: input.name,
        email: input.email,
        orgIds: input.orgIds,
        activation: {
          mode: "PASSWORD",
          initialPassword: input.initialPassword,
        },
      },
    },
    accessToken,
  );
  return data.createUser.user.id;
}

export async function setUserOrgs(
  accessToken: string,
  userId: string,
  orgIds: readonly string[],
): Promise<void> {
  await graphqlOk(SET_USER_ORGS, { input: { userId, orgIds } }, accessToken);
}

export async function createRole(
  accessToken: string,
  name: string,
  ownerOrgId: string,
): Promise<string> {
  const data = await graphqlOk<{ createRole: { role: { id: string } } }>(
    CREATE_ROLE,
    { input: { name, ownerOrgId } },
    accessToken,
  );
  return data.createRole.role.id;
}

export async function roleMatrix(
  accessToken: string,
  roleId: string,
): Promise<{ modules: MatrixModule[]; granted: RoleGrant }> {
  const data = await graphqlOk<{
    roleMatrix: { modules: MatrixModule[]; granted: RoleGrant };
  }>(ROLE_MATRIX, { roleId }, accessToken);
  return data.roleMatrix;
}

export async function saveRoleMatrix(
  accessToken: string,
  input: { roleId: string; moduleKeys: string[]; permissionKeys: string[] },
): Promise<RoleGrant> {
  const data = await graphqlOk<{ saveRoleMatrix: { granted: RoleGrant } }>(
    SAVE_ROLE_MATRIX,
    { input },
    accessToken,
  );
  return data.saveRoleMatrix.granted;
}

export async function grantRoleUsers(
  accessToken: string,
  roleId: string,
  userIds: readonly string[],
): Promise<void> {
  await graphqlOk(
    GRANT_ROLE_USERS,
    { input: { roleId, userIds } },
    accessToken,
  );
}

/** 切換當前組織:驗過所屬組織後**換發**一張 access token(舊的那張不會失效)。 */
export async function switchOrg(
  accessToken: string,
  orgId: string,
): Promise<string> {
  const data = await graphqlOk<{ switchOrg: { accessToken: string } }>(
    SWITCH_ORG,
    { input: { orgId } },
    accessToken,
  );
  return data.switchOrg.accessToken;
}

export async function createDemoItemOne(
  accessToken: string,
  input: { name: string; note?: string; internalNote?: string },
): Promise<string> {
  const data = await graphqlOk<{
    createDemoItemOne: { item: { id: string } };
  }>(CREATE_DEMO_ITEM_ONE, { input }, accessToken);
  return data.createDemoItemOne.item.id;
}

export async function createDemoItemTwo(
  accessToken: string,
  input: { name: string; note?: string },
): Promise<string> {
  const data = await graphqlOk<{
    createDemoItemTwo: { item: { id: string } };
  }>(CREATE_DEMO_ITEM_TWO, { input }, accessToken);
  return data.createDemoItemTwo.item.id;
}

/** 原樣回傳(要驗 `FIELD_FORBIDDEN` 這類錯誤碼,所以不用 `graphqlOk`)。 */
export function updateDemoItemOne(
  accessToken: string,
  input: Record<string, unknown>,
): ReturnType<typeof graphql> {
  return graphql(UPDATE_DEMO_ITEM_ONE, { input }, accessToken);
}

/** GraphQL 的狀態列舉(資料庫存的是小寫,`dataScopeTarget` 宣告的 enum 選項用那一份)。 */
export type DemoItemOneStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export async function setDemoItemOneStatus(
  accessToken: string,
  id: string,
  status: DemoItemOneStatus,
): Promise<void> {
  await graphqlOk(
    SET_DEMO_ITEM_ONE_STATUS,
    { input: { id, status } },
    accessToken,
  );
}

/* ---- 資料範圍(ADR-0008;形狀正本 `docs/modules/data-scope.md`) ---- */

/** 多條規則命中同一個人時的頂層合成:OR = 聯集、AND = 交集。 */
export type DataScopeCombineOp = "AND" | "OR";

/** 一條規則:套用對象 + 條件樹(`filter`)。 */
export interface DataScopeRuleEntry {
  audience: { type: "ALL" | "ROLE" | "ORG" | "USER"; ids: string[] };
  filter: Record<string, unknown>;
}

export interface DataScopeRule {
  collection: string;
  combineOp: DataScopeCombineOp;
  rules: DataScopeRuleEntry[];
}

/**
 * **整份覆蓋**這個資料目標的規則(送出的就是之後生效的全部)。
 * 根組織專屬:站在租戶裡即使持有權限也會拿到 `FORBIDDEN`,所以一律用 root 的 token。
 */
export async function saveDataScopeRule(
  accessToken: string,
  input: {
    collection: string;
    combineOp: DataScopeCombineOp;
    rules: readonly DataScopeRuleEntry[];
  },
): Promise<DataScopeRule> {
  const data = await graphqlOk<{
    saveDataScopeRule: { rule: DataScopeRule };
  }>(SAVE_DATA_SCOPE_RULE, { input }, accessToken);
  return data.saveDataScopeRule.rule;
}

/** 刪規則 = 整份覆蓋成空陣列(執行面只剩租戶保底)。 */
export async function clearDataScopeRule(
  accessToken: string,
  collection: string,
): Promise<void> {
  await saveDataScopeRule(accessToken, {
    collection,
    combineOp: "OR",
    rules: [],
  });
}

/** 條件樹:一個群組包一條條件列(編輯器存出來就是這個形狀)。 */
function singleCondition(
  field: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  return {
    op: "AND",
    children: [{ field, cond: "in", value }],
  };
}

/** 套用對象 = 指定角色 → 建立者 屬於【操作者本人】(劇本 2 / 3 / 4 的規則①)。 */
export function ownedByOperatorRule(roleId: string): DataScopeRuleEntry {
  return {
    audience: { type: "ROLE", ids: [roleId] },
    filter: singleCondition("createdBy", {
      kind: "dynamic",
      ref: "current-user",
    }),
  };
}

/** 套用對象 = 指定組織 → 狀態 屬於【已發布】(劇本 4 的規則②)。 */
export function publishedInOrgRule(orgId: string): DataScopeRuleEntry {
  return {
    audience: { type: "ORG", ids: [orgId] },
    filter: singleCondition("status", {
      kind: "static",
      values: ["published"],
    }),
  };
}

export interface HistoryEntry {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * 某一筆示範項目的變更歷程(新到舊,不分頁);需要 `edit-page.show-history`。
 *
 * 受欄位級權限保護的欄位在 `before` / `after` 裡一律是 `"[redacted]"`
 * (ADR-0004「稽核歷程一律記 `[redacted]`」)—— 畫面上的歷程區塊根本不渲染值,
 * 所以那一條只驗得到這裡。
 */
export async function demoItemOneHistory(
  accessToken: string,
  id: string,
): Promise<HistoryEntry[]> {
  const data = await graphqlOk<{
    demoItemOneHistory: { items: HistoryEntry[] };
  }>(DEMO_ITEM_ONE_HISTORY, { id }, accessToken);
  return data.demoItemOneHistory.items;
}

/** 攤平權限矩陣的樹(矩陣是巢狀四層,選模組 / 權限時一律先攤平)。 */
export function flattenMatrix(
  modules: readonly MatrixModule[],
): MatrixModule[] {
  return modules.flatMap((module) => [
    module,
    ...flattenMatrix(module.children ?? []),
  ]);
}

/* ---- 劇本 10 / 13(#397):防越權、總覽也是模組 ---- */

const ME_MODULE_KEYS = `
query Me { me { modules { key } } }`;

/** 操作者自己持有的模組 key(`me.modules`;側欄與可進入路由都從這一份長出來)。 */
export async function myModuleKeys(accessToken: string): Promise<string[]> {
  const data = await graphqlOk<{ me: { modules: { key: string }[] } }>(
    ME_MODULE_KEYS,
    {},
    accessToken,
  );
  return data.me.modules.map((module) => module.key);
}

/**
 * 原樣回傳的 `saveRoleMatrix`(要驗 `ROLE_OUT_OF_REACH` 這類錯誤碼,所以不用 `graphqlOk`)。
 * 前置用的整份覆蓋走上面的 `saveRoleMatrix`。
 */
export function saveRoleMatrixRaw(
  accessToken: string,
  input: { roleId: string; moduleKeys: string[]; permissionKeys: string[] },
): ReturnType<typeof graphql> {
  return graphql(SAVE_ROLE_MATRIX, { input }, accessToken);
}

/* ---- 劇本 8 / 9(#398):多所屬組織、組織外、移除所屬組織三檔 ---- */

const ADD_ORG_MEMBERS = `
mutation AddOrgMembers($input: AddOrgMembersInput!) {
  addOrgMembers(input: $input) { addedUserIds skippedUserIds }
}`;

const MOVE_ORG = `
mutation MoveOrg($input: MoveOrgInput!) {
  moveOrg(input: $input) { org { id parentId } }
}`;

const REVOKE_ROLE_USERS = `
mutation RevokeRoleUsers($input: RevokeRoleUsersInput!) {
  revokeRoleUsers(input: $input) { totalCount }
}`;

const SET_USER_ORGS_WITH_POLICY = `
mutation SetUserOrgs($input: SetUserOrgsInput!) {
  setUserOrgs(input: $input) {
    user { id orgs { id name } roles { id name outOfScope } }
    removedOrgs { id name }
    unqualifiedRoles { roleId roleName ownerOrgId ownerOrgName reasons ownerProtected }
    revokedRoleIds
  }
}`;

/**
 * 組織管理「成員」分頁的「加入成員」(#377):對每個人的所屬組織**加**一筆
 * (只加不減,所以沒有 dry-run;移除只有 `setUserOrgs` 一個入口)。
 */
export async function addOrgMembers(
  accessToken: string,
  orgId: string,
  userIds: readonly string[],
): Promise<void> {
  await graphqlOk(ADD_ORG_MEMBERS, { input: { orgId, userIds } }, accessToken);
}

/** 把組織搬到新的上層(候選 = 管理範圍 ∩ 同租戶 − 自己子樹)。 */
export async function moveOrg(
  accessToken: string,
  id: string,
  newParentId: string,
): Promise<void> {
  await graphqlOk(MOVE_ORG, { input: { id, newParentId } }, accessToken);
}

/** 角色管理「分配使用者」的「移除」:解除這幾個人的這個角色授予。 */
export async function revokeRoleUsers(
  accessToken: string,
  roleId: string,
  userIds: readonly string[],
): Promise<void> {
  await graphqlOk(
    REVOKE_ROLE_USERS,
    { input: { roleId, userIds } },
    accessToken,
  );
}

/** 移除所屬組織的三檔(ADR-0003;`docs/modules/user-manager.md` 的 radio 文案表)。 */
export type UserOrgRemovalPolicy =
  "KEEP_ALL" | "REVOKE_OWNED_BY_ORG" | "REVOKE_ALL_UNQUALIFIED";

export type RoleUnqualifiedReason =
  "OWNED_BY_REMOVED_ORG" | "NO_REMAINING_SUBTREE_SUPPORT";

export interface SetUserOrgsResult {
  user: {
    id: string;
    orgs: { id: string; name: string }[];
    roles: { id: string; name: string; outOfScope: boolean }[];
  };
  removedOrgs: { id: string; name: string }[];
  unqualifiedRoles: {
    roleId: string;
    roleName: string;
    ownerOrgId: string | null;
    ownerOrgName: string | null;
    reasons: RoleUnqualifiedReason[];
    ownerProtected: boolean;
  }[];
  revokedRoleIds: string[];
}

/**
 * 帶 `dryRun` / `removalPolicy` 的 `setUserOrgs`,回完整 payload
 * (劇本 9 要比對 dry-run 的 `reasons` 與送出後的 `revokedRoleIds`)。
 * 只加不減的前置用上面的 `setUserOrgs` 即可。
 */
export async function setUserOrgsWithPolicy(
  accessToken: string,
  input: {
    userId: string;
    orgIds: readonly string[];
    dryRun: boolean;
    removalPolicy?: UserOrgRemovalPolicy;
  },
): Promise<SetUserOrgsResult> {
  const data = await graphqlOk<{ setUserOrgs: SetUserOrgsResult }>(
    SET_USER_ORGS_WITH_POLICY,
    { input },
    accessToken,
  );
  return data.setUserOrgs;
}
