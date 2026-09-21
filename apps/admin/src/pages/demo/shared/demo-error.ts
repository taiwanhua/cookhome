import { ClientError } from "@repo/graphql";

/**
 * 示範家族三頁會收到的業務錯誤(GQL-04)。文案在 `<ns>.errors.*`,認不出來的一律 `UNEXPECTED`。
 *
 * `FORBIDDEN` 依 `extensions.reason` 再分一層:`FIELD_FORBIDDEN` 是「端點可以用,
 * 但你硬送了一個改不動的欄位」,與「整個端點沒權限」是兩種說法、兩種文案
 * (對照組沒有欄位級權限,所以它永遠不會收到這一碼 —— 共用的解讀器仍然認得它)。
 */
export type DemoErrorCode =
  | "FIELD_FORBIDDEN"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNEXPECTED";

export interface DemoError {
  code: DemoErrorCode;
  /**
   * `VALIDATION_FAILED` 時 api 逐項回報的欄位名(`name` / `category` / `coverPath`…),
   * 前端據此把錯誤標在對應的表單欄位上;其餘情況為空陣列。
   */
  fields: readonly string[];
}

const DEMO_ERROR_CODES = new Set<string>([
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
]);

interface GraphqlErrorShape {
  extensions?: { code?: unknown; reason?: unknown; fields?: unknown };
}

const errorsOf = (error: unknown): GraphqlErrorShape[] => {
  if (!(error instanceof ClientError)) {
    return [];
  }
  const { errors } = error.response as { errors?: unknown };
  return Array.isArray(errors) ? (errors as GraphqlErrorShape[]) : [];
};

const fieldsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

/**
 * `FIELD_FORBIDDEN` 時要標在哪個欄位上 —— api 只說「有個欄位你動不得」,不說是哪一個
 * (說了等於洩漏欄位存在)。目前只有示範模組1 的內部備註是欄位級權限欄,所以就標它。
 */
const FIELD_FORBIDDEN_FIELDS = ["internalNote"] as const;

export const demoErrorOf = (error: unknown): DemoError => {
  for (const item of errorsOf(error)) {
    const { code, reason, fields } = item.extensions ?? {};
    if (typeof code !== "string") {
      continue;
    }
    if (code === "FORBIDDEN" && reason === "FIELD_FORBIDDEN") {
      return { code: "FIELD_FORBIDDEN", fields: [...FIELD_FORBIDDEN_FIELDS] };
    }
    if (DEMO_ERROR_CODES.has(code)) {
      return { code: code as DemoErrorCode, fields: fieldsOf(fields) };
    }
  }
  return { code: "UNEXPECTED", fields: [] };
};

/** 這個欄位上有沒有錯誤(表單把 `helperText` / `error` 標在對的欄位上)。 */
export const hasFieldError = (
  error: DemoError | null,
  field: string,
): boolean => error?.fields.includes(field) ?? false;
