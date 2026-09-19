import type { ReactNode } from "react";

import type { TreeNode } from "@repo/ui/tree";

/**
 * `orgTree` 的節點形狀(codegen 把遞迴展開成五層具名型別,無法直接遞迴走訪,
 * 這裡給一個結構相容的型別當走訪介面;`children` 在最深一層不存在,故為選填)。
 * `outOfScope` = 可見範圍外(ADR-0005):樹上照樣顯示,但不可選、不可操作。
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
  outOfScope: boolean;
}

/** 節點 → 標籤右側的附加內容(停用 / 租戶標籤);不需要標籤時回 undefined。 */
export type OrgLabelSuffix = (node: OrgNodeLike) => ReactNode;

/**
 * 樹 → `@repo/ui/tree` 的資料;範圍外節點 disabled(顯示但不可選)。
 *
 * **葉節點一律給 `undefined`**:api 對沒有子組織的節點回 `children: []`,
 * 而 `TreeNode.children` 的語意是「有沒有下一層」— 空陣列把「能不能展開」
 * 交給樹元件自己解讀(比如搬走唯一的子組織後父節點還有不該有的展開箭頭,#186 ③)。
 * 在這一層歸一化,不依賴 MUI 目前的判斷方式。
 */
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
      node.children === undefined || node.children.length === 0
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
 * 從樹根到指定節點的路徑(含自己);找不到回空陣列。
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

/** 整棵樹的根節點 id;空樹回 null(租戶視角 = 租戶頂層、根組織視角 = 根組織)。 */
export const rootOrgId = (nodes: readonly OrgNodeLike[]): string | null =>
  nodes[0]?.id ?? null;

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
