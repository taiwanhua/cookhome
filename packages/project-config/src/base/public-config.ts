/**
 * 專案公開設定的契約與驗證(底座維護)。專案值在 `src/project/public.ts`,以
 * `satisfies ProjectPublicConfig` 套用本契約。設定是 build 輸入:不讀環境、瀏覽器全域或遠端服務。
 */

/** 前台某一語系的 metadata;三個欄位對應字典 `front.meta` 的三個鍵。 */
export interface ProjectFrontMetadata {
  title: string;
  /** Next 的 title template,`%s` 是頁面標題的佔位,不是 ICU 變數 */
  titleTemplate: string;
  description: string;
}

export interface ProjectPublicConfig {
  /** 建立專案時指定的穩定識別(小寫 kebab-case);品牌更名不跟著改,瀏覽器儲存鍵由它生成 */
  slug: string;
  brand: {
    /** 品牌名稱,各語系共用 */
    name: string;
    /** 主色:`#` 加六位十六進位;色盤由 `@repo/ui` 的 `createBrandFromPrimary` 推導 */
    primary: string;
  };
  admin: {
    /** admin 的 HTML title(純文字,寫進 HTML 時由讀取端跳脫) */
    documentTitle: string;
  };
  front: {
    /** 以語系為 key;是否覆蓋全部支援語系由 `@repo/i18n` 的 `composeProjectMessages` 檢查 */
    metadata: Readonly<Record<string, ProjectFrontMetadata>>;
  };
  compatibility: {
    /** 側欄收合狀態的舊鍵:只有既存專案指定,新專案為 null(完全不讀、不刪任何舊鍵) */
    legacySideNavStorageKey: string | null;
  };
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRIMARY_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const TITLE_PLACEHOLDER = "%s";
const METADATA_FIELDS = ["title", "titleTemplate", "description"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/** slug 是否為小寫 kebab-case(儲存鍵生成與設定驗證共用同一條規則)。 */
export const isProjectSlug = (value: unknown): value is string =>
  typeof value === "string" && SLUG_PATTERN.test(value);

const fail = (field: string, expectation: string): never => {
  throw new Error(`專案公開設定不合法:${field} ${expectation}`);
};

const fieldOf = (record: unknown, key: string): unknown =>
  isRecord(record) ? record[key] : undefined;

const assertFrontMetadata = (metadata: unknown): void => {
  if (!isRecord(metadata) || Object.keys(metadata).length === 0) {
    fail("front.metadata", "必須以語系為 key 且至少一個語系");
    return;
  }
  for (const [locale, entry] of Object.entries(metadata)) {
    for (const field of METADATA_FIELDS) {
      if (!isNonEmptyString(fieldOf(entry, field))) {
        fail(`front.metadata.${locale}.${field}`, "必須是非空字串");
      }
    }
    if (!String(fieldOf(entry, "titleTemplate")).includes(TITLE_PLACEHOLDER)) {
      fail(
        `front.metadata.${locale}.titleTemplate`,
        `必須含 ${TITLE_PLACEHOLDER} 佔位`,
      );
    }
  }
};

/**
 * 驗證公開設定,合法時原樣回傳。缺值或格式不對一律丟出指名欄位的錯誤,
 * 不以任何預設值補上 —— 補值會讓新專案靜默沿用別的專案的識別。
 */
export const assertProjectPublicConfig = <T extends ProjectPublicConfig>(
  config: T,
): T => {
  if (!isProjectSlug(fieldOf(config, "slug"))) {
    fail("slug", "必須是非空的小寫 kebab-case");
  }
  const brand = fieldOf(config, "brand");
  if (!isNonEmptyString(fieldOf(brand, "name"))) {
    fail("brand.name", "必須是非空字串");
  }
  const primary = fieldOf(brand, "primary");
  if (typeof primary !== "string" || !PRIMARY_PATTERN.test(primary)) {
    fail("brand.primary", "必須是 # 加六位十六進位色碼");
  }
  if (!isNonEmptyString(fieldOf(fieldOf(config, "admin"), "documentTitle"))) {
    fail("admin.documentTitle", "必須是非空字串");
  }
  assertFrontMetadata(fieldOf(fieldOf(config, "front"), "metadata"));
  const legacy = fieldOf(
    fieldOf(config, "compatibility"),
    "legacySideNavStorageKey",
  );
  if (legacy !== null && !isNonEmptyString(legacy)) {
    fail("compatibility.legacySideNavStorageKey", "必須是 null 或非空字串");
  }
  return config;
};
