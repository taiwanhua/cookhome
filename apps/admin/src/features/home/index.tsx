import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { useLogoutMutation } from "@repo/graphql";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { LOGIN_PATH } from "../auth/paths";
import { useMe } from "../auth/use-me";
import { useSession } from "../auth/use-session";

/**
 * 登入後的最簡「已登入」頁(#65):顯示使用者名稱 + 登出,用來驗證整條登入線;殼由登入線5 接手。
 */
export function HomePage() {
  const t = useTranslations("admin.session");
  const tApp = useTranslations("admin.app");
  const { session } = useSession();
  const navigate = useNavigate();
  const me = useMe();

  const logout = useLogoutMutation(session.client, {
    onSettled: () => {
      // 先離開受保護路由再清狀態,登出不帶 next
      void navigate(LOGIN_PATH, { replace: true });
      session.signOut();
    },
  });

  if (me.isPending) {
    return <Typography>{tApp("loading")}</Typography>;
  }
  if (me.isError) {
    return <Typography role="alert">{tApp("apiError")}</Typography>;
  }

  const { name, currentOrg } = me.data.me;

  return (
    <Stack component="main" spacing={2} sx={{ p: 4 }}>
      <Typography variant="h5">{t("greeting", { name })}</Typography>
      <Typography color="text.secondary">
        {currentOrg ? t("currentOrg", { org: currentOrg.name }) : t("noOrg")}
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          disabled={logout.isPending}
          onClick={() => {
            logout.mutate({});
          }}
        >
          {t("logout")}
        </Button>
      </Stack>
    </Stack>
  );
}
