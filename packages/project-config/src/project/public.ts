import type { ProjectPublicConfig } from "../base/public-config";

/**
 * 專案的公開值(專案維護;底座升級不覆寫本檔)。登記於 docs/branding.md。
 * `slug` 是建立專案時定下的穩定識別,品牌更名不跟著改 —— 改了等於換一組瀏覽器儲存鍵。
 */
export const projectPublic = {
  slug: "cookhome",
  brand: {
    name: "CookHome",
    primary: "#FB7B10",
  },
  admin: {
    documentTitle: "CookHome 後台管理",
  },
  front: {
    metadata: {
      "zh-TW": {
        title: "CookHome — 家常食譜",
        titleTemplate: "%s | CookHome",
        description: "分享與收藏家常食譜的網站",
      },
      en: {
        title: "CookHome — Home-style Recipes",
        titleTemplate: "%s | CookHome",
        description: "Share and collect home-style recipes",
      },
    },
  },
  compatibility: {
    // 側欄收合狀態早期用的點分隔鍵;既存瀏覽器的值由 admin 一次性搬到新鍵
    legacySideNavStorageKey: "cookhome.admin.sidenav",
  },
} satisfies ProjectPublicConfig;
