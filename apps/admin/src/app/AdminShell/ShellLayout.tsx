import { useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { useTranslations } from "use-intl";

import type { MeQuery } from "@repo/graphql";
import { Box } from "@repo/ui/box";

import {
  buildNavTree,
  enterableRouteMap,
  normalizePathname,
} from "@/lib/module-tree";

import { AppBar } from "./AppBar/AppBar";
import { RouteTabs } from "./RouteTabs/RouteTabs";
import { useRouteTabs } from "./RouteTabs/useRouteTabs";
import { SideNav } from "./SideNav/SideNav";

export interface ShellLayoutProps {
  me: MeQuery["me"];
}

/** 殼的排版:側欄 + AppBar + 路由頁籤列(#67)+ 內容區(`<Outlet>`);只給 `AdminShell` 用(`me` 已載入)。 */
export const ShellLayout = ({ me }: ShellLayoutProps) => {
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
        <AppBar me={me} title={title} />
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
};
