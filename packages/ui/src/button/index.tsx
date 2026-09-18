"use client";

import MuiButton, {
  type ButtonProps as MuiButtonProps,
} from "@mui/material/Button";
import type { ElementType } from "react";

export type ButtonProps<
  RootComponent extends ElementType = "button",
  AdditionalProps = object,
> = MuiButtonProps<RootComponent, AdditionalProps>;

/**
 * CookHome 按鈕:預設 contained(與 MUI 預設 text 不同;傳入的 `variant` 覆寫)。
 * 多型:`component={Link}` 時該元件的 props(如 `to`)一併可用。
 */
export function Button<RootComponent extends ElementType = "button">(
  props: Readonly<ButtonProps<RootComponent, { component?: RootComponent }>>,
) {
  return <MuiButton variant="contained" {...props} />;
}
