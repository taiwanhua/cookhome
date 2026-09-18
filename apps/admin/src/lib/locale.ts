import { createContext, useCallback, useEffect, useState } from "react";

import { type Locale, defaultLocale, isLocale } from "@repo/i18n";

/** admin 的語言不進 URL,記在 localStorage(I18N-05);key 帶品牌 slug,登記於 docs/branding.md。 */
export const LOCALE_STORAGE_KEY = "cookhome-admin-locale";

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored !== null && isLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用(隱私模式等)時退回預設語言
  }
  return defaultLocale;
}

function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 寫不進去就只影響本次(下次開啟回預設語言),不阻擋切換
  }
}

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/** AppBar 語言切換器讀寫的入口;由 AppProviders 供給。 */
export const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {
    // 未掛 provider 時(不該發生)切換無效
  },
});

/**
 * 語言狀態的唯一持有者(REACT-02:跨很遠的元件才用 context):
 * 初值讀 localStorage,切換時同步寫回並更新 `<html lang>`。組裝根與測試的 renderApp 共用。
 */
export function useStoredLocale(): LocaleContextValue {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    writeStoredLocale(next);
    setLocaleState(next);
  }, []);

  return { locale, setLocale };
}
