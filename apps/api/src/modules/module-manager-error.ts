import { GraphQLError } from "graphql";

/**
 * 模組與權限的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本
 * `docs/standards/api/graphql-schema.md`)。本模組只用得到兩個既有的通用碼,
 * 沒有自己的新碼 — 治理面的寫入只有「切一個布林」,沒有別的失敗形狀。
 * message 給開發者看(英文);使用者文案由前端依 code 對應。
 */
export const MODULE_MANAGER_ERROR_CODES = [
  /** 查的模組 / 權限不存在(id 格式不合法也同碼,不透露差別) */
  "NOT_FOUND",
  /**
   * 有登入但做了不被允許的事:**當前組織不是根組織**,或動到「模組與權限」自己那棵子樹
   * (後者附 `extensions.reason = "SELF_LOCK"`,#261)。
   * 模組與權限是根組織專屬(ADR-0009):權限可能經角色被帶到別的組織,
   * 「站在哪裡」才是判準 — 與租戶作業同一個判斷點(`OwnerProtectionService.isRootOperator`)。
   */
  "FORBIDDEN",
] as const;

export type ModuleManagerErrorCode =
  (typeof MODULE_MANAGER_ERROR_CODES)[number];

/**
 * 自鎖保護(#261 / #233):停用「模組與權限」自己那棵子樹或其權限,
 * 做得成就再也沒有入口把它開回來 — 前端 #209 已把那幾列灰掉,api 這一層是防守。
 */
export const MODULE_MANAGER_SELF_LOCK_REASON = "SELF_LOCK";

export function moduleManagerError(
  code: ModuleManagerErrorCode,
  message: string,
  reason?: typeof MODULE_MANAGER_SELF_LOCK_REASON,
): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code, ...(reason === undefined ? {} : { reason }) },
  });
}
