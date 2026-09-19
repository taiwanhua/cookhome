import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

import type { OrgActionAbility, OrgDetail } from "../org-manager-types";

export interface OrgActionBarProps {
  org: OrgDetail;
  ability: OrgActionAbility;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

/**
 * 資料區的動作列(Figma 87:245):按鈕**依權限決定出不出現**(ADR-0011「頁內判斷」),
 * 根組織保護則是**出現但停用** — 「這個動作我做不到」跟「這個組織不准被這樣動」是兩回事,
 * 前者不該給按鈕、後者要讓人看得出為什麼(`isSystem` 的 tooltip)。
 */
export const OrgActionBar = ({
  org,
  ability,
  onEdit,
  onToggleEnabled,
  onDelete,
}: OrgActionBarProps) => {
  const t = useTranslations("admin.orgManager.actions");

  return (
    <Stack direction="row" spacing={1}>
      {ability.canEdit && (
        <Button size="small" variant="outlined" onClick={onEdit}>
          {t("edit")}
        </Button>
      )}
      {ability.canToggleEnabled && (
        <Button
          size="small"
          variant="text"
          color={org.enabled ? "error" : "primary"}
          disabled={org.isSystem}
          title={org.isSystem ? t("systemOrgHint") : undefined}
          onClick={onToggleEnabled}
        >
          {org.enabled ? t("disable") : t("enable")}
        </Button>
      )}
      {ability.canDelete && (
        <Button
          size="small"
          variant="text"
          disabled={org.isSystem}
          title={org.isSystem ? t("systemOrgHint") : undefined}
          onClick={onDelete}
        >
          {t("delete")}
        </Button>
      )}
    </Stack>
  );
};
