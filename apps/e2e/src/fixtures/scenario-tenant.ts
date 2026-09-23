import { randomUUID } from "node:crypto";

import { MEMBER_PASSWORD, ROOT_ACCOUNT, ROOT_PASSWORD } from "../config";
import { waitForActivationToken } from "./activation-token";
import {
  changePassword,
  createChildOrg,
  createRole,
  createUserWithPassword,
  flattenMatrix,
  grantRoleUsers,
  login,
  provisionTenant,
  roleMatrix,
  saveRoleMatrix,
  setPassword,
  setUserOrgs,
  tenantModuleOptionKeys,
} from "./api";
import { DEMO_GROUP, OVERVIEW_MODULE } from "./demo-keys";

/**
 * 「驗收前的準備」四步(`docs/testing/permission-scenarios.md`)整套走一次,全部以 api 完成。
 *
 * **一條劇本一個租戶**:租戶是產品本身的隔離邊界(ADR-0005),
 * 每條劇本開一個自己的租戶,就不必為了隔離而各起一座 api / 一個資料庫。
 * 名稱後綴用隨機字串,同一個資料庫上重跑或並行都不會撞名。
 */

export interface ScenarioAccount {
  account: string;
  password: string;
  /** api 前置用的 access token(UI 登入另外走登入頁)。 */
  token: string;
  userId: string;
}

export interface SupportMatrixOptions {
  /** 不綁這些模組(劇本 7 用來拿掉新增頁)。 */
  omitModules?: readonly string[];
  /** 額外給這些權限(劇本 5 用來一項一項打開內部備註)。 */
  addPermissions?: readonly string[];
  /** 拿掉這些權限(劇本 7 用來留著新增頁、拿掉 `create`)。 */
  omitPermissions?: readonly string[];
}

export interface ScenarioTenant {
  slug: string;
  tenantOrgId: string;
  /** 租戶頂層的組織名稱(`租戶A-<slug>`);根組織視角的選單靠它分辨同名角色。 */
  tenantOrgName: string;
  /** seed 的超級管理員 token(根組織專屬的操作要用它,如資料範圍規則)。 */
  rootToken: string;
  nangangOrgId: string;
  neihuOrgId: string;
  /** 租戶擁有者 = 首任租戶管理員(+tenant)。 */
  tenantAdmin: ScenarioAccount;
  /** 租戶底下、所屬組織 = 南港店的一般使用者(+user)。 */
  member: ScenarioAccount;
  /** +tenant 自建的「客服」角色。 */
  supportRoleId: string;
  /** 重算並整份覆蓋「客服」的權限矩陣。 */
  setSupportPermissions: (options?: SupportMatrixOptions) => Promise<void>;
}

/** 「客服」預設給的四個動作;`show-internal-note` 這類一律留給劇本自己打開。 */
const DEFAULT_ACTIONS = new Set(["view", "create", "edit", "delete"]);

function isScenarioModule(key: string): boolean {
  return (
    key === OVERVIEW_MODULE ||
    key === DEMO_GROUP ||
    key.startsWith(`${DEMO_GROUP}.`)
  );
}

async function createSupportRole(
  tenantToken: string,
  tenantOrgId: string,
): Promise<string> {
  return createRole(tenantToken, "客服", tenantOrgId);
}

async function applySupportMatrix(
  tenantToken: string,
  roleId: string,
  options: SupportMatrixOptions,
): Promise<void> {
  const { modules } = await roleMatrix(tenantToken, roleId);
  const omitModules = new Set(options.omitModules);
  const granted = flattenMatrix(modules).filter(
    (module) => isScenarioModule(module.key) && !omitModules.has(module.key),
  );

  const omitPermissions = new Set(options.omitPermissions);
  const permissionKeys = new Set(
    [
      ...granted.flatMap((module) =>
        module.permissions
          .filter((permission) => DEFAULT_ACTIONS.has(permission.action))
          .map((permission) => permission.key),
      ),
      ...(options.addPermissions ?? []),
    ].filter((key) => !omitPermissions.has(key)),
  );

  await saveRoleMatrix(tenantToken, {
    roleId,
    moduleKeys: granted.map((module) => module.key),
    permissionKeys: [...permissionKeys],
  });
}

/** 開通租戶 → 拿啟用信 token → 設密碼(回來的就是登入 token)。 */
async function provisionTenantAdmin(
  rootToken: string,
  slug: string,
): Promise<{ orgId: string; orgName: string; admin: ScenarioAccount }> {
  const moduleKeys = await tenantModuleOptionKeys(rootToken);
  const account = `tenant-${slug}`;
  const email = `${account}@cookhome.test`;
  const orgName = `租戶A-${slug}`;
  const provisioned = await provisionTenant(rootToken, {
    name: orgName,
    adminAccount: account,
    adminEmail: email,
    moduleKeys,
  });

  const activationToken = await waitForActivationToken(email);
  const token = await setPassword(activationToken, MEMBER_PASSWORD);
  return {
    orgId: provisioned.orgId,
    orgName,
    admin: {
      account,
      password: MEMBER_PASSWORD,
      token,
      userId: provisioned.ownerUserId,
    },
  };
}

/** 建 +user(初始密碼啟用),並把首登強改旗標清掉,之後 UI 登入才會直接進系統。 */
async function createMember(
  tenantToken: string,
  slug: string,
  orgId: string,
): Promise<ScenarioAccount> {
  const account = `user-${slug}`;
  const userId = await createUserWithPassword(tenantToken, {
    account,
    name: `一般使用者-${slug}`,
    email: `${account}@cookhome.test`,
    orgIds: [orgId],
    initialPassword: MEMBER_PASSWORD,
  });

  const firstToken = await login(account, MEMBER_PASSWORD);
  await changePassword(firstToken, MEMBER_PASSWORD, MEMBER_PASSWORD);
  const token = await login(account, MEMBER_PASSWORD);
  return { account, password: MEMBER_PASSWORD, token, userId };
}

export async function createScenarioTenant(): Promise<ScenarioTenant> {
  const slug = randomUUID().slice(0, 8);
  const rootToken = await login(ROOT_ACCOUNT, ROOT_PASSWORD);

  // 1. root 開通租戶 + 首任租戶管理員
  const {
    orgId: tenantOrgId,
    orgName: tenantOrgName,
    admin,
  } = await provisionTenantAdmin(rootToken, slug);

  // 2. +tenant 在租戶底下建兩個分店
  const nangangOrgId = await createChildOrg(admin.token, tenantOrgId, "南港店");
  const neihuOrgId = await createChildOrg(admin.token, tenantOrgId, "內湖店");

  // 3. +tenant 建 +user(南港店);順手把自己也加入南港店(劇本 2 / 4 / 9 / 12 要兩人的可見範圍有交集)
  const member = await createMember(admin.token, slug, nangangOrgId);
  await setUserOrgs(admin.token, admin.userId, [tenantOrgId, nangangOrgId]);

  // 4. +tenant 建「客服」角色、勾示範家族的四個動作,指派給 +user
  const supportRoleId = await createSupportRole(admin.token, tenantOrgId);
  await applySupportMatrix(admin.token, supportRoleId, {});
  await grantRoleUsers(admin.token, supportRoleId, [member.userId]);

  return {
    slug,
    tenantOrgId,
    tenantOrgName,
    rootToken,
    nangangOrgId,
    neihuOrgId,
    tenantAdmin: admin,
    member,
    supportRoleId,
    setSupportPermissions: (options = {}) =>
      applySupportMatrix(admin.token, supportRoleId, options),
  };
}
