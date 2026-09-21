import { randomUUID } from "node:crypto";

import { Logger } from "@nestjs/common";

import { storageError } from "./storage-error";
import type { StorageConfig } from "./storage.config";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSIONS,
  UPLOAD_PATH_PREFIXES,
  UPLOAD_URL_TTL_MS,
  type UploadPurpose,
  isOwnedUploadPath,
} from "./upload-rules";

/** `createUploadUrl` 的輸入(GraphQL 形狀見 models/upload-url.model.ts)。 */
export interface CreateUploadInput {
  purpose: UploadPurpose;
  contentType: string;
  /** 檔案大小(bytes),由前端申報 — 真正的上限由簽名網址的 content-type 與 bucket 端把關。 */
  size: number;
}

/** 一張上傳票:瀏覽器拿 `uploadUrl` 直接 PUT 上去,成功後把 `objectPath` 交回 API 存進資料欄位。 */
export interface UploadTicket {
  uploadUrl: string;
  objectPath: string;
  expiresAt: Date;
}

export interface SignUploadRequest {
  objectPath: string;
  contentType: string;
  expiresAt: Date;
}

/**
 * 檔案儲存介面(ADR-0010):呼叫端只認 `createUploadUrl`(要一張上傳票)與 `readUrlOf`(把存起來的
 * 物件路徑換成短效讀取網址);檔案不經過 API server,DB 存路徑不存 URL。
 * 驗證(檔型 / 大小)、路徑長相、TTL 都在這層決定,供應商只是 `signUploadUrl` / `signReadUrl` 的
 * adapter(GCS 是第一個;本地與測試用記錄用 adapter)。
 * 亦為 Nest 的注入 token(StorageModule 依 GCS_BUCKET_PRIVATE 有無決定實作)。
 */
export abstract class StorageService {
  /** 以實際 adapter 的類別名為 log 前綴(GcsStorageService / RecordingStorageService)。 */
  protected readonly logger: Logger;

  constructor(protected readonly config: StorageConfig) {
    this.logger = new Logger(new.target.name);
  }

  /**
   * 簽一張上傳票:先驗檔型與大小(不合即 `UPLOAD_REJECTED`),再產 `<前綴>/<uuid>.<副檔名>`。
   * 路徑帶 uuid 而非組織 id — 簽票時資料可能還不存在(開通租戶的商標在租戶建立之前就上傳),
   * 歸屬改由 `isOwnedUploadPath` + 寫入端的權限把關。
   */
  async createUploadUrl(input: CreateUploadInput): Promise<UploadTicket> {
    const extension = UPLOAD_EXTENSIONS[input.contentType.trim().toLowerCase()];
    if (extension === undefined) {
      throw storageError(
        "UPLOAD_REJECTED",
        `Unsupported content type: ${input.contentType}`,
      );
    }
    if (!Number.isInteger(input.size) || input.size <= 0) {
      throw storageError(
        "UPLOAD_REJECTED",
        `Invalid file size: ${String(input.size)}`,
      );
    }
    if (input.size > MAX_UPLOAD_BYTES) {
      throw storageError(
        "UPLOAD_REJECTED",
        `File too large: ${String(input.size)} bytes (max ${String(MAX_UPLOAD_BYTES)})`,
      );
    }
    const objectPath = `${UPLOAD_PATH_PREFIXES[input.purpose]}/${randomUUID()}.${extension}`;
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);
    const uploadUrl = await this.signUploadUrl({
      objectPath,
      contentType: input.contentType.trim().toLowerCase(),
      expiresAt,
    });
    return { uploadUrl, objectPath, expiresAt };
  }

  /**
   * 把存在資料欄位裡的物件路徑換成短效讀取網址(TTL `GCS_SIGNED_URL_TTL`);
   * 沒有路徑、或路徑不是本 API 簽出來的(舊資料 / 被塞進來的值)一律回 null,不外洩任意物件。
   * **呼叫端負責先驗「這個人看得到這筆資料嗎」**(ADR-0010:私有檔案的可取範圍 = 該筆資料的可查範圍)。
   */
  async readUrlOf(
    objectPath: string | null | undefined,
  ): Promise<string | null> {
    const path = nonEmptyPath(objectPath);
    if (path === undefined) {
      return null;
    }
    if (!isOwnedUploadPath(path)) {
      this.logger.warn(`物件路徑 ${path} 不是本 API 簽出來的,不簽讀取網址`);
      return null;
    }
    return this.signReadUrl(
      path,
      new Date(Date.now() + this.config.signedUrlTtlMs),
    );
  }

  /** 簽一個只能以該 content type PUT 一次的上傳網址。 */
  protected abstract signUploadUrl(request: SignUploadRequest): Promise<string>;

  /** 簽一個短效讀取網址。 */
  protected abstract signReadUrl(
    objectPath: string,
    expiresAt: Date,
  ): Promise<string>;
}

/** 空字串 / 未設定視同沒有檔案(去空白後判斷)。 */
function nonEmptyPath(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? undefined : trimmed;
}

/** 供寫入端(#134 的 `updateOrg` / `provisionTenant`)驗 `logoPath` 歸屬。 */
export { isOwnedUploadPath } from "./upload-rules";
