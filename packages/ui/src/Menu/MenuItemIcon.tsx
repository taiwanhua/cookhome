"use client";

import MuiListItemIcon, {
  type ListItemIconProps as MuiListItemIconProps,
} from "@mui/material/ListItemIcon";
import { styled } from "@mui/material/styles";

/** Figma `Draft/AdminUserMenu` 278:77 的登出項(275:109):圖示 18、與文字間距 10。 */
const ICON_SIZE = 18;
const ICON_GAP = 10;

export type MenuItemIconProps = MuiListItemIconProps;

const StyledListItemIcon = styled(MuiListItemIcon)(({ theme }) => ({
  color: (theme.vars ?? theme).palette.text.secondary,
  // 選單項目裡 MUI 以 `.MuiMenuItem-root .MuiListItemIcon-root` 給 minWidth 36,要壓過它
  "&&": { minWidth: ICON_SIZE + ICON_GAP },
  "& .MuiSvgIcon-root": { fontSize: ICON_SIZE },
}));

/**
 * 選單項目文字前的圖示(放在 `MenuItem` 裡、文字之前)。顏色 `text.secondary`;
 * MUI 在選單裡預設留 36 寬,這裡照設計稿收成「圖示 18 + 間距 10」。
 */
export const MenuItemIcon = (props: MenuItemIconProps) => (
  <StyledListItemIcon {...props} />
);
