import { type ReactNode, useState } from "react";

import { Collapse } from "@repo/ui/collapse";
import { ChevronDownIcon, ChevronRightIcon } from "@repo/ui/icons";
import { ListItemButton, ListItemIcon, ListItemText } from "@repo/ui/list";

import { GROUP_HEIGHT, itemSx } from "./nav-item-styles";

export interface NavGroupItemProps {
  label: string;
  /** 群組底下的子列(由 `NavNodes` 遞迴產生後放進來;本元件不認識樹,才不會和 NavNodes 互相 import) */
  children: ReactNode;
}

/** Figma Draft/NavGroup:chevron + 文字,點擊展開 / 收合子項(預設展開)。 */
export const NavGroupItem = ({ label, children }: NavGroupItemProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const Chevron = isOpen ? ChevronDownIcon : ChevronRightIcon;

  return (
    <>
      <ListItemButton
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        sx={{
          ...itemSx,
          height: (theme) => theme.spacing(GROUP_HEIGHT),
          color: "text.primary",
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, color: "text.secondary" }}>
          <Chevron fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={label}
          slotProps={{
            primary: { variant: "subtitle2", component: "span", noWrap: true },
          }}
        />
      </ListItemButton>
      <Collapse in={isOpen} unmountOnExit>
        {children}
      </Collapse>
    </>
  );
};
