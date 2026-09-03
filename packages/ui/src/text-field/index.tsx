"use client";

import MuiTextField, {
  type TextFieldProps as MuiTextFieldProps,
} from "@mui/material/TextField";

export type TextFieldProps = MuiTextFieldProps;

export function TextField(props: Readonly<TextFieldProps>) {
  return <MuiTextField {...props} />;
}
