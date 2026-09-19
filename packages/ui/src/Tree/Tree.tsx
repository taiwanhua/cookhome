"use client";

import MuiBox from "@mui/material/Box";
import { styled, type SxProps, type Theme } from "@mui/material/styles";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { TreeItem, type TreeItemProps } from "@mui/x-tree-view/TreeItem";
import {
  createContext,
  type ReactNode,
  type SyntheticEvent,
  useContext,
  useMemo,
} from "react";

/** 樹節點資料(Figma Draft/OrgTreeItem 98:2)。`disabled` = 顯示但不可選(可見範圍外 / 無權限)。 */
export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  disabled?: boolean;
  /**
   * 標籤右側的附加內容(Figma Draft/OrgTreeItem 的 ShowTag 槽位):停用 / 租戶這類 `Tag`。
   * 只影響呈現,不影響選取與鍵盤操作;`label` 仍是純文字,搜尋與無障礙名稱照舊。
   */
  labelSuffix?: ReactNode;
}

export interface TreeProps {
  items: readonly TreeNode[];
  /** 勾選模式:節點左側出現核取方塊(選擇所屬組織這類多選情境) */
  checkboxSelection?: boolean;
  /** 選取模式:預設單選;開啟後同時可選多個節點 */
  multiSelect?: boolean;
  /** 受控的選取節點 id;單選模式下傳 0 或 1 個 */
  selectedIds?: readonly string[];
  /** 非受控的初始選取節點 id */
  defaultSelectedIds?: readonly string[];
  /** 選取變動;單選模式一律回傳 0 或 1 個 id */
  onSelectedIdsChange?: (ids: string[]) => void;
  /** 受控的展開節點 id */
  expandedIds?: readonly string[];
  /** 非受控的初始展開節點 id */
  defaultExpandedIds?: readonly string[];
  onExpandedIdsChange?: (ids: string[]) => void;
  /** 載入中:顯示骨架列取代節點 */
  isLoading?: boolean;
  sx?: SxProps<Theme>;
  "aria-label"?: string;
}

/** Figma Draft/OrgTreeItem:選取態 primary.lighter 底 + primary.dark 字、停用態 text.disabled。 */
const TreeRoot = styled("div")(({ theme }) => ({
  "& .MuiTreeItem-content": {
    ...theme.typography.body2,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
  },
  "& .MuiTreeItem-content.Mui-selected": {
    ...theme.typography.subtitle2,
    backgroundColor: theme.palette.primary.lighter,
    color: theme.palette.primary.dark,
    "&:hover": { backgroundColor: theme.palette.primary.lighter },
  },
  "& .MuiTreeItem-content.Mui-disabled": {
    color: theme.palette.text.disabled,
    opacity: 1,
  },
}));

/**
 * 每個節點的 `labelSuffix`(id → 內容)。
 * `RichTreeView` 的 item slot 只能是模組層的元件(放在 render 內會每次換成新元件、整棵樹重新掛載),
 * 所以附加內容經 context 傳給它,而不是閉包。
 */
const LabelSuffixContext = createContext<ReadonlyMap<string, ReactNode>>(
  new Map(),
);

/** 攤平整棵樹上有 `labelSuffix` 的節點。 */
const collectLabelSuffixes = (
  nodes: readonly TreeNode[],
  into: Map<string, ReactNode>,
): Map<string, ReactNode> => {
  for (const node of nodes) {
    if (node.labelSuffix !== undefined) {
      into.set(node.id, node.labelSuffix);
    }
    collectLabelSuffixes(node.children ?? [], into);
  }
  return into;
};

/** 帶附加內容的節點:`label` 換成「文字 + 附加內容」,其餘行為完全沿用 `TreeItem`。 */
const TreeItemWithSuffix = (props: TreeItemProps) => {
  const suffixes = useContext(LabelSuffixContext);
  const suffix = suffixes.get(props.itemId);
  if (suffix === undefined) {
    return <TreeItem {...props} />;
  }
  return (
    <TreeItem
      {...props}
      label={
        <MuiBox
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
        >
          {props.label}
          {suffix}
        </MuiBox>
      }
    />
  );
};

/** MUI 單選回傳 `string | null`、多選回傳 `string[]`;本包裝層一律正規化成陣列。 */
const toIdArray = (value: string | readonly string[] | null): string[] => {
  if (value === null) {
    return [];
  }
  return typeof value === "string" ? [value] : [...value];
};

/**
 * 樹狀選單:包一層 `@mui/x-tree-view`(MIT 社群版)。
 * 資料以 `{ id, label, children, disabled }` 陣列傳入,不用 children 組裝;
 * 選取值對外一律是 `string[]`,單 / 多選只差在 `multiSelect`,呼叫端不必改型別。
 */
export const Tree = ({
  items,
  checkboxSelection = false,
  multiSelect = false,
  selectedIds,
  defaultSelectedIds,
  onSelectedIdsChange,
  expandedIds,
  defaultExpandedIds,
  onExpandedIdsChange,
  isLoading = false,
  sx,
  "aria-label": ariaLabel,
}: TreeProps) => {
  const labelSuffixes = useMemo(
    () => collectLabelSuffixes(items, new Map<string, ReactNode>()),
    [items],
  );

  const toSelectionValue = (
    ids: readonly string[] | undefined,
  ): readonly string[] | string | null | undefined => {
    if (ids === undefined) {
      return undefined;
    }
    return multiSelect ? ids : (ids[0] ?? null);
  };

  const handleSelectedItemsChange = (
    _event: SyntheticEvent | null,
    value: string | string[] | null,
  ) => {
    onSelectedIdsChange?.(toIdArray(value));
  };

  const handleExpandedItemsChange = (
    _event: SyntheticEvent | null,
    itemIds: string[],
  ) => {
    onExpandedIdsChange?.(itemIds);
  };

  return (
    <TreeRoot sx={sx}>
      <LabelSuffixContext.Provider value={labelSuffixes}>
        <RichTreeView<TreeNode, boolean>
          items={items}
          slots={{ item: TreeItemWithSuffix }}
          multiSelect={multiSelect}
          checkboxSelection={checkboxSelection}
          isItemDisabled={(item) => item.disabled === true}
          selectedItems={toSelectionValue(selectedIds)}
          defaultSelectedItems={toSelectionValue(defaultSelectedIds)}
          onSelectedItemsChange={handleSelectedItemsChange}
          expandedItems={expandedIds}
          defaultExpandedItems={defaultExpandedIds}
          onExpandedItemsChange={handleExpandedItemsChange}
          loading={isLoading}
          aria-label={ariaLabel}
        />
      </LabelSuffixContext.Provider>
    </TreeRoot>
  );
};
