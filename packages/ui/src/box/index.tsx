"use client";

import MuiBox, { type BoxProps as MuiBoxProps } from "@mui/material/Box";

export type BoxProps = MuiBoxProps;

export function Box(props: Readonly<BoxProps>) {
  return <MuiBox {...props} />;
}
