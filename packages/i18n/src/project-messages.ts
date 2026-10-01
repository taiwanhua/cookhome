import { type Messages, messages } from "./base-messages";
import { encodeIcuLiteral } from "./icu-literal";
import { type Locale, locales } from "./locales";

type FrontMeta = Messages["front"]["meta"];

/** 專案注入字典的值;由 app 從自己的專案設定取出後傳入,本套件不讀任何專案來源。 */
export interface ProjectMessageValues {
  /** 品牌名稱(各語系共用),覆寫 `common.brand` */
  brandName: string;
  /** 每個支援語系一份,覆寫 `front.meta` 的三個鍵 */
  frontMetadata: Record<Locale, FrontMeta>;
}

const META_FIELDS = ["title", "titleTemplate", "description"] as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const frontMetaOf = (
  frontMetadata: Partial<Record<Locale, FrontMeta>>,
  locale: Locale,
): FrontMeta => {
  const meta = frontMetadata[locale];
  if (meta === undefined) {
    throw new Error(
      `專案字典注入失敗:frontMetadata 缺少語系 ${locale}(支援語系:${locales.join("、")})`,
    );
  }
  for (const field of META_FIELDS) {
    if (!isNonEmptyString(meta[field])) {
      throw new Error(
        `專案字典注入失敗:frontMetadata 的 ${locale}.${field} 必須是非空字串`,
      );
    }
  }
  // 逐欄取值:不保留輸入物件的參考,也不帶進契約以外的鍵
  return {
    title: encodeIcuLiteral(meta.title),
    titleTemplate: encodeIcuLiteral(meta.titleTemplate),
    description: encodeIcuLiteral(meta.description),
  };
};

/**
 * 把專案品牌注入基礎字典,回傳每個語系的完整字典。只覆寫 `common.brand` 與 `front.meta`
 * 的三個既有鍵:不做通用 deep merge、不增減鍵、不動 ICU 參數;基礎字典不被修改。
 *
 * 四個值都是**純文字**:寫進字典前以 ICU literal 編碼(`encodeIcuLiteral`),翻譯函式顯示的
 * 就是專案提供的原文,文字裡的 `{`、`<`、`'` 不會變成參數、標籤或引號。
 * `titleTemplate` 的 `%s` 是 Next 的 title template 佔位,對 ICU 而言是一般文字,原樣保留。
 */
export const composeProjectMessages = (
  values: ProjectMessageValues,
): Record<Locale, Messages> => {
  if (!isNonEmptyString(values.brandName)) {
    throw new Error("專案字典注入失敗:brandName 必須是非空字串");
  }
  const compose = (locale: Locale): Messages => {
    const base: Messages = messages[locale];
    return {
      ...base,
      common: { ...base.common, brand: encodeIcuLiteral(values.brandName) },
      front: { ...base.front, meta: frontMetaOf(values.frontMetadata, locale) },
    };
  };
  return Object.fromEntries(
    locales.map((locale) => [locale, compose(locale)]),
  ) as Record<Locale, Messages>;
};
