"use client";

import MuiSvgIcon from "@mui/material/SvgIcon";

import type { IconProps } from "./icon-props";

/** 群組收合中(Draft/NavGroup State=Collapsed 的 chevron)。 */
export const ChevronRightIcon = (props: IconProps) => (
  <MuiSvgIcon viewBox="0 0 16 16" fill="none" {...props}>
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </MuiSvgIcon>
);
