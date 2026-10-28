import type { ComponentType } from "react";

/**
 * 專案掛在後台殼上的常駐元件(`docs/concepts/frontend-architecture.md`「殼上的常駐元件」;
 * 與 `app/base/shell-extensions.ts` 由 `app/module-pages.tsx` 合成):登入後一直存在、不屬於任何頁面的東西。
 * 只追加自己的登記;底座版為空。
 */
export const projectShellExtensions: readonly ComponentType[] = [];
