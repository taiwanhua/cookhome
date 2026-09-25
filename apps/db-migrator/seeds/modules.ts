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
import { shoppingListModule } from "./modules/shopping-list";
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
  shoppingListModule,
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
      // 初始 seed 值(見下方 modules 的 initialSeedValueFields):建立後由人在系統內管理
      enabled: true,
      // 沒宣告圖示的節點(多數隱藏頁)落庫為 null = 側欄用預設圖示;根組織可再用 setModuleIcon 指定
      icon: node.icon ?? null,
      // 每次都 seed 的欄位:頁面組裝方式由宣告決定,不在系統內改
      engine: node.engine ?? "fixed",
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
      // seed 只同步 source = seed 的權限(`permissions` 的 `match`);執行期產生的是 dynamic
      source: "seed",
    },
  };
}

/**
 * 模組樹(全部節點;正本:docs/modules/*.md)。
 *
 * `icon` 與 `enabled` 同為「初始 seed 值的欄位」(ADR-0002):根組織在「模組與權限」頁換過的圖示,
 * 下次部署重跑 seed 不會被宣告值翻回去(`setModuleIcon` 清空時寫的是 `null`,欄位仍在,所以也算人改過的值)。
 */
export const modules: SeedDocumentSet = {
  kind: "documents",
  collection: MODULES_COLLECTION,
  initialSeedValueFields: ["enabled", "icon"],
  entries: moduleNodes.map((node) => toModuleDocument(node)),
};

/**
 * 權限(每模組一筆 wildcard + 各模組宣告的個別權限;正本:docs/modules/*.md 權限表)。
 *
 * **只碰 `source: seed` 的權限**:表單發布會在同一張表建 `source: "dynamic"` 的欄位級權限,
 * seed 既不比對、也不更新它們(`match` 排除 dynamic;runner 本來就不刪不認識的文件)。
 * 條件寫成「不是 dynamic」而不是「是 seed」:欄位加上之前的舊文件沒有 `source`,
 * 要讓它們照樣被認成 seed 權限並補上 `source: "seed"`。
 */
export const permissions: SeedDocumentSet = {
  kind: "documents",
  collection: PERMISSIONS_COLLECTION,
  match: { source: { $ne: "dynamic" } },
  entries: permissionDeclarations.map((permission) =>
    toPermissionDocument(permission),
  ),
};

/**
 * 資料範圍目標(ADR-0008;識別鍵 `(collection, moduleKey)`,schema 無 key 欄位)。
 *
 * runner 以 `moduleKey` 找文件:每個模組至多宣告一個目標,所以 moduleKey 單獨就能認出是哪一筆
 * (唯一索引仍是 `(collection, moduleKey)`,同一張表可以有多個模組各一個目標)。
 * `moduleKey` = 宣告檔的第一個節點(該模組本身,父在前)。
 */
export const dataScopeTargets: SeedDocumentSet = {
  kind: "documents",
  collection: DATA_SCOPE_TARGETS_COLLECTION,
  keyField: "moduleKey",
  entries: moduleDeclarations
    .flatMap((declaration) =>
      declaration.dataScopeTarget
        ? [
            {
              moduleKey: ownerModuleKeyOf(declaration),
              target: declaration.dataScopeTarget,
            },
          ]
        : [],
    )
    .map(({ moduleKey, target }) => ({
      key: moduleKey,
      data: {
        collection: target.collection,
        name: target.name,
        ...(target.description === undefined
          ? {}
          : { description: target.description }),
        fields: target.fields,
      },
    })),
};

/**
 * 宣告資料範圍目標的模組 = 宣告檔中第一個非群組節點:
 * 模組檔先宣告群組(如示範家族的 `demo` / `demo.sub`)、再宣告模組本身,隱藏頁在後。
 */
function ownerModuleKeyOf(declaration: ModuleSeedDeclaration): string {
  const owner = declaration.nodes.find((node) => node.sidebarType !== "group");
  if (!owner) {
    throw new Error("宣告 dataScopeTarget 的模組檔至少要有一個非群組節點");
  }
  return owner.key;
}
