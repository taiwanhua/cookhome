import type { OrgQuery, TenantModuleOptionsQuery } from "@repo/graphql";

/** 右側資料區的一筆組織(`org(id)` 的完整形狀)。 */
export type OrgDetail = OrgQuery["org"];

/** 開通彈窗的模組勾選選項(`tenantModuleOptions`;`parentId` 指向同清單內的模組 id)。 */
export type TenantModuleOption =
  TenantModuleOptionsQuery["tenantModuleOptions"][number];

/**
 * 頁面上可執行的動作(ADR-0011「頁內判斷」)。
 * 前三個是任何組織都可能有的;後三個屬租戶作業,只有根組織的操作者拿得到(ADR-0009)。
 */
export interface OrgActionAbility {
  canCreateChild: boolean;
  canEdit: boolean;
  canToggleEnabled: boolean;
  canMove: boolean;
  canDelete: boolean;
  canProvision: boolean;
  canTransferOwner: boolean;
  canSetVisibility: boolean;
}

/** 商標的上傳限制(api 正本 `apps/api/src/storage/storage.service.ts`,ADR-0010)。 */
export const LOGO_ACCEPT = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_SIZE = 2 * 1024 * 1024;

/** 轉移擁有者的候選人清單一次取這麼多(`users` 的 pageSize 上限 100)。 */
export const OWNER_CANDIDATE_PAGE_SIZE = 100;
