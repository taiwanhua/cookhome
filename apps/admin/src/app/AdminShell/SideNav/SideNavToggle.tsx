import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { IconButton } from "@repo/ui/icon-button";
import { Typography } from "@repo/ui/typography";

/** 開關的邊長(theme.spacing 單位;Figma collapse-toggle 246:97 為 40×40)。 */
const TOGGLE_SIZE = 5;

export interface SideNavToggleProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * 側欄底部的收合開關(Figma `Draft/AdminSideNavCollapsed` 246:97)。
 * 同一顆按鈕兩種對齊:**展開態靠右、字符「«」**(Figma `Draft/AdminSideNav` 30:52 底部),
 * **收合態置中、字符「»」**。字符沿用 Figma 的文字(`@repo/ui/icons` 沒有對應的雙箭頭圖示),
 * 對輔助科技隱藏,名稱由按鈕的 `aria-label` 給。
 */
export const SideNavToggle = ({
  isCollapsed,
  onToggle,
}: SideNavToggleProps) => {
  const t = useTranslations("admin.shell");

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isCollapsed ? "center" : "flex-end",
        pt: 1,
      }}
    >
      <IconButton
        aria-label={t(isCollapsed ? "expandNav" : "collapseNav")}
        onClick={onToggle}
        sx={{
          width: (theme) => theme.spacing(TOGGLE_SIZE),
          height: (theme) => theme.spacing(TOGGLE_SIZE),
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          color: "text.secondary",
        }}
      >
        <Typography component="span" variant="body1" aria-hidden>
          {isCollapsed ? "»" : "«"}
        </Typography>
      </IconButton>
    </Box>
  );
};
