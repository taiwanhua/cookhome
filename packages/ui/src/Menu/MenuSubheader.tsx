"use client";

import ListSubheader, {
  type ListSubheaderProps,
} from "@mui/material/ListSubheader";

export type MenuSubheaderProps = ListSubheaderProps;

/**
 * 選單裡一組項目的小標題(AppBar 使用者選單的「外觀」「語言」)。不是選項:鍵盤上下移動會跳過它,
 * 也不會被當成選單項目點選;要讓組別可辨識,組內項目的名稱自己要說得清楚。
 */
export const MenuSubheader = (props: MenuSubheaderProps) => (
  <ListSubheader {...props} />
);
