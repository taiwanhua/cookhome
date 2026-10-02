import type { SeedSet } from "@repo/domain/seed";

/**
 * 夾具:工單掛的表單模組,當時的內容(普通種子的歷史快照)。歷史定義的依賴閉包要自成一份可驗的來源 ——
 * 模組雖然早就在環境裡,仍以快照列為前置,不拿目前 registry 的模組宣告代替。
 */
export const seed = {
  kind: "documents",
  collection: "modules",
  initialSeedValueFields: ["enabled", "icon", "settings"],
  entries: [
    {
      key: "project-form",
      data: {
        name: "專案申請",
        parentId: null,
        ancestors: [],
        route: "project-form",
        sidebarType: "link",
        order: 30,
        enabled: true,
        icon: "description",
        engine: "form",
        description: "專案夾具的表單模組",
        settings: { list: { builtin: { status: true } } },
      },
    },
  ],
} satisfies SeedSet;
