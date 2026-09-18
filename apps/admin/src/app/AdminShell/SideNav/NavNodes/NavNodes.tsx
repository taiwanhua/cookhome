import { ModuleSidebarType } from "@repo/graphql";
import { List } from "@repo/ui/list";

import type { NavNode } from "../../../../lib/module-tree";
import { NavGroupItem } from "./NavItems/NavGroupItem";
import { NavLinkItem } from "./NavItems/NavLinkItem";
import { CHILD_INDENT } from "./NavItems/nav-item-styles";

export interface NavNodesProps {
  nodes: NavNode[];
  currentPath: string;
}

/**
 * 側欄樹的遞迴層:group 節點交給 `NavGroupItem`(可展開 / 收合),子樹由這裡再遞迴一層放進去;
 * link 節點交給 `NavLinkItem`。遞迴只在本檔內發生,兩個葉元件不 import 回來(import-x/no-cycle)。
 */
export const NavNodes = ({ nodes, currentPath }: NavNodesProps) => (
  <>
    {nodes.map((node) =>
      node.module.sidebarType === ModuleSidebarType.Group ? (
        <NavGroupItem key={node.module.id} label={node.module.name}>
          <List component="div" disablePadding sx={{ pl: CHILD_INDENT }}>
            <NavNodes nodes={node.children} currentPath={currentPath} />
          </List>
        </NavGroupItem>
      ) : (
        <NavLinkItem
          key={node.module.id}
          to={node.module.route ?? "/"}
          label={node.module.name}
          isSelected={currentPath === node.module.route}
        />
      ),
    )}
  </>
);
