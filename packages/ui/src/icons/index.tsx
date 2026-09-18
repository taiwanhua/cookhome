"use client";

import MuiSvgIcon, {
  type SvgIconProps as MuiSvgIconProps,
} from "@mui/material/SvgIcon";

export type IconProps = MuiSvgIconProps;

/**
 * 殼用的線性圖示,path 取自 Figma Admin Shell 匯出的 SVG(chevron 16×16、icon-slot 16×16),
 * 顏色一律 `currentColor`(由父層文字色決定,STYLE-04 深色模式自動正確)。
 */

/** 群組展開中(Draft/NavGroup State=Expanded 的 chevron)。 */
export function ChevronDownIcon(props: Readonly<IconProps>) {
  return (
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
}

/** 群組收合中(Draft/NavGroup State=Collapsed 的 chevron)。 */
export function ChevronRightIcon(props: Readonly<IconProps>) {
  return (
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
}

/** 選單項目的圓點(Draft/NavItem icon-slot 的預設圖示)。 */
export function DotIcon(props: Readonly<IconProps>) {
  return (
    <MuiSvgIcon viewBox="0 0 16 16" {...props}>
      <circle cx="8" cy="8" r="4" fill="currentColor" />
    </MuiSvgIcon>
  );
}
