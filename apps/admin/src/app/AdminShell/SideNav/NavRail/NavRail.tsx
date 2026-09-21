import { ModuleSidebarType } from "@repo/graphql";
import { List } from "@repo/ui/list";

import { type NavNode, findNavNode } from "@/lib/module-tree";

import { NavRailGroupItem } from "./NavRailGroupItem";
import { NavRailLinkItem } from "./NavRailLinkItem";

export interface NavRailProps {
  nodes: NavNode[];
  currentPath: string;
}

/**
 * 收合態的圖示列(Figma `Draft/AdminSideNavCollapsed` 246:64)。
 *
 * **只列最上層**:64px 放不下層級,子模組改由群組的 flyout 呈現 —— 所以這一層不遞迴,
 * 遞迴發生在 flyout 裡的 `NavNodes`(展開態同一份)。
 */
export const NavRail = ({ nodes, currentPath }: NavRailProps) => (
  <List
    component="div"
    disablePadding
    sx={{ display: "grid", gap: 0.5, justifyItems: "center" }}
  >
    {nodes.map((node) =>
      node.module.sidebarType === ModuleSidebarType.Group ? (
        <NavRailGroupItem
          key={node.module.id}
          node={node}
          currentPath={currentPath}
          isSelected={findNavNode(node.children, currentPath) !== undefined}
        />
      ) : (
        <NavRailLinkItem
          key={node.module.id}
          to={node.module.route ?? "/"}
          label={node.module.name}
          icon={node.module.icon}
          isSelected={currentPath === node.module.route}
        />
      ),
    )}
  </List>
);
