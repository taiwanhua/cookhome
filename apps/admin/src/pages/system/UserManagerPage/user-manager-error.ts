import { ClientError } from "@repo/graphql";

/**
 * 使用者管理會收到的業務錯誤碼(GQL-04;api 的程式正本 `apps/api/src/users/users-error.ts`)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.userManager.errors.*`。
 */
export const USER_MANAGER_ERROR_CODES = [
  "OWNER_PROTECTED",
  "LAST_ORG",
  "ROLE_OUT_OF_REACH",
  /** #261:使用者不在角色擁有組織的子樹內(在此之前回 VALIDATION_FAILED,只講得出「資料未通過驗證」) */
  "USER_NOT_ELIGIBLE",
  "FORBIDDEN",
  "VALIDATION_FAILED",
] as const;

export type UserManagerErrorCode =
  (typeof USER_MANAGER_ERROR_CODES)[number] | "UNEXPECTED";

export interface UserManagerError {
  code: UserManagerErrorCode;
  /** `VALIDATION_FAILED` 時 api 以 `extensions.fields` 指出重複 / 不合法的欄位 */
  fields: string[];
}

interface GraphqlErrorShape {
  extensions?: { code?: unknown; fields?: unknown };
}

const errorsOf = (error: unknown): GraphqlErrorShape[] => {
  if (!(error instanceof ClientError)) {
    return [];
  }
  const { errors } = error.response as { errors?: unknown };
  return Array.isArray(errors) ? (errors as GraphqlErrorShape[]) : [];
};

const isKnownCode = (value: unknown): value is UserManagerErrorCode =>
  typeof value === "string" &&
  (USER_MANAGER_ERROR_CODES as readonly string[]).includes(value);

export const userManagerErrorOf = (error: unknown): UserManagerError => {
  for (const item of errorsOf(error)) {
    const { code, fields } = item.extensions ?? {};
    if (isKnownCode(code)) {
      return {
        code,
        fields: Array.isArray(fields)
          ? fields.filter((field): field is string => typeof field === "string")
          : [],
      };
    }
  }
  return { code: "UNEXPECTED", fields: [] };
};
