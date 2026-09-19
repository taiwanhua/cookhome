"use client";

import { useContext } from "react";

import { Checkbox, type CheckboxProps } from "../Checkbox/Checkbox";
import { TreeItemCheckboxStateContext } from "./tree-rows";

export interface TreeItemRowCheckboxProps extends CheckboxProps {
  /** MUI 只在勾選模式、且該列可選時給 `true`;為假時這個槽位不渲染任何東西。 */
  visible?: boolean;
}

/**
 * 節點的勾選框(`TreeItem` 的 checkbox 槽位)。
 * 換成設計系統的 `Checkbox`(Figma Draft/Checkbox 44:43),三態的 indeterminate 才是設計稿那一版;
 * MUI 內建的槽位直接用 `@mui/material` 的 Checkbox,會跟 admin 其他勾選框長得不一樣。
 * 每列要蓋掉的 indeterminate / disabled 由 context 帶進來(見 `tree-rows.ts`)。
 */
export const TreeItemRowCheckbox = ({
  visible = false,
  ...rest
}: TreeItemRowCheckboxProps) => {
  const state = useContext(TreeItemCheckboxStateContext);
  if (!visible) {
    return null;
  }
  return <Checkbox {...rest} {...state} sx={{ padding: 0 }} />;
};
