"use client";

import MuiTextField, {
  type TextFieldProps as MuiTextFieldProps,
} from "@mui/material/TextField";

export type TextFieldProps = MuiTextFieldProps;

export const TextField = (props: TextFieldProps) => <MuiTextField {...props} />;
