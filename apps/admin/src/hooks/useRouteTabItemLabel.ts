import { useEffect } from "react";
import { useLocation } from "react-router";

import { normalizePathname } from "@/lib/module-tree";
import { useRouteTabsStore } from "@/stores/useRouteTabsStore";

/**
 * 詳情子頁籤的項目名(#428;ADR-0011「頁籤兩種」):詳情 / 編輯這類帶識別碼的隱藏頁,拿到那一筆之後呼叫,
 * 殼的路由頁籤就顯示成「所屬模組名 — 項目名」。資料還沒到(`undefined` / `null` / 空字串)時不動,
 * 頁籤先顯示網址對上的模組名。
 *
 * 頁籤以目前網址為 id,所以這裡直接讀網址,頁面不必自己組路由字串。
 * store action 放在 effect 內(REACT-06:render 期間只允許冪等的初始化)。
 */
export const useRouteTabItemLabel = (
  itemLabel: string | null | undefined,
): void => {
  const { pathname } = useLocation();
  const setItemLabel = useRouteTabsStore((state) => state.setItemLabel);
  const route = normalizePathname(pathname);

  useEffect(() => {
    if (itemLabel !== null && itemLabel !== undefined && itemLabel !== "") {
      setItemLabel(route, itemLabel);
    }
  }, [setItemLabel, route, itemLabel]);
};
