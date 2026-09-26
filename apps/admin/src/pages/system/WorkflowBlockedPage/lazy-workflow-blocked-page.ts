import { lazy } from "react";

/** 阻擋清單的懶載入入口(`app/module-pages.tsx` 登記的是它);Suspense 在 `ModuleRoute`。 */
export const LazyWorkflowBlockedPage = lazy(() =>
  import("./WorkflowBlockedPage").then((module) => ({
    default: module.WorkflowBlockedPage,
  })),
);
