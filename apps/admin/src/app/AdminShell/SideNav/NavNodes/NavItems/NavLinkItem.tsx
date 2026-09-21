import { createElement } from "react";
import { Link } from "react-router";

import { moduleIconOf } from "@repo/ui/icons";
import { ListItemButton, ListItemIcon, ListItemText } from "@repo/ui/list";

import { itemSx } from "./nav-item-styles";

export interface NavLinkItemProps {
  to: string;
  label: string;
  /**
   * `me.modules[].icon`(白名單 key,#288):icon-slot 畫的就是它;
   * 沒設定或認不得的值由 `moduleIconOf` 退回預設圖示(原本的圓點),畫面不會缺一塊。
   */
  icon?: string | null;
  isSelected: boolean;
  /** 點到這一列時額外要做的事(群組 flyout 用來收起自己;展開態不給) */
  onNavigate?: () => void;
}

/** Figma Draft/NavItem:模組圖示 + 文字;選中時品牌淺色底 + 深色字。 */
export const NavLinkItem = ({
  to,
  label,
  icon,
  isSelected,
  onNavigate,
}: NavLinkItemProps) => (
  <ListItemButton<typeof Link>
    component={Link}
    to={to}
    selected={isSelected}
    aria-current={isSelected ? "page" : undefined}
    onClick={onNavigate}
    sx={itemSx}
  >
    <ListItemIcon sx={{ minWidth: 0, color: "inherit" }}>
      {/* `react-hooks/static-components` 不准在 render 內把元件存進變數,所以用 `createElement`。
          Figma 的 icon-slot 是 16px,MUI 的 `small` 是 20px — 差 4px 視覺可接受(STYLE-06) */}
      {createElement(moduleIconOf(icon), { fontSize: "small" })}
    </ListItemIcon>
    <ListItemText
      primary={label}
      slotProps={{
        primary: { variant: "subtitle2", component: "span", noWrap: true },
      }}
    />
  </ListItemButton>
);
