import { useTranslations } from "use-intl";

import { Tabs } from "@repo/ui/tabs";

import { type RoleDetailTab, isRoleDetailTab } from "../role-manager-types";

export interface DetailTabsProps {
  active: RoleDetailTab;
  /** 切頁籤可能被「放棄未儲存變更」攔下,所以由頁面決定要不要真的切 */
  onChange: (tab: RoleDetailTab) => void;
}

const TABS: readonly RoleDetailTab[] = ["matrix", "users"];

/**
 * 單一角色的兩個頁籤(Figma `Draft/Tabs` 252:14:active 底線 + primary 字色)。
 * 頁內頁籤不進 URL(REACT-02 第 2 點的 admin 例外:殼的 `RouteTabs` 只認 pathname)。
 *
 * #254 / #307:原本是 `Button` 自組的 `role="tablist"`,現在用 `@repo/ui/tabs` ——
 * 鍵盤巡覽(左右鍵、Home / End)與 `aria-controls` 都由 MUI 給,這裡只剩文案與回報。
 */
export const DetailTabs = ({ active, onChange }: DetailTabsProps) => {
  const t = useTranslations("admin.roleManager.tabs");

  return (
    <Tabs
      value={active}
      aria-label={t("label")}
      items={TABS.map((tab) => ({ value: tab, label: t(tab) }))}
      onChange={(next) => {
        if (isRoleDetailTab(next)) {
          onChange(next);
        }
      }}
    />
  );
};
