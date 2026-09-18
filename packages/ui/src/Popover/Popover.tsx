"use client";

import MuiPopover, {
  type PopoverProps as MuiPopoverProps,
} from "@mui/material/Popover";

export type PopoverProps = MuiPopoverProps;

/**
 * 浮層(Figma Components / Popover 73:2 的 Draft/Popover 73:3)。
 * 圓角(radius.md)與 Shadow/Dropdown 由 theme 的 MuiPopover 覆寫供給,這裡是純包裝
 * (STYLE-05:apps 不直接碰 MUI)。內距與內容排版屬於呼叫端 — Figma 的示範是
 * 左右 14 / 上下 12、間距 8,story 有一份可照抄的版型。
 */
export const Popover = (props: PopoverProps) => <MuiPopover {...props} />;
