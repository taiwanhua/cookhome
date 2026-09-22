import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

import type { UserActionAbility, UserRow } from "../user-manager-types";

export interface UserRowActionsProps {
  user: UserRow;
  ability: UserActionAbility;
  /**
   * 這一列是受保護的頂層組織擁有者(ADR-0009):**只有「停用」停用並提示**。
   * 「所屬組織」照常可開(#362):api 的 `assertOwnedOrgsKept` 只擋「移出他擁有的
   * 租戶頂層」,加入其他組織一直是允許的 —— 鎖在彈窗裡的那一個節點上。
   */
  isOwnerProtected: boolean;
  /** 沒有組織樹(缺 `system.org-manager.view`)時「所屬組織」無從勾選,一併停用 */
  isOrgTreeAvailable: boolean;
  onEdit: (user: UserRow) => void;
  onManageOrgs: (user: UserRow) => void;
  onAssignRoles: (user: UserRow) => void;
  onToggleEnabled: (user: UserRow) => void;
}

/**
 * 每列的動作(Figma 31:98):有權限才出現;擁有者受保護的動作出現但 disabled 並以 title 說明原因
 * (停用被 api 以 `OWNER_PROTECTED` 擋下,先在畫面上講清楚)。
 * **「所屬組織」不在此列**(#362):api 只擋「移出他擁有的租戶頂層」,
 * 整個按鈕停用比 api 嚴,擁有者會因此連加入其他組織都做不到。
 */
export const UserRowActions = ({
  user,
  ability,
  isOwnerProtected,
  isOrgTreeAvailable,
  onEdit,
  onManageOrgs,
  onAssignRoles,
  onToggleEnabled,
}: UserRowActionsProps) => {
  const t = useTranslations("admin.userManager");
  const protectedTitle = isOwnerProtected ? t("ownerProtected") : undefined;

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
      {ability.canEdit && (
        <Button
          variant="text"
          size="small"
          onClick={() => {
            onEdit(user);
          }}
        >
          {t("actions.edit")}
        </Button>
      )}
      {ability.canManageOrgs && (
        <Button
          variant="text"
          size="small"
          disabled={!isOrgTreeAvailable}
          onClick={() => {
            onManageOrgs(user);
          }}
        >
          {t("actions.orgs")}
        </Button>
      )}
      {ability.canAssignRoles && (
        <Button
          variant="text"
          size="small"
          onClick={() => {
            onAssignRoles(user);
          }}
        >
          {t("actions.roles")}
        </Button>
      )}
      {ability.canToggleEnabled && (
        <Box component="span" title={protectedTitle}>
          <Button
            variant="text"
            size="small"
            color={user.enabled ? "error" : "success"}
            disabled={isOwnerProtected && user.enabled}
            onClick={() => {
              onToggleEnabled(user);
            }}
          >
            {user.enabled ? t("actions.disable") : t("actions.enable")}
          </Button>
        </Box>
      )}
    </Stack>
  );
};
