import { type Page, expect } from "@playwright/test";

import {
  SHOPPING_LIST,
  flattenMatrix,
  roleMatrix,
  saveRoleMatrix,
} from "./api";
import type { ScenarioTenant } from "./scenario-tenant";

/** 劇本 18 / 19 給「客服」的購物清單權限:四個模組動作(不含 `*`,欄位級權限另外授)。 */
const SHOPPING_ACTIONS = new Set(["view", "create", "edit", "delete"]);

/**
 * 前置(走 api):「客服」角色的矩陣在原本的內容之外,再勾購物清單與它的三個隱藏頁 + 四個動作。
 * 由 +tenant 操作(租戶管理員的預設角色含購物清單模組;開通時帶了全部可開通的模組)。
 */
export async function grantShoppingList(tenant: ScenarioTenant): Promise<void> {
  const token = tenant.tenantAdmin.token;
  const { modules, granted } = await roleMatrix(token, tenant.supportRoleId);
  const shopping = flattenMatrix(modules).filter(
    (module) =>
      module.key === SHOPPING_LIST ||
      module.key.startsWith(`${SHOPPING_LIST}.`),
  );
  await saveRoleMatrix(token, {
    roleId: tenant.supportRoleId,
    moduleKeys: [
      ...new Set([
        ...granted.moduleKeys,
        ...shopping.map((module) => module.key),
      ]),
    ],
    permissionKeys: [
      ...new Set([
        ...granted.permissionKeys,
        ...shopping.flatMap((module) =>
          module.permissions
            .filter((permission) => SHOPPING_ACTIONS.has(permission.action))
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

/** 購物清單的新增鈕(此刻可新增的表單還在路上時是停用的)。 */
export function shoppingCreateButton(page: Page) {
  return page.getByRole("button", { name: "+ 新增" });
}

/** 等新增鈕的狀態:可按(有可填的表單)或停用(沒有)。 */
export async function expectCreateEnabled(
  page: Page,
  isEnabled: boolean,
): Promise<void> {
  const button = shoppingCreateButton(page);
  await (isEnabled
    ? expect(button).toBeEnabled()
    : expect(button).toBeDisabled());
}
