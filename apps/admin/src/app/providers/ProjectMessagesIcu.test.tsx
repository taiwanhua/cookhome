import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { IntlProvider, createTranslator, useTranslations } from "use-intl";

import {
  type Locale,
  type ProjectMessageValues,
  composeProjectMessages,
  locales,
} from "@repo/i18n";

/**
 * 消費端測試:專案提供的品牌名與 metadata 是**純文字**,經 `composeProjectMessages` 寫進字典後,
 * 真的翻譯函式(use-intl 的 `useTranslations` 與 `createTranslator`;next-intl 伺服端用的是同一個核心)
 * 顯示的必須是原文 —— 文字裡的 `{}`、`<>`、單引號不可被當成 ICU 參數、標籤或引號,也不可報錯。
 * 輸入全是本檔的固定夾具,不讀專案設定。
 */

/** 四個注入鍵的完整路徑(= 翻譯函式的 key)。 */
const KEYS = [
  "common.brand",
  "front.meta.title",
  "front.meta.titleTemplate",
  "front.meta.description",
] as const;

type Shown = Record<(typeof KEYS)[number], string>;

/** 同一段純文字放進四個欄位(titleTemplate 另帶 Next 的 `%s` 佔位)。 */
const valuesOf = (text: string): ProjectMessageValues => {
  const meta = {
    title: text,
    titleTemplate: `%s | ${text}`,
    description: text,
  };
  return {
    brandName: text,
    frontMetadata: { "zh-TW": meta, en: meta },
  };
};

const expectedOf = (text: string): Shown => ({
  "common.brand": text,
  "front.meta.title": text,
  "front.meta.titleTemplate": `%s | ${text}`,
  "front.meta.description": text,
});

interface Consumed {
  shown: Shown;
  errors: string[];
}

/** React 端:`IntlProvider` + `useTranslations`,把四個鍵畫進 DOM 再讀回來。 */
const consumeWithHook = (text: string, locale: Locale): Consumed => {
  const errors: string[] = [];
  const Probe = () => {
    const t = useTranslations();
    return (
      <dl>
        {KEYS.map((key) => (
          <dd key={key} data-testid={key}>
            {t(key)}
          </dd>
        ))}
      </dl>
    );
  };
  const view = render(
    <IntlProvider
      locale={locale}
      timeZone="UTC"
      messages={composeProjectMessages(valuesOf(text))[locale]}
      onError={(error) => {
        errors.push(`${error.code}: ${error.message}`);
      }}
    >
      <Probe />
    </IntlProvider>,
  );
  const shown = Object.fromEntries(
    KEYS.map((key) => [key, screen.getByTestId(key).textContent]),
  ) as Shown;
  view.unmount();
  return { shown, errors };
};

/** 非 React 端:`createTranslator`(前台 metadata 走的就是這種不經元件的取字)。 */
const consumeWithTranslator = (text: string, locale: Locale): Consumed => {
  const errors: string[] = [];
  const t = createTranslator({
    locale,
    timeZone: "UTC",
    messages: composeProjectMessages(valuesOf(text))[locale],
    onError: (error) => {
      errors.push(`${error.code}: ${error.message}`);
    },
  });
  const shown = Object.fromEntries(KEYS.map((key) => [key, t(key)])) as Shown;
  return { shown, errors };
};

const PLAIN_TEXTS = [
  "CookHome",
  "CookHome — 家常食譜",
  "Acme Portal",
  "Acme {name}",
  "Acme {",
  "Acme }",
  "{}",
  "{{}}",
  "}{",
  "{}'{}",
  "Acme <x>",
  "Acme <x>Portal</x>",
  "</x>",
  "<x/>",
  "<x a='b'>",
  "O'Brien",
  "O''Brien",
  "'",
  "Acme '{name}'",
  "Acme '<x>'",
  "a'{}'b",
  "'#",
  "# %s",
  "%s | {name}",
  "{count, plural, one {# item} other {# items}}",
  "中文 {名} <品牌> # %s",
  "<{}>'#%s",
];

describe("專案純文字經字典到翻譯函式:顯示原文、不報錯", () => {
  describe.each(locales)("%s", (locale) => {
    it.each(PLAIN_TEXTS)("useTranslations 顯示 %p", (text) => {
      expect(consumeWithHook(text, locale)).toEqual({
        shown: expectedOf(text),
        errors: [],
      });
    });

    it.each(PLAIN_TEXTS)("createTranslator 顯示 %p", (text) => {
      expect(consumeWithTranslator(text, locale)).toEqual({
        shown: expectedOf(text),
        errors: [],
      });
    });
  });

  it("不必傳任何參數:帶 `{name}` 的品牌名也不向呼叫端要 name", () => {
    const { shown, errors } = consumeWithTranslator("Acme {name}", "en");

    expect(shown["common.brand"]).toBe("Acme {name}");
    expect(errors).toEqual([]);
  });

  it("品牌名當成別的訊息的參數值時照樣是原文(登入頁頁腳的用法)", () => {
    const messages = composeProjectMessages(valuesOf("Acme <b>{x}</b>"))[
      "zh-TW"
    ];
    const errors: string[] = [];
    const t = createTranslator({
      locale: "zh-TW",
      timeZone: "UTC",
      messages,
      onError: (error) => {
        errors.push(error.code);
      },
    });

    expect(
      t("admin.login.footer", { year: 2026, brand: t("common.brand") }),
    ).toBe("© 2026 Acme <b>{x}</b> · 僅供授權人員使用");
    expect(errors).toEqual([]);
  });
});
