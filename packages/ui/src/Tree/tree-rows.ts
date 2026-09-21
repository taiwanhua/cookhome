"use client";

import { type ReactNode, createContext } from "react";

/**
 * 單一列的「額外內容 + 勾選框狀態」。
 * 內容類(`labelSuffix` / `actions`)來自節點資料,狀態類(`indeterminate` / `disabled`)
 * 來自 `Tree` 的 id 陣列 props — 兩者在這裡合成同一份查詢表,列元件只認 id。
 */
export interface TreeItemRowState {
  /** 標籤右側的附加資訊(Tag、權限 key 這類唯讀內容)。 */
  labelSuffix?: ReactNode;
  /** 列尾靠右的操作(「全選整組 / 清空整組」這類按鈕或連結)。 */
  actions?: ReactNode;
  /** 部分勾選:勾選框顯示 indeterminate(由呼叫端算,`Tree` 不做連動)。 */
  indeterminate?: boolean;
  /** 勾選框停用(仍可展開 / 收合)。 */
  disabled?: boolean;
}

/** 每列的額外狀態(id → 內容);沒有額外內容的列不會進這張表。 */
export const TreeRowsContext = createContext<
  ReadonlyMap<string, TreeItemRowState>
>(new Map<string, TreeItemRowState>());

/**
 * 勾選框要蓋掉的狀態,由 `TreeItemRow` 逐列提供給它自己的勾選框槽位。
 * MUI 的 `slotProps.checkbox` 型別只宣告 `HTMLAttributes`,`indeterminate` / `disabled` 傳不進去,
 * 所以走 context 給槽位元件(槽位元件必須是模組層的常數,不能在 render 內組)。
 * 鍵一律「有值才給」:沒給的沿用 MUI 自己算出來的結果(例如 `disabled` 節點的勾選框本來就是停用)。
 */
export const TreeItemCheckboxStateContext = createContext<
  Pick<TreeItemRowState, "disabled" | "indeterminate">
>({});
