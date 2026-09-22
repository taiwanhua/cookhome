import { describe, expect, it } from "@jest/globals";
import { GraphQLHandler } from "msw";

import { DATA_SCOPE_MODULE_KEY } from "@/pages/system/DataScopePage/data-scope-permissions";
import { MODULE_MANAGER_MODULE_KEY } from "@/pages/system/ModuleManagerPage/module-manager-permissions";
import { ORG_MANAGER_PERMISSIONS } from "@/pages/system/OrgManagerPage/org-manager-permissions";

import { modulesForView } from "./mock-fixtures";
import { mockHandlers } from "./mock-world";

/**
 * mock 開發模式的假世界(TEST-08「mock 開發模式」)。
 *
 * 只守兩件在瀏覽器裡很難察覺、又一定會被下一個人踩到的事:
 * ①共用端點(`orgTree` / `org` / `users` / `roles`)有沒有重複 —— MSW 先列的先贏,
 * 多一份就變成「誰贏看陣列順序」,而輸的那一份可能正是某一頁要的
 * ②視角有沒有真的換掉模組集合。
 *
 * 畫面本身不在這裡測(那是各頁自己的 `*.test.tsx`),這支只看假世界的組裝。
 */

const operationNamesOf = (view: "root" | "tenant" = "root"): string[] =>
  mockHandlers({ view, authenticated: true }).flatMap((handler) =>
    handler instanceof GraphQLHandler &&
    typeof handler.info.operationName === "string"
      ? [handler.info.operationName]
      : [],
  );

describe("mock 開發模式的假世界", () => {
  it("每個 GraphQL 操作只有一個 handler(共用端點已去重)", () => {
    const names = operationNamesOf();
    const duplicated = names.filter(
      (name, index) => names.indexOf(name) !== index,
    );

    expect(duplicated).toEqual([]);
  });

  it("六個治理模組與登入線要用到的端點都在", () => {
    const names = new Set(operationNamesOf());

    for (const operation of [
      "Login",
      "Refresh",
      "Me",
      "OrgTree",
      "Org",
      "OrgMembers",
      "OrgMemberCandidates",
      "Users",
      "User",
      "Roles",
      "RoleMatrix",
      "ModuleTree",
      "Fields",
      "FieldCategories",
      "DataScopeTargets",
    ]) {
      expect(names).toContain(operation);
    }
  });

  it("root 視角看得到全部模組,租戶視角看不到兩個 isRootOnly 模組", () => {
    const rootKeys = modulesForView("root").map((module) => module.key);
    const tenantKeys = modulesForView("tenant").map((module) => module.key);

    expect(rootKeys).toContain(MODULE_MANAGER_MODULE_KEY);
    expect(rootKeys).toContain(DATA_SCOPE_MODULE_KEY);
    expect(tenantKeys).not.toContain(MODULE_MANAGER_MODULE_KEY);
    expect(tenantKeys).not.toContain(DATA_SCOPE_MODULE_KEY);
  });

  it("模組的權限是展開後的完整清單,不是只有同層的 wildcard", () => {
    const orgModule = modulesForView("root").find(
      (module) => module.key === "system.org-manager",
    );

    // `system.org-manager.*` 涵蓋不到子模組 tenant-ops 的權限(ADR-0004 同層語意),
    // 所以夾具要逐筆給,開通租戶 / 轉移擁有者的按鈕才點得到
    expect(orgModule?.permissions).toContain(ORG_MANAGER_PERMISSIONS.provision);
  });
});
