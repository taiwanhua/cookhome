/**
 * 種子模組與權限 key 的命名規約(正本:ADR-0004、CONTEXT.md「權限 key 命名」),
 * 由靜態測試全掃 seeds 強制;純函式、不碰資料庫。
 *
 * - 全小寫 kebab-case、以「.」分層(模組與權限皆然)
 * - 子模組 key 必須以父模組 key +「.」為前綴(key 累加父 key,2026-09-17 定案)
 * - 權限 key = 擁有模組 key(moduleId 指向者)+「.」+ 動作;動作恆為單段,`*` 是唯一特殊動作
 * - 每個模組必有且只有一筆 wildcard `<key>.*`(wildcard 只代表該模組自己這一層,含群組、隱藏頁、api 樹)
 * - 隱藏頁(sidebarType=hidden)模組 key 一律 `-page` 結尾,其他型別不得;權限動作禁用 `-page` 結尾;
 *   隱藏的 `api` 模組子樹整體豁免(不是頁面)
 * - key 全域唯一;parentId / moduleId 指向的模組必須已宣告(且先宣告,runner 依序解析)
 */
import {
  type SeedDocument,
  type SeedRegistry,
  isSeedIdReference,
} from "./seed-declaration";

export const MODULES_COLLECTION = "modules";
export const PERMISSIONS_COLLECTION = "permissions";

/**
 * 隱藏的純 API 模組樹根(ADR-0004「API 權限」):不在側欄、也不是頁面,
 * 整棵子樹豁免「hidden 一律 `-page` 結尾」規則。
 */
export const API_MODULE_KEY = "api";

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WILDCARD_ACTION = "*";
const HIDDEN_PAGE_SUFFIX = "-page";

function isInApiTree(key: string): boolean {
  return key === API_MODULE_KEY || key.startsWith(`${API_MODULE_KEY}.`);
}

function isKebabPath(key: string, allowWildcardAction: boolean): boolean {
  const segments = key.split(".");
  return segments.every(
    (segment, index) =>
      KEBAB_SEGMENT.test(segment) ||
      (allowWildcardAction &&
        index === segments.length - 1 &&
        segment === WILDCARD_ACTION),
  );
}

function referencedKey(value: unknown): string | null {
  return isSeedIdReference(value) &&
    value.$seedRef.collection === MODULES_COLLECTION
    ? value.$seedRef.key
    : null;
}

function entriesOf(registry: SeedRegistry, collection: string): SeedDocument[] {
  return registry
    .filter((set) => set.kind === "documents")
    .filter((set) => set.collection === collection)
    .flatMap((set) => set.entries);
}

/** 模組 key 與父模組的關係:kebab、唯一、父已先宣告、累加父 key。 */
function moduleKeyViolations(
  { key, data }: SeedDocument,
  declaredKeys: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  if (!isKebabPath(key, false)) {
    violations.push(`模組 ${key}:key 須為全小寫 kebab-case、以「.」分層`);
  }
  if (declaredKeys.has(key)) {
    violations.push(`模組 ${key}:key 重複宣告`);
  }

  const parentKey = referencedKey(data.parentId);
  if (parentKey === null) {
    return violations;
  }
  if (!declaredKeys.has(parentKey)) {
    violations.push(
      `模組 ${key}:parentId 指向的模組 ${parentKey} 未宣告或宣告順序在後(被引用者須在前)`,
    );
  } else if (!key.startsWith(`${parentKey}.`)) {
    violations.push(
      `模組 ${key}:子模組 key 必須以父模組 key「${parentKey}.」為前綴(key 累加父 key)`,
    );
  }
  return violations;
}

/** 隱藏頁 ⇔ `-page` 結尾(api 子樹豁免)。 */
function hiddenPageViolations({ key, data }: SeedDocument): string[] {
  const isHidden = data.sidebarType === "hidden";
  const endsWithPage = key.endsWith(HIDDEN_PAGE_SUFFIX);
  if (isHidden && !endsWithPage && !isInApiTree(key)) {
    return [`模組 ${key}:隱藏頁模組 key 一律以 ${HIDDEN_PAGE_SUFFIX} 結尾`];
  }
  if (!isHidden && endsWithPage) {
    return [
      `模組 ${key}:只有隱藏頁(sidebarType=hidden)可以 ${HIDDEN_PAGE_SUFFIX} 結尾`,
    ];
  }
  return [];
}

