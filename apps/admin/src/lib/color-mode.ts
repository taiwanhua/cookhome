/**
 * admin 的外觀(跟隨系統 / 亮 / 暗)記在 localStorage,由 `@repo/ui` 的 `AppThemeProvider` 讀寫
 * (`useColorMode`);key 帶品牌 slug,登記於 docs/branding.md。
 * 首幀腳本(`color-mode-init.ts`,由 Vite 注入 html)用同一組 key 先把 `<html>` 的 class 設好,避免選了暗色重新整理先閃亮色。
 */
export const COLOR_MODE_STORAGE_KEY = "cookhome-admin-color-mode";

/** MUI 另記亮 / 暗各自的配色名稱,實際的 key 是 `<前綴>-light` / `<前綴>-dark`。 */
export const COLOR_SCHEME_STORAGE_KEY = "cookhome-admin-color-scheme";
