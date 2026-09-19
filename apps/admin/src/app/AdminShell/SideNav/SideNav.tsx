import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { List } from "@repo/ui/list";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { NavNode } from "@/lib/module-tree";

import { NavNodes } from "./NavNodes/NavNodes";

/** 側欄寬度(theme.spacing 單位;Figma AdminSideNav 240 寬)。 */
const NAV_WIDTH = 30;

export interface SideNavProps {
  /** 頂部租戶識別:本段顯示當前組織名稱(商標圖屬第 3 段) */
  orgName: string;
  tree: NavNode[];
  /** 目前網址(已正規化),決定哪一列為選中狀態 */
  currentPath: string;
}

/**
 * 後台側欄(Figma Draft/AdminSideNav 30:52):頂部租戶識別 + 模組樹。
 * Figma 第一列的「總覽」是模組(key `overview`,seeds/modules/overview.ts),和其他模組一樣從 `me.modules` 長出來、受權限過濾,不是固定列。
 * 商標槽位(Figma logoImg 120:50)本段保留不顯圖:`orgs.logoPath` 顯圖需 StorageService 簽名讀取(ADR-0010),屬第 3 段。
 */
export const SideNav = ({ orgName, tree, currentPath }: SideNavProps) => {
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
};
