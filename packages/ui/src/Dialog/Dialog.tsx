"use client";

import MuiDialog, {
  type DialogProps as MuiDialogProps,
} from "@mui/material/Dialog";
import MuiDialogActions from "@mui/material/DialogActions";
import MuiDialogContent from "@mui/material/DialogContent";
import MuiDialogTitle from "@mui/material/DialogTitle";
import type { ReactNode } from "react";

/** `title` 在 MUI 是 DOM 的 `title` 屬性(string),這裡改成插槽,所以先 Omit 掉。 */
export interface DialogProps extends Omit<MuiDialogProps, "title"> {
  /** 標題插槽;省略則不渲染標題列。 */
  title?: ReactNode;
  /** 動作插槽(按鈕列,靠右);省略則不渲染動作列。 */
  actions?: ReactNode;
}

/**
 * 彈窗(Figma Components / Dialog 70:221:Draft/ConfirmDialog 57:712、Draft/HelpDialog 95:235)。
 * 圓角與陰影由 theme 的 MuiDialog 覆寫供給;這裡只補 Figma 的內距節奏
 * (上 24 / 左右 24 / 下 20,標題與內文間距 12,動作列上方再 8)。
 * children 一律被包進 DialogContent — 內文用預設 body2 + text.secondary。
 */
export const Dialog = ({ title, actions, children, ...rest }: DialogProps) => (
  <MuiDialog {...rest}>
    {title === undefined ? null : (
      <MuiDialogTitle sx={{ px: 3, pt: 3, pb: 0, typography: "h6" }}>
        {title}
      </MuiDialogTitle>
    )}
    <MuiDialogContent
      sx={{
        px: 3,
        pt: 1.5,
        pb: 0,
        typography: "body2",
        color: "text.secondary",
      }}
    >
      {children}
    </MuiDialogContent>
    {actions === undefined ? null : (
      <MuiDialogActions sx={{ px: 3, pt: 2.5, pb: 2.5 }}>
        {actions}
      </MuiDialogActions>
    )}
  </MuiDialog>
);
