import { Link } from "react-router";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

/**
 * 無權限頁(#61 使用者故事 6):手打不在「可進入路由集合」內的網址時顯示,
 * 明確告知是權限問題、不是系統壞掉;窗口統一「系統管理員」(FIGMA-04 / CONTEXT.md)。
 */
export function ForbiddenPage() {
  const t = useTranslations("admin.shell.forbidden");

  return (
    <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
      <Typography variant="h4" component="h1">
        {t("title")}
      </Typography>
      <Typography color="text.secondary">{t("body")}</Typography>
      <Button<typeof Link> component={Link} to="/" variant="outlined">
        {t("backHome")}
      </Button>
    </Stack>
  );
}
