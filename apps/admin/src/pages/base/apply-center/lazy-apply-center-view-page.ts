import { lazy } from "react";

/**
 * 申請中心詳情頁的懶載入入口(`app/module-pages.tsx` 登記的是它):唯讀渲染要表單引擎
 * (渲染器、JSONLogic / decimal 計算器),只有打開詳情才需要,不進首屏 bundle。Suspense 在 `ModuleRoute`。
 */
export const LazyApplyCenterViewPage = lazy(() =>
  import("./ApplyCenterViewPage/ApplyCenterViewPage").then((module) => ({
    default: module.ApplyCenterViewPage,
  })),
);

/** 申請中心兩頁籤(DataTable 與虛擬捲動)同理懶載入,不進首屏 bundle。 */
export const LazyApplyCenterPage = lazy(() =>
  import("./ApplyCenterPage/ApplyCenterPage").then((module) => ({
    default: module.ApplyCenterPage,
  })),
);
