"use client";

import MuiListItemText, {
  type ListItemTextProps as MuiListItemTextProps,
} from "@mui/material/ListItemText";

export type ListItemTextProps = MuiListItemTextProps;

export const ListItemText = (props: ListItemTextProps) => (
  <MuiListItemText {...props} />
);
