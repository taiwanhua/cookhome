import type { ReactNode } from "react";

import type { TreeNode } from "@repo/ui/tree";

/**
 * `orgTree` 的節點形狀(codegen 把遞迴展開成五層具名型別,無法直接遞迴走訪,
 * 這裡給一個結構相容的型別當走訪介面;`children` 在最深一層不存在,故為選填)。
 *
 * `parentId` 一律是**真的上層**,即使它不在樹上(樹根是租戶頂層時指向平台根組織);
 * 只有平台根組織的 `parentId` 是 null。「我是不是樹根」看的是「在不在回傳陣列的第一層」。
 *
 * `outOfScope`:#187 起管理範圍外的組織根本不回傳,這個欄位因此恆為 false;
 * 留著是為了與使用者列的 `roles[].outOfScope` 一致、也讓舊資料(快取)不會炸。
 */
export interface OrgNodeLike {
  id: string;
  name: string;
  parentId?: string | null;
  enabled: boolean;
  outOfScope: boolean;
  children?: readonly OrgNodeLike[];
}

/** 扁平化後的一筆組織:`path` 是含祖先的完整名稱(「租戶 A / 內容組」),用於標籤與搜尋。 */
export interface OrgOption {
  id: string;
  name: string;
  path: string;
  parentId?: string | null;
  /** 恆為 false(#187:範圍外的組織不回傳);保留欄位以相容舊快取與既有呼叫端。 */
  outOfScope: boolean;
}

/** 節點 → 標籤右側的附加內容(停用 / 租戶標籤);不需要標籤時回 undefined。 */
export type OrgLabelSuffix = (node: OrgNodeLike) => ReactNode;

/** 樹 → `@repo/ui/tree` 的資料;`outOfScope` 的節點 disabled(#187 後不會再出現,相容保留)。 */
export const toTreeNodes = (
  nodes: readonly OrgNodeLike[],
  labelSuffixOf?: OrgLabelSuffix,
): TreeNode[] =>
  nodes.map((node) => ({
    id: node.id,
    label: node.name,
    disabled: node.outOfScope,
    labelSuffix: labelSuffixOf?.(node),
    children:
      node.children === undefined
        ? undefined
        : toTreeNodes(node.children, labelSuffixOf),
  }));

/** 深度優先攤平整棵樹(含範圍外節點),順序 = 畫面上的順序。 */
export const flattenOrgs = (
  nodes: readonly OrgNodeLike[],
  ancestors: readonly string[] = [],
): OrgOption[] =>
  nodes.flatMap((node) => {
    const trail = [...ancestors, node.name];
    return [
      {
        id: node.id,
        name: node.name,
        path: trail.join(" / "),
        parentId: node.parentId ?? null,
        outOfScope: node.outOfScope,
      },
      ...flattenOrgs(node.children ?? [], trail),
    ];
  });

/** 所有節點 id(展開狀態的全集)。 */
export const allOrgIds = (nodes: readonly OrgNodeLike[]): string[] =>
  flattenOrgs(nodes).map((org) => org.id);

/** 依 id 找節點(含它的子樹);找不到回 null。 */
export const findOrgNode = (
  nodes: readonly OrgNodeLike[],
  id: string,
): OrgNodeLike | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const deeper = findOrgNode(node.children ?? [], id);
    if (deeper !== null) {
      return deeper;
    }
  }
  return null;
};

/**
 * 從樹根到指定節點的路徑(含自己);找不到回空陣列。管理範圍多根時(#187)會自動找到
 * 含這個節點的那一棵,`[0]` 就是它所屬的那個根。
 * 組織管理頁靠它一次拿到三件事:上層是誰(`at(-2)`)、所屬租戶頂層是誰、以及自己的子樹。
 */
export const orgTrail = (
  nodes: readonly OrgNodeLike[],
  id: string,
): OrgNodeLike[] => {
  for (const node of nodes) {
    if (node.id === id) {
      return [node];
    }
    const deeper = orgTrail(node.children ?? [], id);
    if (deeper.length > 0) {
      return [node, ...deeper];
    }
  }
  return [];
};

/**
 * 預設選中的節點 = 第一棵樹的根;空樹回 null。
 * 管理範圍可能有多個頂點(#187),所以這是「第一個根」而不是「唯一的根」。
 */
export const firstRootOrgId = (nodes: readonly OrgNodeLike[]): string | null =>
  nodes[0]?.id ?? null;

/**
 * 平台根組織的 id:樹上唯一 `parentId` 為 null 的那個根(管理範圍是全部時才會出現在樹上)。
 * 樹根是租戶頂層 / 部門時回 null — 那些人看不到平台根組織,也就沒有「租戶」這層概念。
 */
export const platformRootOrgId = (
  nodes: readonly OrgNodeLike[],
): string | null =>
  nodes.find((node) => (node.parentId ?? null) === null)?.id ?? null;


/**
 * 依關鍵字過濾:節點自己命中、或子樹裡有命中的就留下(留下時子樹也一併保留,
 * 讓使用者看得到命中節點的層級關係)。關鍵字空白時原樣回傳。
 */
export const filterOrgTree = (
  nodes: readonly OrgNodeLike[],
  keyword: string,
): OrgNodeLike[] => {
  const needle = keyword.trim().toLowerCase();
  if (needle === "") {
    return [...nodes];
  }
  return nodes.flatMap((node) => {
    const children = filterOrgTree(node.children ?? [], keyword);
    const isHit = node.name.toLowerCase().includes(needle);
    if (!isHit && children.length === 0) {
      return [];
    }
    return [{ ...node, children: isHit ? node.children : children }];
  });
};
