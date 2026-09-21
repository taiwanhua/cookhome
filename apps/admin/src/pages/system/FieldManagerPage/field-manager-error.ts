import { ClientError } from "@repo/graphql";

import type { FieldManagerErrorCode } from "./field-manager-types";

/**
 * 本頁會收到的業務錯誤碼(GQL-04;正本 `docs/modules/field-manager.md`「api 介面」)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.fieldManager.errors.*`。
 *
 * `FORBIDDEN` 依 `extensions.reason` 再分一層(#264):`NOT_OWNER` 是「別的組織加的選項」,
 * 與種子選項的全域開關是兩回事,文案不同 —— 所以它在本頁被當成獨立的一碼。
 */
const FIELD_MANAGER_ERROR_CODES = [
  "FIELD_VALUE_DUPLICATE",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
] as const;

interface GraphqlErrorShape {
  extensions?: { code?: unknown; reason?: unknown };
}

const errorsOf = (error: unknown): GraphqlErrorShape[] => {
  if (!(error instanceof ClientError)) {
    return [];
  }
  const { errors } = error.response as { errors?: unknown };
  return Array.isArray(errors) ? (errors as GraphqlErrorShape[]) : [];
};

export const fieldManagerErrorOf = (error: unknown): FieldManagerErrorCode => {
  for (const item of errorsOf(error)) {
    const { code, reason } = item.extensions ?? {};
    if (typeof code !== "string") {
      continue;
    }
    if (code === "FORBIDDEN" && reason === "NOT_OWNER") {
      return "NOT_OWNER";
    }
    if ((FIELD_MANAGER_ERROR_CODES as readonly string[]).includes(code)) {
      return code as FieldManagerErrorCode;
    }
  }
  return "UNEXPECTED";
};
