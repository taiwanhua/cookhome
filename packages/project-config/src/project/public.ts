import type { ProjectPublicConfig } from "../base/public-config";

/**
 * 專案的公開值(專案維護;底座升級不覆寫本檔)。登記於 docs/branding.md。
 * `slug` 是建立專案時定下的穩定識別,品牌更名不跟著改 —— 改了等於換一組瀏覽器儲存鍵。
 */
export const projectPublic = {
  slug: "wowgo-base",
  brand: {
    name: "wowgo-base",
    primary: "#FB7B10",
  },
  admin: {
    documentTitle: "wowgo-base 後台管理",
  },
  front: {
    metadata: {
      "zh-TW": {
        title: "wowgo-base — 多租戶應用底座",
        titleTemplate: "%s | wowgo-base",
        description: "多租戶應用底座",
      },
      en: {
        title: "wowgo-base — Multi-tenant Application Base",
        titleTemplate: "%s | wowgo-base",
        description: "Multi-tenant Application Base",
      },
    },
  },
  compatibility: {
    // 早期點分隔的側欄收合鍵;有既存瀏覽器值要搬的專案才填,新專案為 null
    legacySideNavStorageKey: null,
  },
} satisfies ProjectPublicConfig;
