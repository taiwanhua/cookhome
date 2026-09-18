"use client";

import MuiSelect, {
  type SelectChangeEvent as MuiSelectChangeEvent,
  type SelectProps as MuiSelectProps,
} from "@mui/material/Select";

export type SelectProps<Value = unknown> = MuiSelectProps<Value>;
export type SelectChangeEvent<Value = string> = MuiSelectChangeEvent<Value>;

/**
 * 下拉選擇;variant 直接對應 Figma Draft/Select 的變體(FIGMA-01):
 * outlined = 表單(浮動標籤)、standard = 行內無框(AppBar 組織切換、工具列)。選項用 `MenuItem`。
 */
export function Select<Value = unknown>(props: Readonly<SelectProps<Value>>) {
  return <MuiSelect<Value> {...props} />;
}
