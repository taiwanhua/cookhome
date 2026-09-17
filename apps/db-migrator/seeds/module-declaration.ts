/**
 * 模組種子的宣告型別(ADR-0002:`seeds/modules/<key>.ts` 每模組一檔 —
 * 模組樹節點 + permissions + dataScopeTarget)。欄位形狀對照
 * apps/api/src/database/schemas/module.schema.ts、permission.schema.ts、data-scope-target.schema.ts。
 */

/** 側欄呈現型別(module.schema.ts MODULE_SIDEBAR_TYPES)。 */
export type ModuleSidebarType = "group" | "link" | "hidden";

/** 一個模組樹節點;parentId / ancestors 由 seeds/modules.ts 依 parentKey 解析。 */
export interface ModuleNodeDeclaration {
  key: string;
  name: string;
  sidebarType: ModuleSidebarType;
  /** 上層模組 key;頂層為 null。 */
  parentKey: string | null;
  /** 同層側欄排序。 */
  order: number;
  /** 只有自己那段(前綴父路由由 API 組合);純 API 樹等非頁面節點不填。 */
  route?: string;
  description?: string;
  /** 停用連動整棵子樹;示範家族於 production 預設 false。預設 true。 */
  enabled?: boolean;
  /** 根組織專屬(租戶不可見):租戶管理員模板扣除之(ADR-0009)。 */
  isRootOnly?: boolean;
}

/** 一筆權限;key 須為 `<moduleKey>.<動作>`(規約由 seed-key-convention 靜態測試強制)。 */
export interface PermissionDeclaration {
  key: string;
  /** 擁有模組(綁「它作為按鈕/欄位/跳窗/flag 所在的那一頁」,ADR-0004)。 */
  moduleKey: string;
  name: string;
  description?: string;
}

/** 資料範圍目標(ADR-0008):落庫至 data_scope_targets,以 collection 為識別鍵。 */
export interface DataScopeTargetDeclaration {
  collection: string;
  name: string;
  description?: string;
  /** 可篩業務欄位目錄;基礎欄位由程式自動附加,不入庫。 */
  fields: Record<string, unknown>[];
}

export interface ModuleSeedDeclaration {
  /** 依樹的先後宣告(父在前),runner 依序解析 parentId。 */
  nodes: ModuleNodeDeclaration[];
  permissions?: PermissionDeclaration[];
  dataScopeTarget?: DataScopeTargetDeclaration;
}

/** 權限 key 的最後一段;wildcard 動作 `*` 代表整組(ADR-0004)。 */
export const WILDCARD_ACTION = "*";

/** `<moduleKey>.<action>`。 */
export function permissionKey(moduleKey: string, action: string): string {
  return `${moduleKey}.${action}`;
}

/** 模組的 wildcard 權限(每個有自有權限的模組一筆;role_permission 只存這一筆)。 */
export function wildcardPermission(
  moduleKey: string,
  moduleName: string,
): PermissionDeclaration {
  return {
    key: permissionKey(moduleKey, WILDCARD_ACTION),
    moduleKey,
    name: "全部",
    description: `${moduleName} 及其子孫模組的全部權限(含未來新增)`,
  };
}
