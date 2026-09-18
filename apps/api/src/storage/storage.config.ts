import { ConfigService } from "@nestjs/config";

import { parseDurationMs } from "../auth/duration";

/** 注入 token(檔案儲存的設定值,自環境變數讀取;登記:docs/env-registry.md)。 */
export const STORAGE_CONFIG = Symbol("STORAGE_CONFIG");

export interface StorageConfig {
  /**
   * 私有 bucket 名稱(`GCS_BUCKET_PRIVATE`,如 `cookhome-assets-dev`;ADR-0010)。
   * 未設 → 自動改用記錄用 adapter(簽名網址是假的、檔案不會真的上傳),api 不因缺設定而啟動失敗。
   */
  privateBucket: string | undefined;
  /**
   * 公開 bucket 名稱(`GCS_BUCKET_PUBLIC`,如 `cookhome-public-dev`;ADR-0010)。
   * 第 3 段沒有公開檔案,先登記、先讀進來;第 5 段示範模組的封面才會用到。
   */
  publicBucket: string | undefined;
  /** 簽名**讀取**網址效期(`GCS_SIGNED_URL_TTL`,預設 1h;ADR-0010 商標類)。 */
  signedUrlTtlMs: number;
}

/** ADR-0010:商標類的讀取網址 TTL 1 小時(前端可快取)。 */
export const DEFAULT_SIGNED_URL_TTL = "1h";

/** 每個變數都有內建預設值,不設也能跑(#61)。 */
export function loadStorageConfig(config: ConfigService): StorageConfig {
  return {
    privateBucket: nonEmpty(config.get<string>("GCS_BUCKET_PRIVATE")),
    publicBucket: nonEmpty(config.get<string>("GCS_BUCKET_PUBLIC")),
    signedUrlTtlMs: parseDurationMs(
      config.get<string>("GCS_SIGNED_URL_TTL") ?? DEFAULT_SIGNED_URL_TTL,
      "GCS_SIGNED_URL_TTL",
    ),
  };
}

/** 空字串視同未設定(YAML 留空鍵時常見)。 */
function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

export const storageConfigProvider = {
  provide: STORAGE_CONFIG,
  inject: [ConfigService],
  useFactory: loadStorageConfig,
};
