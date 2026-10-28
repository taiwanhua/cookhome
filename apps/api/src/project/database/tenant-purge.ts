import type { TenantPurgeRegistration } from "../../database/tenant-purge";

/**
 * 專案 collection 的「清空示範機構時怎麼刪」(`database/tenant-purge.ts`;由 `database.module.ts` 組裝)。
 *
 * 新增專案資料表(`project/database/registrations.ts` 加 model)時在這裡同 PR 加一筆;
 * 沒登記 → `database/tenant-purge.test.ts` 的完整性測試失敗。只能新增的帳本(流水、事件)也照樣刪。
 * 底座版沒有專案資料表,清單為空。
 */
export const PROJECT_TENANT_PURGE_REGISTRATIONS: readonly TenantPurgeRegistration[] =
  [];
