import type { SeedSet } from "@repo/domain/seed";

/**
 * 夾具:工單第二版需要的欄位類別,當時的內容(普通種子的歷史快照)。
 * 目前的 registry 已把名稱改成「優先度」;這一份只在 migration 明示依賴時套用。
 */
export const seed = {
  kind: "documents",
  collection: "field_categories",
  entries: [
    {
      key: "ticket-priority",
      data: {
        name: "優先度(第二版當時的名稱)",
        description: null,
        enabled: true,
      },
    },
  ],
} satisfies SeedSet;
