"use client";

import MuiStack, {
  type StackProps as MuiStackProps,
} from "@mui/material/Stack";

export type StackProps = MuiStackProps;

export function Stack(props: Readonly<StackProps>) {
  return <MuiStack {...props} />;
}
