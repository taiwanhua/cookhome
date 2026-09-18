"use client";

import MuiSvgIcon from "@mui/material/SvgIcon";

import type { IconProps } from "./icon-props";

/** 群組展開中(Draft/NavGroup State=Expanded 的 chevron)。 */
export const ChevronDownIcon = (props: IconProps) => (
  <MuiSvgIcon viewBox="0 0 16 16" fill="none" {...props}>
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </MuiSvgIcon>
);
