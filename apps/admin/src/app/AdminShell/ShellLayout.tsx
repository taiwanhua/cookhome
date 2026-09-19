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

/**
 * 殼的排版:側欄 + AppBar + 路由頁籤列(#67)+ 內容區(`<Outlet>`);只給 `AdminShell` 用(`me` 已載入)。
 *
 * **高度是殼給的**(#183):外框釘死 `100vh`,內容區 = 視窗高 − AppBar − RouteTabs,
 * 由 `flex: 1` + `minHeight: 0` 取得一個**確定的高度**並自己捲動。
 * 頁面因此可以用 `flex: 1` / `height: 100%` 撐滿(組織管理、使用者管理的左右兩欄就是這樣滿版);
 * 內容比視窗高的頁面照舊在內容區捲動,不會被裁掉。
 */
export const ShellLayout = ({ me }: ShellLayoutProps) => {
  const t = useTranslations("admin.shell");
  const tCommon = useTranslations("common");
  const { pathname } = useLocation();
  const { modules } = me;

  const tree = useMemo(() => buildNavTree(modules), [modules]);
  const routes = useMemo(() => enterableRouteMap(modules), [modules]);

  const path = normalizePathname(pathname);
  const routeTabs = useRouteTabs({ userId: me.id, routes, currentPath: path });
  // 目前網址對上的模組(可進入路由集合,ADR-0011);非模組路由為 undefined
  const currentModule = routes.get(path);
  // `/` 與群組路由會立刻轉走(ModuleRoute),標題留空不閃「無權限」
  const title =
    currentModule?.name ?? (path === "/" ? "" : t("forbidden.title"));

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <SideNav
        orgName={me.currentOrg?.name ?? tCommon("brand")}
        logoUrl={me.currentOrg?.logoUrl}
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
        <AppBar me={me} title={title} module={currentModule} />
        <RouteTabs
          tabs={routeTabs.tabs}
          activeRoute={routeTabs.activeRoute}
          onSelect={routeTabs.select}
          onClose={routeTabs.close}
          onMove={routeTabs.move}
        />
        {/* `flex: 1` 的 basis 是 0,所以 AppBar / RouteTabs 不會被內容擠扁;
            `minHeight: 0` 讓這一格的高度真的等於剩下的空間(否則會被內容撐高) */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            p: 4,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
