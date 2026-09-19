import { ClientError } from "@repo/graphql";

import type { ModuleManagerErrorCode } from "./module-manager-types";

/**
 * 本頁會收到的業務錯誤碼(GQL-04;正本 `docs/modules/module-manager.md`「api 介面」:
 * 非根組織 → `FORBIDDEN`、id 查無或格式不合法 → `NOT_FOUND`,沒有本模組專屬的新碼)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.moduleManager.errors.*`。
 */
const MODULE_MANAGER_ERROR_CODES = ["FORBIDDEN", "NOT_FOUND"] as const;

interface GraphqlErrorShape {
  extensions?: { code?: unknown };
}

const errorsOf = (error: unknown): GraphqlErrorShape[] => {
  if (!(error instanceof ClientError)) {
    return [];
  }
  const { errors } = error.response as { errors?: unknown };
  return Array.isArray(errors) ? (errors as GraphqlErrorShape[]) : [];
};

export const moduleManagerErrorOf = (
  error: unknown,
): ModuleManagerErrorCode => {
  for (const item of errorsOf(error)) {
    const { code } = item.extensions ?? {};
    if (
      typeof code === "string" &&
      (MODULE_MANAGER_ERROR_CODES as readonly string[]).includes(code)
    ) {
      return code as ModuleManagerErrorCode;
    }
  }
  return "UNEXPECTED";
};
