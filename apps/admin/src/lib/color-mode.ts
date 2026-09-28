/**
 * admin 的外觀(跟隨系統 / 亮 / 暗)記在 localStorage,由 `@repo/ui` 的 `AppThemeProvider` 讀寫
 * (`useColorMode`);key 帶品牌 slug,登記於 docs/branding.md。
 */
export const COLOR_MODE_STORAGE_KEY = "cookhome-admin-color-mode";

/** MUI 另記亮 / 暗各自的配色名稱,實際的 key 是 `<前綴>-light` / `<前綴>-dark`。 */
export const COLOR_SCHEME_STORAGE_KEY = "cookhome-admin-color-scheme";
