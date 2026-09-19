import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

import type { RoleDetailTab } from "../role-manager-types";

export interface DetailTabsProps {
  active: RoleDetailTab;
  /** 切頁籤可能被「放棄未儲存變更」攔下,所以由頁面決定要不要真的切 */
  onChange: (tab: RoleDetailTab) => void;
}

const TABS: readonly RoleDetailTab[] = ["matrix", "users"];

/**
 * 單一角色的兩個頁籤(Figma 65:189 Draft/Tab:active 底線 + primary 字色)。
 * 頁內頁籤不進 URL(REACT-02 第 2 點的 admin 例外:殼的 `RouteTabs` 只認 pathname)。
 */
export const DetailTabs = ({ active, onChange }: DetailTabsProps) => {
  const t = useTranslations("admin.roleManager.tabs");

  return (
    <Stack
      direction="row"
      spacing={2}
      role="tablist"
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      {TABS.map((tab) => (
        <Box key={tab} sx={{ pb: 0.5 }}>
          <Button
            variant="text"
            size="small"
            role="tab"
            aria-selected={tab === active}
            color={tab === active ? "primary" : "inherit"}
            sx={{
              borderRadius: 0,
              borderBottom: 2,
              borderColor: tab === active ? "primary.main" : "transparent",
            }}
            onClick={() => {
              onChange(tab);
            }}
          >
            {t(tab)}
          </Button>
        </Box>
      ))}
    </Stack>
  );
};
