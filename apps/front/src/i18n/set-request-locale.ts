// eslint-disable-next-line sonarjs/deprecation
import { setRequestLocale } from "next-intl/server";

/**
 * 讓使用 getTranslations 的頁面維持靜態渲染(SSG/ISR)。
 * next-intl 把 setRequestLocale 標為 deprecated,建議遷移到 next/root-params,
 * 但該 API 在 Next 16.2 仍是編譯期置換的佔位模組(型別為 any);
 * 在它穩定前,把唯一的 deprecated 呼叫點集中在這裡。
 */
export const enableStaticRendering = (locale: string): void => {
  // eslint-disable-next-line sonarjs/deprecation, @typescript-eslint/no-deprecated
  setRequestLocale(locale);
};
