import { GraphQLError } from "graphql";

/**
 * 檔案儲存的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本 docs/standards/api/graphql-schema.md)。
 * message 給開發者看(英文);使用者文案由前端依 code 對應。
 */
export const STORAGE_ERROR_CODES = [
  /** 上傳被拒:檔型不在白名單、或大小超過上限(ADR-0010) */
  "UPLOAD_REJECTED",
] as const;

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

export function storageError(
  code: StorageErrorCode,
  message: string,
): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
