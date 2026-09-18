"use client";

import MuiCircularProgress, {
  type CircularProgressProps as MuiCircularProgressProps,
} from "@mui/material/CircularProgress";

export type CircularProgressProps = MuiCircularProgressProps;

export function CircularProgress(props: Readonly<CircularProgressProps>) {
  return <MuiCircularProgress {...props} />;
}
