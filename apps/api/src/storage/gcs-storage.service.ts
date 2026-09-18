import { Storage } from "@google-cloud/storage";

import type { StorageConfig } from "./storage.config";
import { type SignUploadRequest, StorageService } from "./storage.service";

/** 簽名網址的參數(只取 `@google-cloud/storage` 用到的那幾個欄位)。 */
export interface GcsSignedUrlOptions {
  version: "v4";
  action: "read" | "write";
  expires: Date;
  contentType?: string;
}

/** 只取 SDK 用到的那一角,單元測試以假 bucket 取代(不打真網路)。 */
export interface GcsBucket {
  file(name: string): {
    getSignedUrl(options: GcsSignedUrlOptions): Promise<[string]>;
  };
}

/**
 * GCS adapter(ADR-0010):V4 簽名的上傳 / 讀取網址,對 `GCS_BUCKET_PRIVATE` 那顆私有 bucket。
 *
 * **簽名不用金鑰檔**:`new Storage()` 走 ADC —— 在 Cloud Run 上即執行身分的中繼資料 token,
 * SDK 沒有私鑰可簽時自動改呼叫 IAM Credentials 的 `signBlob`(所以該 SA 要對自己持
 * `roles/iam.serviceAccountTokenCreator`、專案要開 `iamcredentials.googleapis.com`;
 * 建立步驟見 docs/deployment.md)。本機沒有憑證,連 adapter 都不會被選中(改用記錄用 adapter)。
 */
export class GcsStorageService extends StorageService {
  private readonly bucket: GcsBucket;

  constructor(config: StorageConfig, bucket?: GcsBucket) {
    super(config);
    this.bucket = bucket ?? new Storage().bucket(requireBucket(config));
  }

  protected override async signUploadUrl({
    objectPath,
    contentType,
    expiresAt,
  }: SignUploadRequest): Promise<string> {
    const [url] = await this.bucket.file(objectPath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: expiresAt,
      // 綁死 content type:拿到網址也只能上傳這個型別的檔案
      contentType,
    });
    return url;
  }

  protected override async signReadUrl(
    objectPath: string,
    expiresAt: Date,
  ): Promise<string> {
    const [url] = await this.bucket.file(objectPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAt,
    });
    return url;
  }
}

function requireBucket(config: StorageConfig): string {
  if (config.privateBucket === undefined) {
    throw new Error("GCS_BUCKET_PRIVATE 未設定,無法建立 GcsStorageService");
  }
  return config.privateBucket;
}
