import {
  GraphQLHandler,
  type RequestHandler,
  type WebSocketHandler,
} from "msw";

import { authWorld } from "@/test/msw/auth-handlers";
import { dataScopeTargets, savedRule } from "@/test/msw/data-scope-fixtures";
import { dataScopeWorld } from "@/test/msw/data-scope-handlers";
import { demoHistory, demoItems } from "@/test/msw/demo-fixtures";
import { demoWorld } from "@/test/msw/demo-sample-one-handlers";
import { demoTwoWorld } from "@/test/msw/demo-sample-two-handlers";
import { demoTwoItems } from "@/test/msw/demo-two-fixtures";
import {
  currentOrg,
  fieldCategories,
  fieldsByCategory,
  upperOrg,
} from "@/test/msw/field-fixtures";
import { fieldWorld } from "@/test/msw/field-manager-handlers";
import { moduleAdminTree } from "@/test/msw/module-admin-fixtures";
import { moduleAdminWorld } from "@/test/msw/module-manager-handlers";
import {
  orgDetails,
  orgMemberCandidates,
  orgMembersByOrg,
  rootTree,
  tenantModuleOptions,
  tenantTree,
} from "@/test/msw/org-fixtures";
import { orgWorld } from "@/test/msw/org-manager-handlers";
import {
  candidates,
  grantedFixture,
  matrixModules,
  roleUsers,
} from "@/test/msw/role-fixtures";
import { roleWorld } from "@/test/msw/role-manager-handlers";
import { userWorld } from "@/test/msw/user-manager-handlers";

import {
  type MockView,
  mockRoles,
  mockUsers,
  modulesForView,
  orgsForView,
} from "./mock-fixtures";

/**
 * mock 開發模式的假 api:把 `src/test/msw/` 的各頁 world 併成**一份**瀏覽器端 handlers。
 *
 * 併起來的唯一難處是**共用端點**:`orgTree` / `org` / `users` / `roles` 四個操作有兩三個 world
 * 各自實作了一份,而 MSW 是「先列的先贏」—— 放任重複的話,誰先誰贏取決於陣列順序,
 * 拿到的會是某一頁刻意簡化過的版本(例:`orgWorld` 的 `users` 不做組織子樹過濾,
 * 使用者管理頁點左樹就不會篩)。所以這裡替每個共用端點指定一個**正本 world**,
 * 其餘 world 的同名 handler 直接濾掉:
 *
 * | 操作      | 正本      | 理由                                        |
 * | --------- | --------- | ------------------------------------------- |
 * | `orgTree` | orgWorld  | 視角(root / 租戶)決定哪一棵樹              |
 * | `org`     | orgWorld  | 依 id 回各自的明細;別的 world 一律回同一筆 |
 * | `users`   | userWorld | 有組織子樹過濾、關鍵字、分頁                |
 * | `roles`   | roleWorld | 有關鍵字與分頁                              |
 *
 * 夾具一律取自 `src/test/msw/`(那一份對著 api 的斷言校準過,TEST-08),只有
 * 使用者清單在 `mock-fixtures.ts`。
 */

/**
 * `setupWorker()` / `server.use()` 收的 handler 型別(msw 內部叫 `AnyHandler`,
 * 沒有從套件根匯出,所以在這裡重寫一次)。
 */
type MockHandler = RequestHandler | WebSocketHandler;

export interface MockWorldOptions {
  /** 視角:root(根組織,看得到全部模組)或 tenant(租戶管理員,少了兩個 `isRootOnly` 模組) */
  view: MockView;
  /** 一開機就有有效的 refresh cookie = 自動登入;false 會停在登入頁(任何帳密都能登入) */
  authenticated: boolean;
}

/** 濾掉指定 GraphQL 操作的 handler(共用端點的去重;非 GraphQL 的 handler 一律留著)。 */
const withoutOperations = (
  handlers: readonly MockHandler[],
  dropped: readonly string[],
): MockHandler[] =>
  handlers.filter((handler) => {
    if (!(handler instanceof GraphQLHandler)) {
      return true;
    }
    const { operationName } = handler.info;
    return (
      typeof operationName !== "string" || !dropped.includes(operationName)
    );
  });

export const mockHandlers = ({
  view,
  authenticated,
}: MockWorldOptions): MockHandler[] => {
  // 視角決定哪一棵組織樹;使用者管理的「子樹過濾」也要同一棵,不然點左樹會篩不到人
  const orgTree = view === "root" ? rootTree : tenantTree;

  return [
    // 登入線:Login / Refresh / Me / SwitchOrg / 改密碼…(`hasRefreshCookie` 即「已登入」)
    ...authWorld({
      hasRefreshCookie: authenticated,
      modules: modulesForView(view),
      orgs: orgsForView(view),
    }).handlers,
    // 組織管理(#134 / #135 / #137):`users` 讓給 userWorld
    ...withoutOperations(
      orgWorld({
        orgTree,
        orgs: orgDetails,
        members: orgMembersByOrg,
        memberCandidates: orgMemberCandidates,
        moduleOptions: tenantModuleOptions,
      }).handlers,
      ["Users"],
    ),
    // 使用者管理(#136 / #211):`orgTree` / `org` 讓給 orgWorld、`roles` 讓給 roleWorld
    ...withoutOperations(userWorld({ users: mockUsers, orgTree }).handlers, [
      "OrgTree",
      "Org",
      "Roles",
    ]),
    // 角色管理(#203 / #246 / #261);角色清單為何取 `mockRoles` 見 `mock-fixtures.ts`
    ...withoutOperations(
      roleWorld({
        roles: mockRoles,
        modules: matrixModules,
        granted: grantedFixture,
        users: roleUsers,
        candidates,
      }).handlers,
      ["OrgTree"],
    ),
    // 模組與權限(#204):有狀態的樹,切換後重查看得到新值
    ...moduleAdminWorld({ tree: moduleAdminTree }).handlers,
    // 資料範圍(#205 / #246):`savedRule` 讓左清單一開始就有一筆「已設規則」
    ...withoutOperations(
      dataScopeWorld({ targets: dataScopeTargets, rules: [savedRule] })
        .handlers,
      ["Roles", "Users", "OrgTree"],
    ),
    // 欄位管理(#206 / #264):`currentOrg` 只決定新增選項的擁有組織標籤
    ...fieldWorld({
      categories: fieldCategories,
      fieldsByCategory,
      currentOrg,
      upperOrgIds: [upperOrg.id],
    }).handlers,
    // 示範模組1 三頁(#320):`CreateUploadUrl` 讓給 orgWorld(共用端點,正本只留一份)
    ...withoutOperations(
      demoWorld({ items: demoItems, history: demoHistory }).handlers,
      ["CreateUploadUrl"],
    ),
    // 示範模組2 三頁(#321):兩支示範模組的端點各自獨立,沒有共用端點要去重
    ...demoTwoWorld({ items: demoTwoItems }).handlers,
  ];
};
