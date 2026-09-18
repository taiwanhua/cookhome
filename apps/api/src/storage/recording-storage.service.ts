import { type SignUploadRequest, StorageService } from "./storage.service";

export interface RecordedSignature {
  action: "read" | "write";
  objectPath: string;
  contentType?: string;
  expiresAt: Date;
  url: string;
}

/**
 * 記錄用 adapter(ADR-0010 沒有憑證時的替身):不打 GCS,回一個**一眼看得出是假的**網址
 * (`https://recording.storage.invalid/...`,`.invalid` 是保證不存在的 TLD),
 * 並把每次簽名記在 `signed` 供測試斷言。
 * 本地開發沒有 `GCS_BUCKET_PRIVATE`(也沒有 GCP 憑證)時也用它:上傳一定會失敗,但整條流程跑得到底。
 */
export class RecordingStorageService extends StorageService {
  readonly signed: RecordedSignature[] = [];

  protected override signUploadUrl({
    objectPath,
    contentType,
    expiresAt,
  }: SignUploadRequest): Promise<string> {
    return Promise.resolve(
      this.record({ action: "write", objectPath, contentType, expiresAt }),
    );
  }

  protected override signReadUrl(
    objectPath: string,
    expiresAt: Date,
  ): Promise<string> {
    return Promise.resolve(
      this.record({ action: "read", objectPath, expiresAt }),
    );
  }

  private record(signature: Omit<RecordedSignature, "url">): string {
    const url = `https://recording.storage.invalid/${signature.objectPath}?action=${signature.action}&expires=${signature.expiresAt.toISOString()}`;
    this.signed.push({ ...signature, url });
    this.logger.log(
      `[記錄用 adapter,未真的簽名] ${signature.action} ${signature.objectPath}(至 ${signature.expiresAt.toISOString()})`,
    );
    return url;
  }
}
