"use client";

import MuiMenuItem, {
  type MenuItemProps as MuiMenuItemProps,
} from "@mui/material/MenuItem";

export type MenuItemProps = MuiMenuItemProps;

/** 選單項目;也是 `Select` 的選項元件。 */
export const MenuItem = (props: MenuItemProps) => <MuiMenuItem {...props} />;
