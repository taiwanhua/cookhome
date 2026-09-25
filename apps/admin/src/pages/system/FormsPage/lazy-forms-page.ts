import { lazy } from "react";

/**
 * 表單管理頁的懶載入入口(`app/module-pages.tsx` 登記的是它):設計器含 dnd-kit、表達式選擇器、檢查器,
 * 只有進這一頁才需要,不進首屏 bundle。Suspense 在 `ModuleRoute`。
 */
export const LazyFormsPage = lazy(() =>
  import("./FormsPage").then((module) => ({ default: module.FormsPage })),
);
