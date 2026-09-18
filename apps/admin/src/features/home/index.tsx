import { useTranslations } from "use-intl";

import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useShellOutlet } from "../shell/shell-context";

/**
 * 總覽(首頁)佔位:顯示使用者名稱與當前組織,驗證整條登入線(#65);
 * 殼(側欄 / AppBar / 登出)由登入線5 提供,`me` 由殼載入後經 outlet context 傳入。
 */
export function HomePage() {
  const t = useTranslations("admin.session");
  const { me } = useShellOutlet();
  const { name, currentOrg } = me;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        {t("greeting", { name })}
      </Typography>
      <Typography color="text.secondary">
        {currentOrg ? t("currentOrg", { org: currentOrg.name }) : t("noOrg")}
      </Typography>
    </Stack>
  );
}
