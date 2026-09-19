import { GraphQLError } from "graphql";

/**
 * 角色管理的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本 docs/standards/api/graphql-schema.md)。
 * message 給開發者看(英文);使用者文案由前端依 code 對應。
 * 沿用的通用碼(`FORBIDDEN` / `NOT_FOUND` / `VALIDATION_FAILED`)不重複宣告於此。
 */
export const ROLE_ERROR_CODES = [
  /**
   * 防越權(ADR-0004「操作者只能授出自身有效權限集的子集」):
   * 權限矩陣送出的模組 / 權限不在操作者的有效權限集內,或租戶副本被擴權(只能縮不能擴)。
   * 與使用者管理的同名碼是同一件事的兩個入口(指派角色 / 編輯矩陣),清單正本是 GQL-04 的表。
   */
  "ROLE_OUT_OF_REACH",
  /** 刪除前置檢查未通過;`extensions.reasons` 逐項列出(docs/modules/role-manager.md 權限表「刪除」) */
  "ROLE_NOT_DELETABLE",
  /** 加入使用者的候選規則未過:該使用者的所屬組織皆不在角色擁有組織的子樹內(ADR-0003) */
  "USER_NOT_ELIGIBLE",
  /** 擁有者保護(ADR-0009):租戶擁有者的「租戶管理員」授予不可被解除(根組織操作者不受限) */
  "OWNER_PROTECTED",
] as const;

export type RoleErrorCode = (typeof ROLE_ERROR_CODES)[number];

/**
 * 刪除被擋的原因(docs/modules/role-manager.md 權限表「刪除」的前置三項)。
 * 前端逐項對應中文提示,並引導改用停用。
 */
export const ROLE_NOT_DELETABLE_REASONS = [
  /** 還有人被授予這個角色(`user_role`);先在「分配使用者」把人移除 */
  "HAS_GRANTS",
  /** 種子角色(`roles.isSystem` 或有 `key`):隨底座出貨,不可刪 */
  "SYSTEM_ROLE",
  /** 開通租戶時複製出來的租戶管理員副本(`settings.templateKey`,ADR-0009):租戶的根本角色,不可刪 */
  "TEMPLATE_COPY",
] as const;

export type RoleNotDeletableReason =
  (typeof ROLE_NOT_DELETABLE_REASONS)[number];

export function roleError(code: RoleErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

/** 刪除前置未過:`ROLE_NOT_DELETABLE` + `extensions.reasons`(逐項列出,前端一次顯示全部)。 */
export function roleNotDeletableError(
  reasons: readonly RoleNotDeletableReason[],
): GraphQLError {
  return new GraphQLError(`Role is not deletable: ${reasons.join(", ")}`, {
    extensions: { code: "ROLE_NOT_DELETABLE", reasons },
  });
}

/** 查的角色 / 組織 / 使用者在操作者管理範圍內不存在(GQL-04 `NOT_FOUND`)。 */
export function notFoundError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

/** 有登入但做了不被允許的事(GQL-04 `FORBIDDEN`):碰管理範圍外的組織。 */
export function forbiddenError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

/**
 * 輸入不合法(GQL-04 `VALIDATION_FAILED`):`extensions.fields` 列出有問題的欄位,
 * 前端據此把錯誤標在對應的表單欄位上(如空白名稱)。
 */
export function validationError(
  message: string,
  fields: string[],
): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "VALIDATION_FAILED", fields },
  });
}
