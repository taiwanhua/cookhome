"use client";

import MuiListItemButton, {
  type ListItemButtonProps as MuiListItemButtonProps,
} from "@mui/material/ListItemButton";
import type { ElementType } from "react";

export type ListItemButtonProps<
  RootComponent extends ElementType = "div",
  AdditionalProps = object,
> = MuiListItemButtonProps<RootComponent, AdditionalProps>;

/**
 * 可點的清單列;多型:`component={Link}` 時該元件的 props(如 `to`)一併可用。
 */
export const ListItemButton = <RootComponent extends ElementType = "div">(
  props: ListItemButtonProps<RootComponent, { component?: RootComponent }>,
) => <MuiListItemButton {...props} />;
