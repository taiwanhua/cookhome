import { Link } from "react-router";

import { DotIcon } from "@repo/ui/icons";
import { ListItemButton, ListItemIcon, ListItemText } from "@repo/ui/list";

import { itemSx } from "./nav-item-styles";

export interface NavLinkItemProps {
  to: string;
  label: string;
  isSelected: boolean;
}

/** Figma Draft/NavItem:圓點 + 文字;選中時品牌淺色底 + 深色字。 */
export const NavLinkItem = ({ to, label, isSelected }: NavLinkItemProps) => (
  <ListItemButton<typeof Link>
    component={Link}
    to={to}
    selected={isSelected}
    aria-current={isSelected ? "page" : undefined}
    sx={itemSx}
  >
    <ListItemIcon sx={{ minWidth: 0, color: "inherit" }}>
      <DotIcon fontSize="small" />
    </ListItemIcon>
    <ListItemText
      primary={label}
      slotProps={{
        primary: { variant: "subtitle2", component: "span", noWrap: true },
      }}
    />
  </ListItemButton>
);
