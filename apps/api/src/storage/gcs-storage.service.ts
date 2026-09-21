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

/** 公開 bucket 的穩定讀取網址前綴(ADR-0010:公開檔案不簽名、直接放 `<img src>`)。 */
const PUBLIC_URL_BASE = "https://storage.googleapis.com";

/**
 * GCS adapter(ADR-0010):V4 簽名的上傳 / 讀取網址。
 *
 * **兩顆 bucket**:`GCS_BUCKET_PRIVATE` 放私有檔案(商標、示範附件,讀取現簽短效網址),
 * `GCS_BUCKET_PUBLIC` 放公開檔案(示範封面,回穩定 URL)。要落在哪一顆由 `purpose` 衍生
 * (`UPLOAD_VISIBILITIES`),呼叫端不選 bucket。公開 bucket 未設定時退回私有 bucket 並記一筆警告 —
 * 缺設定不讓 api 啟動失敗(與 StorageModule 選 adapter 同一原則)。
 *
 * **簽名不用金鑰檔**:`new Storage()` 走 ADC —— 在 Cloud Run 上即執行身分的中繼資料 token,
 * SDK 沒有私鑰可簽時自動改呼叫 IAM Credentials 的 `signBlob`(所以該 SA 要對自己持
 * `roles/iam.serviceAccountTokenCreator`、專案要開 `iamcredentials.googleapis.com`;
 * 建立步驟見 docs/deployment.md)。本機沒有憑證,連 adapter 都不會被選中(改用記錄用 adapter)。
 */
export class GcsStorageService extends StorageService {
  private readonly bucket: GcsBucket;
  private readonly publicBucket: GcsBucket;

  constructor(
    config: StorageConfig,
    bucket?: GcsBucket,
    publicBucket?: GcsBucket,
  ) {
    super(config);
    this.bucket = bucket ?? new Storage().bucket(requireBucket(config));
    this.publicBucket =
      publicBucket ??
      (config.publicBucket === undefined
        ? this.bucket
        : new Storage().bucket(config.publicBucket));
    if (config.publicBucket === undefined && publicBucket === undefined) {
      this.logger.warn(
        "GCS_BUCKET_PUBLIC 未設定,公開檔案改放私有 bucket:穩定 URL 會取不到物件",
      );
    }
  }

  protected override async signUploadUrl({
    objectPath,
    contentType,
    expiresAt,
    visibility,
  }: SignUploadRequest): Promise<string> {
    const target = visibility === "public" ? this.publicBucket : this.bucket;
    const [url] = await target.file(objectPath).getSignedUrl({
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

  protected override publicUrl(objectPath: string): string {
    const bucketName = this.config.publicBucket ?? this.config.privateBucket;
    return `${PUBLIC_URL_BASE}/${bucketName ?? ""}/${objectPath}`;
  }
}

function requireBucket(config: StorageConfig): string {
  if (config.privateBucket === undefined) {
    throw new Error("GCS_BUCKET_PRIVATE 未設定,無法建立 GcsStorageService");
  }
  return config.privateBucket;
}
