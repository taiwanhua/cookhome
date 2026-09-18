"use client";

import MuiCircularProgress, {
  type CircularProgressProps as MuiCircularProgressProps,
} from "@mui/material/CircularProgress";

export type CircularProgressProps = MuiCircularProgressProps;

export const CircularProgress = (props: CircularProgressProps) => (
  <MuiCircularProgress {...props} />
);
