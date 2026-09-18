import {
  type SeedDocument,
  type SeedDocumentSet,
  seedRef,
} from "../src/seed/seed-declaration";
import {
  MODULES_COLLECTION,
  PERMISSIONS_COLLECTION,
} from "../src/seed/seed-key-convention";
import {
  type ModuleNodeDeclaration,
  type ModuleSeedDeclaration,
  type PermissionDeclaration,
  wildcardPermission,
} from "./module-declaration";
import { apiModules } from "./modules/api";
import { sampleTwoModule } from "./modules/demo.sample-two";
import { sampleOneModule } from "./modules/demo.sub.sample-one";
import { overviewModule } from "./modules/overview";
import { systemModules } from "./modules/system";

export const DATA_SCOPE_TARGETS_COLLECTION = "data_scope_targets";

/**
 * 全部模組宣告(ADR-0002:每模組一檔,在此收齊)。順序即宣告順序:父在前
 * (跨檔引用的父 — 如示範模組2 掛 `demo` — 由 sample-one 檔先宣告)。
 */
const moduleDeclarations: ModuleSeedDeclaration[] = [
  overviewModule,
  systemModules,
  apiModules,
  sampleOneModule,
  sampleTwoModule,
];

/** 全部模組樹節點(依宣告順序),供角色綁定等其他種子推導。 */
export const moduleNodes: ModuleNodeDeclaration[] = moduleDeclarations.flatMap(
  (declaration) => declaration.nodes,
);

/**
 * 全部權限宣告:每個模組自動一筆 wildcard(含群組、隱藏頁、api 樹;wildcard 只代表該模組自己這一層)
 * + 各模組檔宣告的個別權限。
 */
export const permissionDeclarations: PermissionDeclaration[] = [
  ...moduleNodes.map((node) => wildcardPermission(node)),
  ...moduleDeclarations.flatMap((declaration) => declaration.permissions ?? []),
];

const nodeByKey = new Map(moduleNodes.map((node) => [node.key, node]));

/** 由根到父的祖先 key(物化路徑,ADR-0005)。 */
function ancestorKeys(node: ModuleNodeDeclaration): string[] {
  const keys: string[] = [];
  let parentKey = node.parentKey;
  while (parentKey !== null) {
    const parent = nodeByKey.get(parentKey);
    if (!parent) {
      throw new Error(`模組 ${node.key} 的上層模組 ${parentKey} 未宣告`);
    }
    keys.unshift(parent.key);
    parentKey = parent.parentKey;
  }
  return keys;
}

/** 根組織專屬:自己或任一祖先標 isRootOnly(ADR-0009 模板扣除之)。 */
export function isRootOnlyModule(key: string): boolean {
  const node = nodeByKey.get(key);
  if (!node) {
    throw new Error(`模組 ${key} 未宣告`);
  }
  return [
    node,
    ...ancestorKeys(node).map((ancestorKey) => nodeByKey.get(ancestorKey)),
  ].some((candidate) => candidate?.isRootOnly === true);
}

/** 模組節點 → modules 文件(欄位形狀:module.schema.ts;key/isSystem 由 runner 補)。 */
function toModuleDocument(node: ModuleNodeDeclaration): SeedDocument {
  return {
    key: node.key,
    data: {
      name: node.name,
      parentId:
        node.parentKey === null
          ? null
          : seedRef(MODULES_COLLECTION, node.parentKey),
      ancestors: ancestorKeys(node).map((ancestorKey) =>
        seedRef(MODULES_COLLECTION, ancestorKey),
      ),
      ...(node.route === undefined ? {} : { route: node.route }),
      sidebarType: node.sidebarType,
      order: node.order,
      // 初始 seed 值(runner 預設 initialSeedValueFields=["enabled"]):建立後由人在系統內管理
      enabled: true,
      ...(node.description === undefined
        ? {}
        : { description: node.description }),
      settings: {},
    },
  };
}

/** 權限 → permissions 文件(欄位形狀:permission.schema.ts;moduleId 直接欄位,ADR-0001/0004)。 */
function toPermissionDocument(permission: PermissionDeclaration): SeedDocument {
  return {
    key: permission.key,
    data: {
      moduleId: seedRef(MODULES_COLLECTION, permission.moduleKey),
      name: permission.name,
      ...(permission.description === undefined
        ? {}
        : { description: permission.description }),
      enabled: true,
      settings: {},
    },
  };
}

/** 模組樹(全部節點;正本:docs/modules/*.md)。 */
export const modules: SeedDocumentSet = {
  kind: "documents",
  collection: MODULES_COLLECTION,
  entries: moduleNodes.map((node) => toModuleDocument(node)),
};

/** 權限(每模組一筆 wildcard + 示範家族個別權限;治理模組個別權限表補正本後再種)。 */
export const permissions: SeedDocumentSet = {
  kind: "documents",
  collection: PERMISSIONS_COLLECTION,
  entries: permissionDeclarations.map((permission) =>
    toPermissionDocument(permission),
  ),
};

/** 資料範圍目標(ADR-0008;以 collection 為識別鍵,schema 無 key 欄位)。 */
export const dataScopeTargets: SeedDocumentSet = {
  kind: "documents",
  collection: DATA_SCOPE_TARGETS_COLLECTION,
  keyField: "collection",
  entries: moduleDeclarations
    .flatMap((declaration) =>
      declaration.dataScopeTarget ? [declaration.dataScopeTarget] : [],
    )
    .map((target) => ({
      key: target.collection,
      data: {
        name: target.name,
        ...(target.description === undefined
          ? {}
          : { description: target.description }),
        fields: target.fields,
      },
    })),
};
