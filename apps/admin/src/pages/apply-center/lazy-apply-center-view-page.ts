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
