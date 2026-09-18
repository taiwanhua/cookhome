"use client";

import MuiAlert, {
  type AlertProps as MuiAlertProps,
} from "@mui/material/Alert";

export type AlertProps = MuiAlertProps;

export const Alert = (props: AlertProps) => <MuiAlert {...props} />;
