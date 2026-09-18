import { type MouseEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { useLogoutAllDevicesMutation, useLogoutMutation } from "@repo/graphql";
import { Avatar } from "@repo/ui/avatar";
import { Button } from "@repo/ui/button";
import { Menu, MenuItem } from "@repo/ui/menu";

import { useSession } from "../../../hooks/useSession";
import { LOGIN_PATH } from "../../../lib/paths";

/** 頭像尺寸(theme.spacing 單位;Figma AdminAppBar avatar 32)。 */
const AVATAR_SIZE = 4;

export interface UserMenuProps {
  /** 登入者名稱:按鈕文字與頭像首字 */
  name: string;
}

/** AppBar 的使用者選單:登出 / 登出所有裝置(api 打完先離開受保護路由再清狀態,登出不帶 next)。 */
export const UserMenu = ({ name }: UserMenuProps) => {
  const tSession = useTranslations("admin.session");
  const { session } = useSession();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

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
    <>
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
            {name.charAt(0)}
          </Avatar>
        }
        sx={{ typography: "subtitle2" }}
      >
        {name}
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
    </>
  );
};
