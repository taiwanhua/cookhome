"use client";

import MuiList, { type ListProps as MuiListProps } from "@mui/material/List";
import MuiListItemButton, {
  type ListItemButtonProps as MuiListItemButtonProps,
} from "@mui/material/ListItemButton";
import MuiListItemIcon, {
  type ListItemIconProps as MuiListItemIconProps,
} from "@mui/material/ListItemIcon";
import MuiListItemText, {
  type ListItemTextProps as MuiListItemTextProps,
} from "@mui/material/ListItemText";
import type { ElementType } from "react";

export type ListProps = MuiListProps;
export type ListItemButtonProps<
  RootComponent extends ElementType = "div",
  AdditionalProps = object,
> = MuiListItemButtonProps<RootComponent, AdditionalProps>;
export type ListItemIconProps = MuiListItemIconProps;
export type ListItemTextProps = MuiListItemTextProps;

/** 清單容器(側欄 NavGroup / NavItem 的骨架,對應 Figma Draft/AdminSideNav)。 */
export function List(props: Readonly<ListProps>) {
  return <MuiList {...props} />;
}

/**
 * 可點的清單列;多型:`component={Link}` 時該元件的 props(如 `to`)一併可用。
 */
export function ListItemButton<RootComponent extends ElementType = "div">(
  props: Readonly<
    ListItemButtonProps<RootComponent, { component?: RootComponent }>
  >,
) {
  return <MuiListItemButton {...props} />;
}

export function ListItemIcon(props: Readonly<ListItemIconProps>) {
  return <MuiListItemIcon {...props} />;
}

export function ListItemText(props: Readonly<ListItemTextProps>) {
  return <MuiListItemText {...props} />;
}
