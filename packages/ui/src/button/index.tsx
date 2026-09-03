"use client";

import MuiButton, {
  type ButtonProps as MuiButtonProps,
} from "@mui/material/Button";

export type ButtonProps = MuiButtonProps;

/** CookHome 按鈕:預設 contained(與 MUI 預設 text 不同) */
export function Button({
  variant = "contained",
  ...rest
}: Readonly<ButtonProps>) {
  return <MuiButton variant={variant} {...rest} />;
}
