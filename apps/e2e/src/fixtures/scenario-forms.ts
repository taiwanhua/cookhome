import { type Page, expect } from "@playwright/test";

import { DEMO_FORM, flattenMatrix, roleMatrix, saveRoleMatrix } from "./api";
import type { ScenarioTenant } from "./scenario-tenant";

/** 劇本 18 / 19 給「客服」的示範表單(頂層)權限:四個模組動作(不含 `*`,欄位級權限另外授)。 */
const DEMO_FORM_ACTIONS = new Set(["view", "create", "edit", "delete"]);

/**
 * 前置(走 api):「客服」角色的矩陣在原本的內容之外,再勾示範表單(頂層)與它的三個隱藏頁 + 四個動作。
 * 由 +tenant 操作(租戶管理員的預設角色含示範表單(頂層)模組;開通時帶了全部可開通的模組)。
 */
export async function grantDemoForm(tenant: ScenarioTenant): Promise<void> {
  const token = tenant.tenantAdmin.token;
  const { modules, granted } = await roleMatrix(token, tenant.supportRoleId);
  const picked = flattenMatrix(modules).filter(
    (module) =>
      module.key === DEMO_FORM || module.key.startsWith(`${DEMO_FORM}.`),
  );
  await saveRoleMatrix(token, {
    roleId: tenant.supportRoleId,
    moduleKeys: [
      ...new Set([
        ...granted.moduleKeys,
        ...picked.map((module) => module.key),
      ]),
    ],
    permissionKeys: [
      ...new Set([
        ...granted.permissionKeys,
        ...picked.flatMap((module) =>
          module.permissions
            .filter((permission) => DEMO_FORM_ACTIONS.has(permission.action))
            .map((permission) => permission.key),
        ),
      ]),
    ],
  });
}

/** 按一顆鈕並等**那一個** GraphQL 操作回來(比 operationName 全等,不會被同字首的操作誤中)。 */
export async function clickAndWaitForOperation(
  page: Page,
  button: ReturnType<Page["getByRole"]>,
  operationName: string,
): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/graphql") &&
        (response.request().postData() ?? "").includes(
          `"operationName":"${operationName}"`,
        ),
    ),
    button.click(),
  ]);
}

/** 示範表單(頂層)的新增鈕(此刻可新增的表單還在路上時是停用的)。 */
export function createButton(page: Page) {
  return page.getByRole("button", { name: "+ 新增" });
}

/** 等新增鈕的狀態:可按(有可填的表單)或停用(沒有)。 */
export async function expectCreateEnabled(
  page: Page,
  isEnabled: boolean,
): Promise<void> {
  const button = createButton(page);
  await (isEnabled
    ? expect(button).toBeEnabled()
    : expect(button).toBeDisabled());
}
