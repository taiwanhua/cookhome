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
import { SideNav } from "./side-nav";

/**
 * 登入後的後台殼(#66;Figma Admin Shell 頁:Draft/AdminSideNav 30:52 + Draft/AdminAppBar 30:95):
 * 側欄 + AppBar + 內容區(`<Outlet>`),`me` 走 `useMe()` 全域快取(RequireAuth 已等它載入;
 * 首登強改的導向也在 RequireAuth,殼不重複判斷)。RouteTabs 頁籤列(登入線6 #67)掛在 AppBar 與內容區之間,見下方註記。
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
        {/* RouteTabs 掛載點(登入線6 #67):<RouteTabs /> 放這裡 — AppBar 之下、內容區之上(Figma 34:33) */}
        <Box component="main" sx={{ flex: 1, p: 4 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
