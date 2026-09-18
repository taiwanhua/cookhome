"use client";

import MuiIconButton, {
  type IconButtonProps as MuiIconButtonProps,
} from "@mui/material/IconButton";

export type IconButtonProps = MuiIconButtonProps;

/** 只有圖示的按鈕(路由頁籤的關閉鈕;AppBar 的「?」說明鈕預定也用它)。用者必給 `aria-label`。 */
export const IconButton = (props: IconButtonProps) => (
  <MuiIconButton {...props} />
);
