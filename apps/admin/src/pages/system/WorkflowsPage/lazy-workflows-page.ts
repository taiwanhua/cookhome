import { lazy } from "react";

/**
 * 流程管理頁的懶載入入口(`app/module-pages.tsx` 登記的是它):設計器含 React Flow、dagre 與流程檢查器,
 * 只有進這一頁才需要,不進首屏 bundle。Suspense 在 `ModuleRoute`。
 */
export const LazyWorkflowsPage = lazy(() =>
  import("./WorkflowsPage").then((module) => ({
    default: module.WorkflowsPage,
  })),
);
