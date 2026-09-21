import { useMe } from "@/hooks/useMe";
import { usePermissions } from "@/hooks/usePermissions";

import {
  SAMPLE_ONE_MODULE_KEYS,
  SAMPLE_ONE_PERMISSIONS,
} from "./demo-sample-one-config";

export interface SampleOneAccess {
  /** 列表頁的路由(回列表、儲存後導回都用它);沒綁列表模組時為 null */
  listRoute: string | null;
  /** 詳情頁的模組路由(實際網址再接 `/<id>`);沒綁該隱藏頁時為 null → 不顯示「檢視」 */
  viewRoute: string | null;
  /** 新增頁的模組路由;沒綁就沒有「新增示範項目」 */
  createRoute: string | null;
  /** 編輯頁的模組路由(實際網址再接 `/<id>`);沒綁就沒有列上的「編輯」 */
  editRoute: string | null;
  /** 新增鈕 = 有 create 權限 **且** 綁了新增頁(兩件事都成立才進得去) */
  canCreate: boolean;
  /** 內部備註欄要不要渲染(欄位級權限;沒有它 api 連值都不會給) */
  canShowInternalNote: boolean;
  /** 新增頁的內部備註能不能填(編輯既有資料改看 `item.abilities.canEditInternalNote`) */
  canEditInternalNote: boolean;
  /** 新增頁的填寫提示區塊(頁面自有權限) */
  canShowTips: boolean;
  /** 編輯頁的變更歷程區塊(頁面自有權限;與「能不能編輯」互相獨立) */
  canShowHistory: boolean;
}

/**
 * 示範模組1 三頁共用的「進得去哪、做得了什麼」(ADR-0011)。
 *
 * 兩件事刻意分開問:
 * - **進得去哪一頁**看的是 `me.modules` 裡有沒有那個模組(「可進 = 有那個模組路由」,僅此一條);
 *   路由字串一律從模組陣列取,不在前端寫死路徑 —— seed 改了 route 這裡自動跟著改。
 * - **頁內能做什麼**看權限集(`usePermissions`)。
 *
 * 逐列的編輯 / 刪除 / 內部備註可改**不在這裡** —— 那三個由 api 算在 `item.abilities` 上,
 * 前端直接用(模組文件「回傳欄位的語意」),重算一次就會與 API 對不起來。
 */
export const useSampleOneAccess = (): SampleOneAccess => {
  const me = useMe();
  const { hasPermission } = usePermissions();
  const modules = me.data?.me.modules ?? [];

  const routeOf = (key: string): string | null =>
    modules.find((module) => module.key === key)?.route ?? null;

  const createRoute = routeOf(SAMPLE_ONE_MODULE_KEYS.createPage);

  return {
    listRoute: routeOf(SAMPLE_ONE_MODULE_KEYS.list),
    viewRoute: routeOf(SAMPLE_ONE_MODULE_KEYS.viewPage),
    createRoute,
    editRoute: routeOf(SAMPLE_ONE_MODULE_KEYS.editPage),
    canCreate:
      createRoute !== null && hasPermission(SAMPLE_ONE_PERMISSIONS.create),
    canShowInternalNote: hasPermission(SAMPLE_ONE_PERMISSIONS.showInternalNote),
    canEditInternalNote: hasPermission(SAMPLE_ONE_PERMISSIONS.editInternalNote),
    canShowTips: hasPermission(SAMPLE_ONE_PERMISSIONS.showTips),
    canShowHistory: hasPermission(SAMPLE_ONE_PERMISSIONS.showHistory),
  };
};
