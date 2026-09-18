"use client";

import MuiBox, { type BoxProps as MuiBoxProps } from "@mui/material/Box";

export type BoxProps = MuiBoxProps;

export const Box = (props: BoxProps) => <MuiBox {...props} />;
