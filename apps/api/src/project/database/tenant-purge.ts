import type { TenantPurgeRegistration } from "../../database/tenant-purge";
import { RECIPES_COLLECTION } from "./recipe.schema";

/**
 * 專案 collection 的「清空示範機構時怎麼刪」(`database/tenant-purge.ts`;由 `database.module.ts` 組裝)。
 *
 * 新增專案資料表(`project/database/registrations.ts` 加 model)時在這裡同 PR 加一筆;
 * 沒登記 → `database/tenant-purge.test.ts` 的完整性測試失敗。只能新增的帳本(流水、事件)也照樣刪。
 */
export const PROJECT_TENANT_PURGE_REGISTRATIONS: readonly TenantPurgeRegistration[] =
  [
    {
      collection: RECIPES_COLLECTION,
      rule: {
        by: "keep",
        reason:
          "食譜原型沒有租戶欄位(LEGACY_UNSCOPED_MODELS 例外),不屬任何租戶",
      },
    },
  ];
