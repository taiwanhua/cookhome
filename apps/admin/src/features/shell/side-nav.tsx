import { useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";

import { ModuleSidebarType } from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Collapse } from "@repo/ui/collapse";
import { ChevronDownIcon, ChevronRightIcon, DotIcon } from "@repo/ui/icons";
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@repo/ui/list";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { NavNode } from "./module-tree";

/** 側欄寬度 / 列高(theme.spacing 單位;Figma AdminSideNav 240 寬、NavItem 40 高、NavGroup 36 高)。 */
const NAV_WIDTH = 30;
const ITEM_HEIGHT = 5;
const GROUP_HEIGHT = 4.5;
const CHILD_INDENT = 2.5;

interface SideNavProps {
  /** 頂部租戶識別:本段顯示當前組織名稱(商標圖屬第 3 段) */
  orgName: string;
  tree: NavNode[];
  /** 目前網址(已正規化),決定哪一列為選中狀態 */
  currentPath: string;
}

const itemSx = {
  height: (theme: { spacing: (n: number) => string }) =>
    theme.spacing(ITEM_HEIGHT),
  borderRadius: 1,
  px: 1.5,
  gap: 1,
  color: "text.secondary",
  "&.Mui-selected": {
    bgcolor: "primary.lighter",
    color: "primary.dark",
    "&:hover": { bgcolor: "primary.lighter" },
  },
} as const;

interface NavLinkItemProps {
  to: string;
  label: string;
  isSelected: boolean;
}

/** Figma Draft/NavItem:圓點 + 文字;選中時品牌淺色底 + 深色字。 */
function NavLinkItem({ to, label, isSelected }: Readonly<NavLinkItemProps>) {
  return (
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
}

interface NavGroupItemProps {
  node: NavNode;
  currentPath: string;
}

/** Figma Draft/NavGroup:chevron + 文字,點擊展開 / 收合子項(預設展開)。 */
function NavGroupItem({ node, currentPath }: Readonly<NavGroupItemProps>) {
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
          primary={node.module.name}
          slotProps={{
            primary: { variant: "subtitle2", component: "span", noWrap: true },
          }}
        />
      </ListItemButton>
      <Collapse in={isOpen} unmountOnExit>
        <List component="div" disablePadding sx={{ pl: CHILD_INDENT }}>
          <NavNodes nodes={node.children} currentPath={currentPath} />
        </List>
      </Collapse>
    </>
  );
}

interface NavNodesProps {
  nodes: NavNode[];
  currentPath: string;
}

function NavNodes({ nodes, currentPath }: Readonly<NavNodesProps>) {
  return (
    <>
      {nodes.map((node) =>
        node.module.sidebarType === ModuleSidebarType.Group ? (
          <NavGroupItem
            key={node.module.id}
            node={node}
            currentPath={currentPath}
          />
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
}

/**
 * 後台側欄(Figma Draft/AdminSideNav 30:52):頂部租戶識別 + 模組樹。
 * Figma 第一列的「總覽」是模組(key `overview`,seeds/modules/overview.ts),和其他模組一樣從 `me.modules` 長出來、受權限過濾,不是固定列。
 * 商標槽位(Figma logoImg 120:50)本段保留不顯圖:`orgs.logoPath` 顯圖需 StorageService 簽名讀取(ADR-0010),屬第 3 段。
 */
export function SideNav({
  orgName,
  tree,
  currentPath,
}: Readonly<SideNavProps>) {
  const t = useTranslations("admin.shell");
  const tApp = useTranslations("admin.app");

  return (
    <Box
      component="nav"
      aria-label={t("sideNav")}
      sx={{
        width: (theme) => theme.spacing(NAV_WIDTH),
        flexShrink: 0,
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        px: 2,
        py: 3,
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {/* 商標槽位:第 3 段在此放 <Avatar variant="rounded" src={signedLogoUrl} alt={t("orgLogo")} /> 與名稱並排 */}
        <Typography variant="h5" color="primary" noWrap>
          {orgName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {tApp("subtitle")}
        </Typography>
      </Stack>
      <List component="div" disablePadding sx={{ display: "grid", gap: 0.5 }}>
        <NavNodes nodes={tree} currentPath={currentPath} />
      </List>
    </Box>
  );
}
