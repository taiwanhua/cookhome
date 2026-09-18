"use client";

import MuiAlert, {
  type AlertProps as MuiAlertProps,
} from "@mui/material/Alert";

export type AlertProps = MuiAlertProps;

export function Alert(props: Readonly<AlertProps>) {
  return <MuiAlert {...props} />;
}
