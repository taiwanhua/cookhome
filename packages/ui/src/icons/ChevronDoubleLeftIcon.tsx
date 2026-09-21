"use client";

import KeyboardDoubleArrowLeftOutlined from "@mui/icons-material/KeyboardDoubleArrowLeftOutlined";

import type { IconProps } from "./icon-props";

/**
 * 雙左箭頭「«」(Figma `Draft/ActionIcon` 253:3264 的 `key=chevron-double-left`;
 * 側欄展開態的收合開關,取代原本的文字字符)。
 * 取自 `@mui/icons-material/KeyboardDoubleArrowLeftOutlined`,做法與理由同 `EditIcon`。
 */
export const ChevronDoubleLeftIcon = (props: IconProps) => (
  <KeyboardDoubleArrowLeftOutlined {...props} />
);