function checkModules(modules: SeedDocument[]): {
  violations: string[];
  declaredKeys: Set<string>;
} {
  const violations: string[] = [];
  const declaredKeys = new Set<string>();
  for (const module of modules) {
    violations.push(
      ...moduleKeyViolations(module, declaredKeys),
      ...hiddenPageViolations(module),
    );
    declaredKeys.add(module.key);
  }
  return { violations, declaredKeys };
}

interface PermissionKeyParts {
  ownerPrefix: string;
  action: string;
  moduleKey: string | null;
}

function splitPermissionKey({ key, data }: SeedDocument): PermissionKeyParts {
  const separatorIndex = key.lastIndexOf(".");
  return {
    ownerPrefix: separatorIndex === -1 ? "" : key.slice(0, separatorIndex),
    action: key.slice(separatorIndex + 1),
    moduleKey: referencedKey(data.moduleId),
  };
}

/** 權限 key 的形狀:kebab、唯一、`擁有模組key.動作`、動作單段。 */
function permissionKeyViolations(
  { key }: SeedDocument,
  { ownerPrefix, moduleKey }: PermissionKeyParts,
  moduleKeys: ReadonlySet<string>,
  declaredKeys: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  if (!isKebabPath(key, true)) {
    violations.push(`權限 ${key}:key 須為全小寫 kebab-case、以「.」分層`);
  }
  if (declaredKeys.has(key)) {
    violations.push(`權限 ${key}:key 重複宣告`);
  }
  if (moduleKey === null || !moduleKeys.has(moduleKey)) {
    violations.push(
      `權限 ${key}:moduleId 須以 seedRef 指向已宣告的模組(目前:${moduleKey ?? "無"})`,
    );
  } else if (ownerPrefix !== moduleKey) {
    violations.push(
      `權限 ${key}:key 須為「擁有模組 key(${moduleKey}).動作」且動作恆為單段`,
    );
  }
  return violations;
}

/** 權限動作禁 `-page` 結尾;模組 key 與權限 key 永不同字串。 */
function pageActionViolations(
  { key }: SeedDocument,
  { action }: PermissionKeyParts,
  moduleKeys: ReadonlySet<string>,
): string[] {
  if (action.endsWith(HIDDEN_PAGE_SUFFIX)) {
    return [
      `權限 ${key}:動作禁用 ${HIDDEN_PAGE_SUFFIX} 結尾(模組 key 與權限 key 永不同字串)`,
    ];
  }
  return moduleKeys.has(key) ? [`權限 ${key}:與模組 key 同字串`] : [];
}

function checkPermissions(
  permissions: SeedDocument[],
  moduleKeys: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  const declaredKeys = new Set<string>();
  const wildcardCountByModule = new Map<string, number>(
    [...moduleKeys].map((moduleKey) => [moduleKey, 0]),
  );

  for (const permission of permissions) {
    const parts = splitPermissionKey(permission);
    violations.push(
      ...permissionKeyViolations(permission, parts, moduleKeys, declaredKeys),
      ...pageActionViolations(permission, parts, moduleKeys),
    );
    if (
      parts.action === WILDCARD_ACTION &&
      parts.moduleKey !== null &&
      parts.ownerPrefix === parts.moduleKey
    ) {
      wildcardCountByModule.set(
        parts.moduleKey,
        (wildcardCountByModule.get(parts.moduleKey) ?? 0) + 1,
      );
    }
    declaredKeys.add(permission.key);
  }

  for (const [moduleKey, count] of wildcardCountByModule) {
    if (count !== 1) {
      violations.push(
        `模組 ${moduleKey}:必有且只有一筆 wildcard「${moduleKey}.${WILDCARD_ACTION}」(目前 ${String(count)} 筆)`,
      );
    }
  }
  return violations;
}

/** 全掃 registry 內的模組與權限宣告,回傳違規訊息(空陣列 = 全部合規)。 */
export function findSeedKeyViolations(registry: SeedRegistry): string[] {
  const { violations, declaredKeys } = checkModules(
    entriesOf(registry, MODULES_COLLECTION),
  );
  return [
    ...violations,
    ...checkPermissions(
      entriesOf(registry, PERMISSIONS_COLLECTION),
      declaredKeys,
    ),
  ];
}
