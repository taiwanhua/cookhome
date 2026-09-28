"use client";

import ArrowUpwardOutlined from "@mui/icons-material/ArrowUpwardOutlined";

import type { IconProps } from "./icon-props";

/**
 * 上移(明細列的列動作)。
 * 取自 `@mui/icons-material/ArrowUpwardOutlined`,做法與理由同 `EditIcon`。
 */
export const ArrowUpIcon = (props: IconProps) => (
  <ArrowUpwardOutlined {...props} />
);
