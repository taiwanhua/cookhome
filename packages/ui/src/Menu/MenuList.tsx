"use client";

import { menuItemClasses } from "@mui/material/MenuItem";
import MuiMenuList, {
  type MenuListProps as MuiMenuListProps,
} from "@mui/material/MenuList";
import { styled } from "@mui/material/styles";

/** Figma `Draft/AdminUserMenu` 278:77 的登出項(275:109):內距 8 / 12、圓角 6。 */
const ITEM_RADIUS = 6;

export type MenuListProps = MuiMenuListProps;

const StyledMenuList = styled(MuiMenuList)(({ theme }) => ({
  [`& .${menuItemClasses.root}`]: {
    paddingBlock: theme.spacing(1),
    paddingInline: theme.spacing(1.5),
    borderRadius: ITEM_RADIUS,
  },
}));

/**
 * 不帶浮層的選單清單(`role="menu"`,上下鍵在 `MenuItem` 之間移動)。給「浮層裡除了選項還有別的控制項」的情境:
 * AppBar 頭像選單(Figma `Draft/AdminUserMenu` 278:77)把使用者卡、分段按鈕與登出項放在同一個 `Popover`,
 * 只有登出項這一段是選單 —— 整個浮層若用 `Menu`,Tab 會直接關選單、分段按鈕用鍵盤到不了。
 * 項目幾何照設計稿(內距 8 / 12、圓角 6),與浮層裡其他區塊的左緣 12 對齊。
 */
export const MenuList = (props: MenuListProps) => <StyledMenuList {...props} />;
