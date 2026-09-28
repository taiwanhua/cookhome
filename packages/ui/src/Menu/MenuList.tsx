"use client";

import MuiMenuList, {
  type MenuListProps as MuiMenuListProps,
} from "@mui/material/MenuList";

export type MenuListProps = MuiMenuListProps;

/**
 * 不帶浮層的選單清單(`role="menu"`,上下鍵在 `MenuItem` 之間移動)。給「浮層裡除了選項還有別的控制項」的情境:
 * AppBar 頭像選單(Figma `Draft/AdminUserMenu` 278:77)把使用者卡、分段按鈕與登出項放在同一個 `Popover`,
 * 只有登出項這一段是選單 —— 整個浮層若用 `Menu`,Tab 會直接關選單、分段按鈕用鍵盤到不了。
 */
export const MenuList = (props: MenuListProps) => <MuiMenuList {...props} />;
