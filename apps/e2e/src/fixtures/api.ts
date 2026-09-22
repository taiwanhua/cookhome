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

const CREATE_DEMO_ITEM_ONE = `
mutation CreateDemoItemOne($input: CreateDemoItemOneInput!) {
  createDemoItemOne(input: $input) { item { id name } }
}`;

const UPDATE_DEMO_ITEM_ONE = `
mutation UpdateDemoItemOne($input: UpdateDemoItemOneInput!) {
  updateDemoItemOne(input: $input) { item { id name internalNote } }
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

export async function createDemoItemOne(
  accessToken: string,
  input: { name: string; note?: string; internalNote?: string },
): Promise<string> {
  const data = await graphqlOk<{
    createDemoItemOne: { item: { id: string } };
  }>(CREATE_DEMO_ITEM_ONE, { input }, accessToken);
  return data.createDemoItemOne.item.id;
}

/** 原樣回傳(要驗 `FIELD_FORBIDDEN` 這類錯誤碼,所以不用 `graphqlOk`)。 */
export function updateDemoItemOne(
  accessToken: string,
  input: Record<string, unknown>,
): ReturnType<typeof graphql> {
  return graphql(UPDATE_DEMO_ITEM_ONE, { input }, accessToken);
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
