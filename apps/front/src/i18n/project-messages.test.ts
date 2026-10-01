import { describe, expect, it } from "@jest/globals";

import { composeProjectMessages, locales, messages } from "@repo/i18n";
import { projectPublic } from "@repo/project-config/public";

import { projectMessages } from "./project-messages";

/** 文字裡沒有 ICU 會解讀的字元(`'`、`{`、`<`)時,寫進字典的就是原文本身。 */
const isPlainForIcu = (text: string): boolean => !/['<{]/.test(text);

/**
 * 前台實際交給 next-intl 的字典(`request.ts` 用的就是這一份)。
 * layout 的 `generateMetadata` 以 `front.meta` 三個鍵組出 title / description。
 * 這一組驗「正式接線」:不寫任何專案的字面值,換專案不必改本檔。
 */
describe("前台字典:注入的是目前的專案設定", () => {
  it("涵蓋全部支援語系", () => {
    expect(Object.keys(projectMessages)).toEqual([...locales]);
  });

  it("注入的值就是專案設定的品牌名與各語系 metadata", () => {
    expect(projectMessages).toEqual(
      composeProjectMessages({
        brandName: projectPublic.brand.name,
        frontMetadata: projectPublic.front.metadata,
      }),
    );
  });

  it.each(locales)("%s:不含 ICU 特殊字元的專案文字逐字寫進字典", (locale) => {
    const meta = projectPublic.front.metadata[locale];
    const pairs: [string, string][] = [
      [projectMessages[locale].common.brand, projectPublic.brand.name],
      [projectMessages[locale].front.meta.title, meta.title],
      [projectMessages[locale].front.meta.titleTemplate, meta.titleTemplate],
      [projectMessages[locale].front.meta.description, meta.description],
    ];

    for (const [message, text] of pairs.filter(([, text]) =>
      isPlainForIcu(text),
    )) {
      expect(message).toBe(text);
    }
    expect(projectMessages[locale].front.meta.titleTemplate).toContain("%s");
  });

  it.each(locales)("%s:首頁的業務文案原樣沿用基礎字典", (locale) => {
    expect(projectMessages[locale].front.home).toBe(
      messages[locale].front.home,
    );
  });
});

/**
 * 固定的 CookHome 夾具(不讀目前的專案設定):抽設定前 `front.json` 的 `meta` 與 `common.brand`
 * 原文寫死在這裡,經同一個注入函式後,交給 next-intl 的字串必須逐字相同 —— 兩語系的頁面 metadata 不變。
 */
describe("固定的 CookHome 夾具:前台 metadata 與抽設定前逐字相同", () => {
  const legacy = composeProjectMessages({
    brandName: "CookHome",
    frontMetadata: {
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
  });

  it("zh-TW", () => {
    expect(legacy["zh-TW"].front.meta).toEqual({
      title: "CookHome — 家常食譜",
      titleTemplate: "%s | CookHome",
      description: "分享與收藏家常食譜的網站",
    });
    expect(legacy["zh-TW"].common.brand).toBe("CookHome");
  });

  it("en", () => {
    expect(legacy.en.front.meta).toEqual({
      title: "CookHome — Home-style Recipes",
      titleTemplate: "%s | CookHome",
      description: "Share and collect home-style recipes",
    });
    expect(legacy.en.common.brand).toBe("CookHome");
  });
});
