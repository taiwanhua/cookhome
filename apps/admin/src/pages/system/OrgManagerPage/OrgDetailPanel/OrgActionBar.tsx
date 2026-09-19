import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

import type { OrgActionAbility, OrgDetail } from "../org-manager-types";

export interface OrgActionBarProps {
  org: OrgDetail;
  ability: OrgActionAbility;
  /**
   * 這是租戶頂層、而操作者是租戶內的人：停用 / 刪除 / 搬移只有根組織能做
   * （ADR-0009）。同根組織保護的做法：按鈕出現但停用並提示，不是藏起來。
   */
  isTenantTopProtected: boolean;
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
  isTenantTopProtected,
  onEdit,
  onToggleEnabled,
  onDelete,
}: OrgActionBarProps) => {
  const t = useTranslations("admin.orgManager.actions");

  /** 組織本身不准被這樣動的兩種情況:平台根組織、租戶頂層(對租戶內的人)。 */
  const isLocked = org.isSystem || isTenantTopProtected;
  const lockedHint = org.isSystem ? t("systemOrgHint") : t("tenantTopHint");

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
          disabled={isLocked}
          title={isLocked ? lockedHint : undefined}
          onClick={onToggleEnabled}
        >
          {org.enabled ? t("disable") : t("enable")}
        </Button>
      )}
      {ability.canDelete && (
        <Button
          size="small"
          variant="text"
          disabled={isLocked}
          title={isLocked ? lockedHint : undefined}
          onClick={onDelete}
        >
          {t("delete")}
        </Button>
      )}
    </Stack>
  );
};
