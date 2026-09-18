/**
 * 上傳規則(ADR-0010):可上傳的檔型、大小上限、物件路徑的長相。
 * 純常數與純函式,不依賴 Nest / GCS — resolver 的 input model 與 StorageService 共用同一份,
 * 也讓 orgs 票(#134)驗 `logoPath` 時 import 得到 `isOwnedUploadPath`。
 */

/** 上傳用途:決定路徑前綴與所需權限。第 5 段的公開檔案(示範模組封面)之後在此加值。 */
export enum UploadPurpose {
  ORG_LOGO = "ORG_LOGO",
}

/** 大小上限 2MB(ADR-0010)。 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** 上傳網址效期 10 分鐘(ADR-0010);讀取網址效期另由 `GCS_SIGNED_URL_TTL` 決定。 */
export const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;

/** 允許的 content type → 副檔名(ADR-0010 的 PNG / JPG,加上 webp)。 */
export const UPLOAD_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** 用途 → 物件路徑前綴(bucket 由設定決定,路徑不含 bucket)。 */
export const UPLOAD_PATH_PREFIXES: Readonly<Record<UploadPurpose, string>> = {
  [UploadPurpose.ORG_LOGO]: "org-logos",
};

const PREFIX_PATTERN = Object.values(UPLOAD_PATH_PREFIXES).join("|");
const EXTENSION_PATTERN = [...new Set(Object.values(UPLOAD_EXTENSIONS))].join(
  "|",
);
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OWNED_UPLOAD_PATH = new RegExp(
  String.raw`^(${PREFIX_PATTERN})/${UUID_PATTERN}\.(${EXTENSION_PATTERN})$`,
);

/**
 * 這個物件路徑是不是本 API 自己簽出來的(前綴 + uuid + 允許的副檔名)。
 * 用途:寫入 `orgs.logoPath` 這類「由前端回傳路徑」的欄位前先驗,
 * 不讓呼叫端把任意 bucket 物件塞進 DB(#134 updateOrg / provisionTenant)。
 */
export function isOwnedUploadPath(path: string): boolean {
  return OWNED_UPLOAD_PATH.test(path);
}
