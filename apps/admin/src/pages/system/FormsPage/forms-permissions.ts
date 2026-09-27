/**
 * 表單管理的權限 key(正本 `docs/modules/forms.md`「模組 key 與權限表」,seed
 * `apps/db-migrator/seeds/modules/system.ts`)。**不是**根組織專屬:租戶管理員管自己的客製表單;
 * 「是不是自己的表單 / 站在根組織」由 api 算在 `form.abilities`,前端直接用、不再相乘。
 */
export const FORMS_MODULE_KEY = "system.forms";

export const FORMS_PERMISSIONS = {
  view: `${FORMS_MODULE_KEY}.view`,
  /** 建共用表單(只有站在根組織;租戶打了會回 `FORBIDDEN` + `ROOT_ONLY`) */
  create: `${FORMS_MODULE_KEY}.create`,
  edit: `${FORMS_MODULE_KEY}.edit`,
  assign: `${FORMS_MODULE_KEY}.assign`,
  setEnabled: `${FORMS_MODULE_KEY}.set-enabled`,
} as const;
