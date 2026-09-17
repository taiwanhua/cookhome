/**
 * 種子模組與權限 key 的命名規約(正本:ADR-0004、CONTEXT.md「權限 key 命名」),
 * 由靜態測試全掃 seeds 強制;純函式、不碰資料庫。
 *
 * - 全小寫 kebab-case、以「.」分層(模組與權限皆然)
 * - 權限 key = 擁有模組 key(moduleId 指向者)+「.」+ 動作;動作恆為單段,`*` 是唯一特殊動作
 * - 隱藏頁(sidebarType=hidden)模組 key 一律 `-page` 結尾,其他型別不得;權限動作禁用 `-page` 結尾
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
 * 是唯一不以 `-page` 結尾的 hidden 模組。
 */
export const API_MODULE_KEY = "api";

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WILDCARD_ACTION = "*";
const HIDDEN_PAGE_SUFFIX = "-page";

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

function checkModules(modules: SeedDocument[]): {
  violations: string[];
  declaredKeys: Set<string>;
} {
  const violations: string[] = [];
  const declaredKeys = new Set<string>();

  for (const { key, data } of modules) {
    if (!isKebabPath(key, false)) {
      violations.push(`模組 ${key}:key 須為全小寫 kebab-case、以「.」分層`);
    }
    if (declaredKeys.has(key)) {
      violations.push(`模組 ${key}:key 重複宣告`);
    }

    const parentKey = referencedKey(data.parentId);
    if (parentKey !== null && !declaredKeys.has(parentKey)) {
      violations.push(
        `模組 ${key}:parentId 指向的模組 ${parentKey} 未宣告或宣告順序在後(被引用者須在前)`,
      );
    }

    const isHidden = data.sidebarType === "hidden";
    const endsWithPage = key.endsWith(HIDDEN_PAGE_SUFFIX);
    if (isHidden && !endsWithPage && key !== API_MODULE_KEY) {
      violations.push(
        `模組 ${key}:隱藏頁模組 key 一律以 ${HIDDEN_PAGE_SUFFIX} 結尾`,
      );
    }
    if (!isHidden && endsWithPage) {
      violations.push(
        `模組 ${key}:只有隱藏頁(sidebarType=hidden)可以 ${HIDDEN_PAGE_SUFFIX} 結尾`,
      );
    }

    declaredKeys.add(key);
  }

  return { violations, declaredKeys };
}

function checkPermissions(
  permissions: SeedDocument[],
  moduleKeys: Set<string>,
): string[] {
  const violations: string[] = [];
  const declaredKeys = new Set<string>();

  for (const { key, data } of permissions) {
    if (!isKebabPath(key, true)) {
      violations.push(`權限 ${key}:key 須為全小寫 kebab-case、以「.」分層`);
    }
    if (declaredKeys.has(key)) {
      violations.push(`權限 ${key}:key 重複宣告`);
    }

    const separatorIndex = key.lastIndexOf(".");
    const ownerPrefix =
      separatorIndex === -1 ? "" : key.slice(0, separatorIndex);
    const action = key.slice(separatorIndex + 1);
    const moduleKey = referencedKey(data.moduleId);

    if (moduleKey === null || !moduleKeys.has(moduleKey)) {
      violations.push(
        `權限 ${key}:moduleId 須以 seedRef 指向已宣告的模組(目前:${moduleKey ?? "無"})`,
      );
    } else if (ownerPrefix !== moduleKey) {
      violations.push(
        `權限 ${key}:key 須為「擁有模組 key(${moduleKey}).動作」且動作恆為單段`,
      );
    }

    if (action.endsWith(HIDDEN_PAGE_SUFFIX)) {
      violations.push(
        `權限 ${key}:動作禁用 ${HIDDEN_PAGE_SUFFIX} 結尾(模組 key 與權限 key 永不同字串)`,
      );
    } else if (moduleKeys.has(key)) {
      violations.push(`權限 ${key}:與模組 key 同字串`);
    }

    declaredKeys.add(key);
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
