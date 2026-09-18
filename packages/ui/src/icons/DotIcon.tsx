"use client";

import MuiSvgIcon from "@mui/material/SvgIcon";

import type { IconProps } from "./icon-props";

/** 選單項目的圓點(Draft/NavItem icon-slot 的預設圖示)。 */
export const DotIcon = (props: IconProps) => (
  <MuiSvgIcon viewBox="0 0 16 16" {...props}>
    <circle cx="8" cy="8" r="4" fill="currentColor" />
  </MuiSvgIcon>
);
