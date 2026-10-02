import { lazy } from "react";

/**
 * 表單模組相關的兩個跳窗(列表欄位配置、退役權限清理)懶載入:它們會帶進表單引擎的定義與計算器
 * (`@repo/domain/form`:JSONLogic + decimal),而模組與權限頁本身在首屏 bundle 裡 —— 按了才載。
 */
export const LazyListColumnsDialog = lazy(() =>
  import("../ListColumnsDialog/ListColumnsDialog").then((module) => ({
    default: module.ListColumnsDialog,
  })),
);

export const LazyRetiredPermissionsDialog = lazy(() =>
  import("./RetiredPermissionsDialog/RetiredPermissionsDialog").then(
    (module) => ({ default: module.RetiredPermissionsDialog }),
  ),
);
