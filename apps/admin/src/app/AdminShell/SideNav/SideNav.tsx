import { useTranslations } from "use-intl";

import { Avatar } from "@repo/ui/avatar";
import { Box } from "@repo/ui/box";
import { List } from "@repo/ui/list";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { NavNode } from "@/lib/module-tree";

import { NavNodes } from "./NavNodes/NavNodes";

/** 側欄寬度(theme.spacing 單位;Figma AdminSideNav 240 寬)。 */
const NAV_WIDTH = 30;

/** 商標槽位的幾何(Figma AdminSideNav 的 logoImg 120:50:28×28、圓角 6)。 */
const LOGO_SIZE = 28;
const LOGO_RADIUS = "6px";

export interface SideNavProps {
  /** 頂部租戶識別:沒有商標時顯示的當前組織名稱 */
  orgName: string;
  /** 當前組織的商標(`me.currentOrg.logoUrl`,api 現簽的短效網址);沒有就顯示名稱 */
  logoUrl?: string | null;
  tree: NavNode[];
  /** 目前網址(已正規化),決定哪一列為選中狀態 */
  currentPath: string;
}

/**
 * 後台側欄(Figma Draft/AdminSideNav 30:52):頂部租戶識別 + 模組樹。
 * Figma 第一列的「總覽」是模組(key `overview`,seeds/modules/overview.ts),和其他模組一樣從 `me.modules` 長出來、受權限過濾,不是固定列。
 * 頂部租戶識別照 Figma 的 ShowLogo 變體:**有商標就顯示商標圖、沒有才顯示組織名稱**(兩者佔同一個位置);
 * 商標是 api 現簽的短效網址(ADR-0010),`alt` 用組織名,讓換成圖之後名稱仍讀得到。
 */
export const SideNav = ({
  orgName,
  logoUrl,
  tree,
  currentPath,
}: SideNavProps) => {
  const t = useTranslations("admin.shell");
  const tApp = useTranslations("admin.app");

  return (
    <Box
      component="nav"
      aria-label={t("sideNav")}
      sx={{
        width: (theme) => theme.spacing(NAV_WIDTH),
        flexShrink: 0,
        // 殼釘死 100vh(#183),模組多到超過視窗時側欄自己捲
        overflowY: "auto",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        px: 2,
        py: 3,
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {logoUrl === null || logoUrl === undefined ? (
          <Typography variant="h5" color="primary" noWrap>
            {orgName}
          </Typography>
        ) : (
          <Avatar
            variant="rounded"
            src={logoUrl}
            alt={orgName}
            sx={{
              width: LOGO_SIZE,
              height: LOGO_SIZE,
              borderRadius: LOGO_RADIUS,
            }}
          />
        )}
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
