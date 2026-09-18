"use client";

import MuiMenu, { type MenuProps as MuiMenuProps } from "@mui/material/Menu";

export type MenuProps = MuiMenuProps;

/** 下拉選單(AppBar 使用者選單);圓角與陰影由 theme 的 MuiMenu 覆寫供給。 */
export const Menu = (props: MenuProps) => <MuiMenu {...props} />;
