import { permissionKey } from "@repo/domain/permission";

/**
 * 表單引擎用到的權限 key(seed 正本 `apps/db-migrator/seeds/modules/system.ts`、各表單模組的 seed 宣告)。
 */

/** 表單管理(`system.forms`)模組 key 與權限。 */
export const FORMS_MODULE_KEY = "system.forms";
export const FORMS_PERMISSIONS = {
  view: `${FORMS_MODULE_KEY}.view`,
  create: `${FORMS_MODULE_KEY}.create`,
  edit: `${FORMS_MODULE_KEY}.edit`,
  assign: `${FORMS_MODULE_KEY}.assign`,
  setEnabled: `${FORMS_MODULE_KEY}.set-enabled`,
} as const;

/** 模組與權限頁的「刪除退役權限」(根組織專屬模組)。 */
export const DELETE_RETIRED_PERMISSION =
  "system.module-manager.delete-retired-permission";
export const MODULE_MANAGER_VIEW = "system.module-manager.view";

/** 表單模組的四筆個別權限(seed 宣告的形狀;見 `seeds/modules/shopping-list.ts`)。 */
export type FormModuleAction = "view" | "create" | "edit" | "delete";

export function formModulePermission(
  moduleKey: string,
  action: FormModuleAction,
): string {
  return permissionKey(moduleKey, action);
}

/** 欄位級權限的兩種動作。 */
export type FieldPermissionAction = "show" | "edit";

/**
 * 欄位級權限 key:`<moduleKey>.show-<formKey>-<fieldKey>` / `<moduleKey>.edit-<formKey>-<fieldKey>`
 * (Spec 6a §6)。formKey 與 fieldKey 不含 `-` / `.`,所以動作段一定能唯一拆回。
 */
export function fieldPermissionKey(
  moduleKey: string,
  action: FieldPermissionAction,
  formKey: string,
  fieldKey: string,
): string {
  return permissionKey(moduleKey, `${action}-${formKey}-${fieldKey}`);
}

/** 某張表單全部欄位級權限的 key 前綴(`<moduleKey>.show-<formKey>-`),發布步驟 3 找「不再宣告的」用。 */
export function fieldPermissionPrefix(
  moduleKey: string,
  action: FieldPermissionAction,
  formKey: string,
): string {
  return permissionKey(moduleKey, `${action}-${formKey}-`);
}

export interface ParsedFieldPermissionKey {
  moduleKey: string;
  action: FieldPermissionAction;
  formKey: string;
  fieldKey: string;
}

const FIELD_ACTION = /^(show|edit)-([a-z][a-z0-9_]*)-([a-z][a-z0-9_]*)$/;

/** 把欄位級權限 key 拆回四段;不是這個形狀回 null。 */
export function parseFieldPermissionKey(
  key: string,
): ParsedFieldPermissionKey | null {
  const separator = key.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }
  const match = FIELD_ACTION.exec(key.slice(separator + 1));
  if (!match) {
    return null;
  }
  const [, action, formKey, fieldKey] = match;
  if (!action || !formKey || !fieldKey) {
    return null;
  }
  return {
    moduleKey: key.slice(0, separator),
    action: action as FieldPermissionAction,
    formKey,
    fieldKey,
  };
}

/** 權限顯示名:「<表單名> / <欄位 label> 可見 / 可改」(矩陣靠它顯示)。 */
export function fieldPermissionName(
  formName: string,
  fieldLabel: string,
  action: FieldPermissionAction,
): string {
  return `${formName} / ${fieldLabel} ${action === "show" ? "可見" : "可改"}`;
}
