/**
 * admin 的外觀(跟隨系統 / 亮 / 暗)記在 localStorage,由 `@repo/ui` 的 `AppThemeProvider` 讀寫
 * (`useColorMode`);key 帶品牌 slug,登記於 docs/branding.md。
 * `index.html` / `mock.html` 的首幀腳本用同一組 key 先把 `<html>` 的 class 設好(React 插入的
 * 內嵌 script 不會執行,所以不能用 MUI 的 `InitColorSchemeScript`),避免選了暗色重新整理先閃亮色。
 */
export const COLOR_MODE_STORAGE_KEY = "cookhome-admin-color-mode";

/** MUI 另記亮 / 暗各自的配色名稱,實際的 key 是 `<前綴>-light` / `<前綴>-dark`。 */
export const COLOR_SCHEME_STORAGE_KEY = "cookhome-admin-color-scheme";
