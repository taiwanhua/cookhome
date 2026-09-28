"use client";

import ArrowDownwardOutlined from "@mui/icons-material/ArrowDownwardOutlined";

import type { IconProps } from "./icon-props";

/**
 * 下移(明細列的列動作)。
 * 取自 `@mui/icons-material/ArrowDownwardOutlined`,做法與理由同 `EditIcon`。
 */
export const ArrowDownIcon = (props: IconProps) => (
  <ArrowDownwardOutlined {...props} />
);
