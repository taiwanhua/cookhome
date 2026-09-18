import { useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { useTranslations } from "use-intl";

import type { MeQuery } from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Typography } from "@repo/ui/typography";

import { useMe } from "../auth/use-me";
import { ShellAppBar } from "./app-bar";
import {
  buildNavTree,
  enterableRouteMap,
  normalizePathname,
} from "./module-tree";
import { RouteTabs } from "./route-tabs";
import { SideNav } from "./side-nav";
import { useRouteTabs } from "./use-route-tabs";

/**
 * 登入後的後台殼(#66;Figma Admin Shell 頁:Draft/AdminSideNav 30:52 + Draft/AdminAppBar 30:95 + Draft/AdminRouteTabs 34:33):
 * 側欄 + AppBar + 路由頁籤列(#67)+ 內容區(`<Outlet>`),`me` 走 `useMe()` 全域快取(RequireAuth 已等它載入;
 * 首登強改的導向也在 RequireAuth,殼不重複判斷)。
 */
export function AdminShell() {
  const tApp = useTranslations("admin.app");
  const me = useMe();

  if (me.isPending) {
    return <Typography sx={{ p: 4 }}>{tApp("loading")}</Typography>;
  }
  if (me.isError) {
    return (
      <Typography role="alert" sx={{ p: 4 }}>
        {tApp("apiError")}
      </Typography>
    );
  }
  return <ShellLayout me={me.data.me} />;
}

function ShellLayout({ me }: Readonly<{ me: MeQuery["me"] }>) {
  const t = useTranslations("admin.shell");
  const tCommon = useTranslations("common");
  const { pathname } = useLocation();
  const { modules } = me;

  const tree = useMemo(() => buildNavTree(modules), [modules]);
  const routes = useMemo(() => enterableRouteMap(modules), [modules]);

  const path = normalizePathname(pathname);
  const routeTabs = useRouteTabs({ userId: me.id, routes, currentPath: path });
  // `/` 與群組路由會立刻轉走(ModuleRoute),標題留空不閃「無權限」
  const title =
    routes.get(path)?.name ?? (path === "/" ? "" : t("forbidden.title"));

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <SideNav
        orgName={me.currentOrg?.name ?? tCommon("brand")}
        tree={tree}
        currentPath={path}
      />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ShellAppBar me={me} title={title} />
        <RouteTabs
          tabs={routeTabs.tabs}
          activeRoute={routeTabs.activeRoute}
          onSelect={routeTabs.select}
          onClose={routeTabs.close}
          onMove={routeTabs.move}
        />
        <Box component="main" sx={{ flex: 1, p: 4 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
