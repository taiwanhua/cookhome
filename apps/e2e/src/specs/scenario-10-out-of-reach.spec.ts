import type { Page } from "@playwright/test";

import {
  flattenMatrix,
  myModuleKeys,
  roleMatrix,
  saveRoleMatrixRaw,
} from "../fixtures/api";
import {
  OVERVIEW_MODULE,
  ROLE_MANAGER_ROUTE,
  SAMPLE_ONE,
} from "../fixtures/demo-keys";
import { errorCodeOf } from "../fixtures/graphql";
import { expect, test } from "../fixtures/test";
import { matrixRow, matrixTree, signIn } from "../fixtures/ui";

/**
 * 劇本 10 — 防越權
 * 正本:`docs/testing/permission-scenarios.md`「劇本 10」。用哪一頁:角色管理 → 權限矩陣;
 * 帳號:+tenant(**不是** root —— 超級管理員全權放行,看不出限制)。
 *
 * 要驗的是「矩陣的顯示樹就是操作者的天花板」(`docs/modules/role-manager.md`「矩陣的兩棵樹」):
 * 根組織專屬模組根本不在 +tenant 的樹上;硬送樹外(= 自己沒有)的鍵,api 回 `ROLE_OUT_OF_REACH`。
 */

/** 根組織專屬的三個模組(`apps/db-migrator/seeds/modules/system.ts`;租戶管理員模板不綁)。 */
const ROOT_ONLY_MODULES = [
  { key: "system.module-manager", name: "模組與權限" },
  { key: "system.data-scope", name: "資料範圍" },
  { key: "system.org-manager.tenant-ops", name: "租戶作業" },
] as const;

/** 與「模組與權限」同一層、+tenant 持有的模組 —— 用來確認系統群組確實展開在畫面上。 */
const ROLE_MANAGER_MODULE = "system.role-manager";

/** 預設角色在角色清單上的標籤(`roleManager.tags.templateCopy`)。 */
const TEMPLATE_COPY_TAG = "預設角色";

const expectNoRootOnlyModules = async (page: Page) => {
  const tree = matrixTree(page);
  // 先確認系統群組那一層有畫出來,「不在樹上」的斷言才不是因為沒展開而白綠
  await expect(matrixRow(page, ROLE_MANAGER_MODULE)).toBeVisible();
  await expect(matrixRow(page, SAMPLE_ONE)).toBeVisible();
  for (const module of ROOT_ONLY_MODULES) {
    await expect(tree.getByText(module.key, { exact: true })).toHaveCount(0);
    await expect(tree.getByText(module.name, { exact: true })).toHaveCount(0);
  }
};

test("劇本 10:+tenant 的矩陣只列他自己有的模組與權限,硬送超出的鍵回 ROLE_OUT_OF_REACH", async ({
  page,
  tenant,
}) => {
  const tenantToken = tenant.tenantAdmin.token;

  // 步驟 2 的對照(api):+tenant 看到的顯示樹 ⊆ 他自己持有的模組;root 看同一個角色則看得到根組織專屬模組
  const held = new Set(await myModuleKeys(tenantToken));
  const tenantView = await roleMatrix(tenantToken, tenant.supportRoleId);
  const rootView = await roleMatrix(tenant.rootToken, tenant.supportRoleId);
  const tenantTree = flattenMatrix(tenantView.modules).map(
    (module) => module.key,
  );
  const rootTree = flattenMatrix(rootView.modules).map((module) => module.key);

  expect(tenantTree).toContain(OVERVIEW_MODULE);
  expect(tenantTree.filter((key) => !held.has(key))).toEqual([]);
  for (const module of ROOT_ONLY_MODULES) {
    expect(held.has(module.key)).toBe(false);
    expect(tenantTree).not.toContain(module.key);
    // 樹上沒有它不是因為模組不存在,而是 +tenant 搆不到(root 的顯示樹 = 全樹)
    expect(rootTree).toContain(module.key);
  }

  // 步驟 1 / 2:+tenant 編輯「客服」→ 權限矩陣上沒有根組織專屬模組
  await signIn(page, tenant.tenantAdmin.account, tenant.tenantAdmin.password);
  await page.goto(ROLE_MANAGER_ROUTE);
  await page.getByText("客服", { exact: true }).click();
  await expectNoRootOnlyModules(page);

  // 步驟 3:打開租戶的預設角色 —— 一樣只列得出 +tenant 自己有的
  await page
    .getByRole("button")
    .filter({ has: page.getByText(TEMPLATE_COPY_TAG, { exact: true }) })
    .click();
  await expectNoRootOnlyModules(page);

  // 硬送樹外的鍵(畫面勾不到,直接打 api):自己沒有的模組與權限 → ROLE_OUT_OF_REACH
  const before = await roleMatrix(tenantToken, tenant.supportRoleId);
  const result = await saveRoleMatrixRaw(tenantToken, {
    roleId: tenant.supportRoleId,
    moduleKeys: [...before.granted.moduleKeys, "system.module-manager"],
    permissionKeys: [
      ...before.granted.permissionKeys,
      "system.module-manager.*",
    ],
  });
  expect(errorCodeOf(result)).toBe("ROLE_OUT_OF_REACH");

  // 被拒的那一次不會寫進任何東西
  const after = await roleMatrix(tenantToken, tenant.supportRoleId);
  expect(after.granted).toEqual(before.granted);
});
