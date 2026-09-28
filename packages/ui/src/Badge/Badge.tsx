"use client";

import MuiBadge, {
  type BadgeProps as MuiBadgeProps,
} from "@mui/material/Badge";
import { styled } from "@mui/material/styles";
import type { ReactNode } from "react";

import { mergeSx } from "../theme/sx";

export type BadgeColor = "default" | "primary" | "error";

export interface BadgeProps extends Pick<
  MuiBadgeProps,
  "badgeContent" | "invisible" | "showZero" | "sx" | "aria-label"
> {
  /** 色調;`default` = 灰底(MUI 的 default 沒有底色,這裡補上)。預設 `default`。 */
  color?: BadgeColor;
  /** 數字上限,超過顯示 `99+` 這種形式;預設 99。 */
  max?: number;
  /** `dot` = 只顯示小圓點(不顯示數字,例:收合的側欄)。 */
  variant?: "standard" | "dot";
  /**
   * 掛在誰的右上角;**不給就是行內模式**:徽章本身排在文字流裡(頁籤文字右側、側欄項目右側),
   * 不疊在任何東西上。
   */
  children?: ReactNode;
}

/**
 * 必要預設寫在 styled(STYLE-07):
 * - `default` 色:MUI 的 default 沒有底色,補成灰底深字;
 * - 行內模式:拿掉 MUI 預設的絕對定位與位移,徽章自己佔位;隱藏時連位置都不留。
 */
const StyledBadge = styled(MuiBadge, {
  shouldForwardProp: (prop) => prop !== "inline",
})<{ inline: boolean }>(({ theme }) => ({
  variants: [
    {
      props: { color: "default" },
      style: {
        "& .MuiBadge-badge": {
          backgroundColor: theme.palette.grey[300],
          color: theme.palette.grey[800],
        },
      },
    },
    {
      props: { inline: true },
      style: {
        verticalAlign: "middle",
        "& .MuiBadge-badge": { position: "static", transform: "none" },
        "& .MuiBadge-invisible": { display: "none" },
      },
    },
  ],
}));

/**
 * 數量徽章(待辦筆數…)。數字 0 預設不顯示(`showZero` 才顯示),超過 `max` 顯示 `99+`。
 * 有 `children` 時疊在它右上角;沒有時是行內徽章。
 */
export const Badge = ({
  color = "default",
  max = 99,
  variant = "standard",
  children,
  sx,
  ...rest
}: BadgeProps) => (
  <StyledBadge
    inline={children === undefined}
    color={color}
    max={max}
    variant={variant}
    sx={mergeSx({}, sx)}
    {...rest}
  >
    {children}
  </StyledBadge>
);
