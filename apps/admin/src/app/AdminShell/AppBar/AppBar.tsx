import type { MeQuery } from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Typography } from "@repo/ui/typography";

import { LocaleSwitcher } from "./LocaleSwitcher";
import { OrgSwitcher } from "./OrgSwitcher";
import { UserMenu } from "./UserMenu";

/** AppBar 高度(theme.spacing 單位;Figma AdminAppBar 64 高)。 */
const BAR_HEIGHT = 8;

export interface AppBarProps {
  me: MeQuery["me"];
  /** 目前頁面的名稱(模組名 / 總覽) */
  title: string;
}

/** 後台 AppBar(Figma Draft/AdminAppBar 30:95):頁名、語言切換、當前組織切換器、使用者選單(登出 / 登出所有裝置)。 */
export const AppBar = ({ me, title }: AppBarProps) => (
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

    <LocaleSwitcher />
    <OrgSwitcher me={me} />
    <UserMenu name={me.name} />
  </Box>
);
