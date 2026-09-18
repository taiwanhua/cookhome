"use client";

import MuiMenu, { type MenuProps as MuiMenuProps } from "@mui/material/Menu";
import MuiMenuItem, {
  type MenuItemProps as MuiMenuItemProps,
} from "@mui/material/MenuItem";

export type MenuProps = MuiMenuProps;
export type MenuItemProps = MuiMenuItemProps;

/** 下拉選單(AppBar 使用者選單);圓角與陰影由 theme 的 MuiMenu 覆寫供給。 */
export function Menu(props: Readonly<MenuProps>) {
  return <MuiMenu {...props} />;
}

/** 選單項目;也是 `Select` 的選項元件。 */
export function MenuItem(props: Readonly<MenuItemProps>) {
  return <MuiMenuItem {...props} />;
}
