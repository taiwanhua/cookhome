import type { WorkflowExtensionRegistration } from "@/hooks/base/useWorkflowExtensions";

/**
 * 專案依模組登記的審核擴充(組裝在 `app/module-pages.tsx`;規則見 `docs/modules/workflows.md`
 * 「依模組登記的審核擴充」):`Effect` = 寫入成功之後的動作、`Review` = 審核畫面的警告與停用 [核准]、
 * `Section` = 申請中心詳情頁的表單專屬區塊。
 * 同一個模組可以登記多筆,各做各的;底座版為空。
 */
export const projectWorkflowExtensions: readonly WorkflowExtensionRegistration[] =
  [];
