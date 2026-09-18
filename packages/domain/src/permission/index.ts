/**
 * 權限 key 的純邏輯(前後端同一份,STRUCT-07;規則正本:ADR-0004、ADR-0011「key 切分共識」):
 * - key = 擁有模組 key + `.` + 動作;動作恆為單段,`*` 是唯一特殊動作
 * - 切分:最後一段 = 動作,其餘 = 擁有模組 key(切字串僅供人讀與組 key;歸屬的真相仍是 `permissions.moduleId`)
 */

/** wildcard 動作:代表擁有模組**自己這一層**的全部權限(不含子模組,ADR-0004 同層語意)。 */
export const WILDCARD_ACTION = "*";

/** key 的分層符號。 */
export const PERMISSION_KEY_SEPARATOR = ".";

export interface PermissionKeyParts {
  /** 擁有模組 key(= 路由層級累加)。 */
  moduleKey: string;
  /** 動作(單段;`*` 為 wildcard)。 */
  action: string;
}

/** 切分權限 key:最後一段 = 動作,其餘 = 擁有模組 key。沒有分層符號的字串不是合法權限 key(權限必屬某模組)。 */
export function splitPermissionKey(key: string): PermissionKeyParts {
  const separatorIndex = key.lastIndexOf(PERMISSION_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    throw new Error(
      `Invalid permission key "${key}": expected "<module key>.<action>"`,
    );
  }
  return {
    moduleKey: key.slice(0, separatorIndex),
    action: key.slice(separatorIndex + 1),
  };
}

/** 權限的擁有模組 key(切字串所得;歸屬真相仍是 moduleId 欄位)。 */
export function ownerModuleKey(key: string): string {
  return splitPermissionKey(key).moduleKey;
}

/** 權限的動作(key 最後一段)。 */
export function permissionAction(key: string): string {
  return splitPermissionKey(key).action;
}

/** 組權限 key:`<模組 key>.<動作>`。 */
export function permissionKey(moduleKey: string, action: string): string {
  return `${moduleKey}${PERMISSION_KEY_SEPARATOR}${action}`;
}

/** 模組的 wildcard 權限 key:`<模組 key>.*`(每個模組固定有一筆)。 */
export function wildcardKeyOf(moduleKey: string): string {
  return permissionKey(moduleKey, WILDCARD_ACTION);
}

/**
 * 判斷是否持有某權限(ADR-0011,前後端同一條規則):
 * key 在集合中,或「該權限的擁有模組 key + `.*`」在集合中 — 兩次 Set 查表,不掃字串前綴。
 * 同層語意:父模組的 `*` 不涵蓋子模組(ADR-0004);聯集、純加法、沒有 deny。
 * `granted` 為有效權限 key 的集合(後端:PermissionResolver 的結果;前端:模組陣列組成的全域權限結構)。
 */
export function hasPermission(
  granted: ReadonlySet<string>,
  key: string,
): boolean {
  if (granted.has(key)) {
    return true;
  }
  return granted.has(wildcardKeyOf(ownerModuleKey(key)));
}
