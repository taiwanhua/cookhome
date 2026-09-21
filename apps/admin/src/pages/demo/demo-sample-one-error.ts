import { ClientError } from "@repo/graphql";

/**
 * 示範模組1 三頁會收到的業務錯誤(GQL-04;正本 `docs/modules/demo.sub.sample-one.md`「錯誤」)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.demoSampleOne.errors.*`。
 *
 * `FORBIDDEN` 依 `extensions.reason` 再分一層:`FIELD_FORBIDDEN` 是「端點可以用,
 * 但你硬送了一個改不動的欄位(內部備註)」,與「整個端點沒權限」是兩種說法、兩種文案。
 */
export type SampleOneErrorCode =
  | "FIELD_FORBIDDEN"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNEXPECTED";

export interface SampleOneError {
  code: SampleOneErrorCode;
  /**
   * `VALIDATION_FAILED` 時 api 逐項回報的欄位名(`name` / `category` / `coverPath`…),
   * 前端據此把錯誤標在對應的表單欄位上;其餘情況為空陣列。
   */
  fields: readonly string[];
}

const SAMPLE_ONE_ERROR_CODES = new Set<string>([
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

export const sampleOneErrorOf = (error: unknown): SampleOneError => {
  for (const item of errorsOf(error)) {
    const { code, reason, fields } = item.extensions ?? {};
    if (typeof code !== "string") {
      continue;
    }
    if (code === "FORBIDDEN" && reason === "FIELD_FORBIDDEN") {
      return { code: "FIELD_FORBIDDEN", fields: ["internalNote"] };
    }
    if (SAMPLE_ONE_ERROR_CODES.has(code)) {
      return {
        code: code as SampleOneErrorCode,
        fields: fieldsOf(fields),
      };
    }
  }
  return { code: "UNEXPECTED", fields: [] };
};

/** 這個欄位上有沒有錯誤(表單把 `helperText` / `error` 標在對的欄位上)。 */
export const hasFieldError = (
  error: SampleOneError | null,
  field: string,
): boolean => error?.fields.includes(field) ?? false;
