import { useQueryClient } from "@tanstack/react-query";
import { type MouseEvent, useContext, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import {
  type MeQuery,
  useLogoutAllDevicesMutation,
  useLogoutMutation,
  useMeQuery,
  useSwitchOrgMutation,
} from "@repo/graphql";
import { type Locale, localeLabels, locales } from "@repo/i18n";
import { Avatar } from "@repo/ui/avatar";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Menu, MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";
import { Typography } from "@repo/ui/typography";

import { LocaleContext } from "../../lib/locale";
import { LOGIN_PATH } from "../auth/paths";
import { useSession } from "../auth/use-session";

/** AppBar 高度 / 頭像尺寸(theme.spacing 單位;Figma AdminAppBar 64 高、avatar 32)。 */
const BAR_HEIGHT = 8;
const AVATAR_SIZE = 4;

interface ShellAppBarProps {
  me: MeQuery["me"];
  /** 目前頁面的名稱(模組名 / 總覽) */
  title: string;
}

/**
 * 後台 AppBar(Figma Draft/AdminAppBar 30:95):頁名、語言切換、當前組織切換器、使用者選單(登出 / 登出所有裝置)。
 * - 切換組織 = `switchOrg` 換發 access token 後精準 invalidate `me`(DATA-02 / DATA-04),當前組織隨之更新
 * - 語言只記 localStorage(I18N-05),經 LocaleContext 寫回
 */
export function ShellAppBar({ me, title }: Readonly<ShellAppBarProps>) {
  const t = useTranslations("admin.shell");
  const tApp = useTranslations("admin.app");
  const tSession = useTranslations("admin.session");
  const { session } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { locale, setLocale } = useContext(LocaleContext);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const switchOrg = useSwitchOrgMutation(session.client, {
    onSuccess: ({ switchOrg: payload }) => {
      session.store.setAccessToken(payload.accessToken);
      void queryClient.invalidateQueries({ queryKey: useMeQuery.getKey() });
    },
  });

  // 先離開受保護路由再清狀態,登出不帶 next
  const signOut = () => {
    void navigate(LOGIN_PATH, { replace: true });
    session.signOut();
  };
  const logout = useLogoutMutation(session.client, { onSettled: signOut });
  const logoutAllDevices = useLogoutAllDevicesMutation(session.client, {
    onSettled: signOut,
  });

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
  };

  return (
    <Box
      component="header"
      sx={{
        height: (theme) => theme.spacing(BAR_HEIGHT),
        display: "flex",
        alignItems: "center",
        gap: 2,
        pl: 4,
        pr: 3,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {/* 頁名只是標示,不是內容區的標題(h1 在內容區),故不用 heading 標籤 */}
      <Typography variant="h6" component="div" noWrap>
        {title}
      </Typography>
      {/* 「?」模組說明彈窗(dis #18)的掛載點:說明系統落地時在此放 <IconButton aria-label={t("help")}><HelpIcon /></IconButton> */}
      <Box sx={{ flex: 1 }} />

      <Select<Locale>
        variant="standard"
        value={locale}
        onChange={(event) => {
          setLocale(event.target.value);
        }}
        inputProps={{ "aria-label": tApp("language") }}
        sx={{ typography: "subtitle2" }}
      >
        {locales.map((item) => (
          <MenuItem key={item} value={item}>
            {localeLabels[item]}
          </MenuItem>
        ))}
      </Select>

      <Select
        variant="standard"
        value={me.currentOrg?.id ?? ""}
        onChange={(event) => {
          switchOrg.mutate({ input: { orgId: event.target.value } });
        }}
        disabled={switchOrg.isPending || me.orgs.length === 0}
        inputProps={{ "aria-label": t("currentOrg") }}
        sx={{ typography: "subtitle2" }}
      >
        {me.orgs.map((org) => (
          <MenuItem key={org.id} value={org.id}>
            {org.name}
          </MenuItem>
        ))}
      </Select>

      <Button
        variant="text"
        color="inherit"
        aria-haspopup="menu"
        aria-expanded={menuAnchor === null ? undefined : true}
        onClick={openMenu}
        startIcon={
          <Avatar
            aria-hidden
            sx={{
              width: (theme) => theme.spacing(AVATAR_SIZE),
              height: (theme) => theme.spacing(AVATAR_SIZE),
              bgcolor: "primary.lighter",
              color: "primary.dark",
              typography: "subtitle2",
            }}
          >
            {me.name.charAt(0)}
          </Avatar>
        }
        sx={{ typography: "subtitle2" }}
      >
        {me.name}
      </Button>
      <Menu
        anchorEl={menuAnchor}
        open={menuAnchor !== null}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          disabled={logout.isPending}
          onClick={() => {
            closeMenu();
            logout.mutate({});
          }}
        >
          {tSession("logout")}
        </MenuItem>
        <MenuItem
          disabled={logoutAllDevices.isPending}
          onClick={() => {
            closeMenu();
            logoutAllDevices.mutate({});
          }}
        >
          {tSession("logoutAllDevices")}
        </MenuItem>
      </Menu>
    </Box>
  );
}
