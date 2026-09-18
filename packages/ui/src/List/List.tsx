"use client";

import MuiList, { type ListProps as MuiListProps } from "@mui/material/List";

export type ListProps = MuiListProps;

/** 清單容器(側欄 NavGroup / NavItem 的骨架,對應 Figma Draft/AdminSideNav)。 */
export const List = (props: ListProps) => <MuiList {...props} />;
