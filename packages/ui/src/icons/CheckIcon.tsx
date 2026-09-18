"use client";

import MuiSvgIcon from "@mui/material/SvgIcon";

import type { IconProps } from "./icon-props";

/** 勾號(Draft/Checkbox 44:43 的 tick,20×20);`Checkbox` 的打勾用。 */
export const CheckIcon = (props: IconProps) => (
  <MuiSvgIcon viewBox="0 0 20 20" fill="none" {...props}>
    <path
      d="M5 10.5L8.2 13.7L15 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </MuiSvgIcon>
);
