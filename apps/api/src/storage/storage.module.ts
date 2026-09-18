import { Logger, Module } from "@nestjs/common";

import { GcsStorageService } from "./gcs-storage.service";
import { MeOrgLogoResolver } from "./me-org-logo.resolver";
import { RecordingStorageService } from "./recording-storage.service";
import {
  STORAGE_CONFIG,
  type StorageConfig,
  storageConfigProvider,
} from "./storage.config";
import { StorageResolver } from "./storage.resolver";
import { StorageService } from "./storage.service";

/**
 * 依設定選 adapter:有 GCS_BUCKET_PRIVATE → GCS(簽名走執行身分的 IAM signBlob,無金鑰檔);
 * 沒有 → 記錄用 adapter(回假網址)。缺設定不讓 api 啟動失敗 — 本地與測試本來就沒有 GCP 憑證;
 * 雲端漏設會在 log 看到警告(寫法與 MailModule 一致)。
 */
export function createStorageService(config: StorageConfig): StorageService {
  if (config.privateBucket) {
    return new GcsStorageService(config);
  }
  new Logger(StorageModule.name).warn(
    "GCS_BUCKET_PRIVATE 未設定,改用記錄用 adapter:簽名網址是假的、檔案不會真的上傳",
  );
  return new RecordingStorageService(config);
}

/** 檔案儲存(ADR-0010)。呼叫端只注入 `StorageService`,不認得供應商。 */
@Module({
  providers: [
    storageConfigProvider,
    {
      provide: StorageService,
      inject: [STORAGE_CONFIG],
      useFactory: createStorageService,
    },
    StorageResolver,
    MeOrgLogoResolver,
  ],
  exports: [StorageService],
})
export class StorageModule {}
