"use client";

import KeyboardDoubleArrowRightOutlined from "@mui/icons-material/KeyboardDoubleArrowRightOutlined";

import type { IconProps } from "./icon-props";

/**
 * 雙右箭頭「»」(Figma `Draft/ActionIcon` 253:3264 的 `key=chevron-double-right`;
 * 側欄收合態的展開開關,取代原本的文字字符)。
 * 取自 `@mui/icons-material/KeyboardDoubleArrowRightOutlined`,做法與理由同 `EditIcon`。
 */
export const ChevronDoubleRightIcon = (props: IconProps) => (
  <KeyboardDoubleArrowRightOutlined {...props} />
);
