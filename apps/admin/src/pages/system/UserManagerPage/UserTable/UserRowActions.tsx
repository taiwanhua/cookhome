import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

import type { UserActionAbility, UserRow } from "../user-manager-types";

export interface UserRowActionsProps {
  user: UserRow;
  ability: UserActionAbility;
  /** 這一列是受保護的頂層組織擁有者(ADR-0009):停用與所屬組織的動作停用並提示 */
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
 * (停用 / 移出租戶一律被 api 以 `OWNER_PROTECTED` 擋下,先在畫面上講清楚)。
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
        <Box component="span" title={protectedTitle}>
          <Button
            variant="text"
            size="small"
            disabled={isOwnerProtected || !isOrgTreeAvailable}
            onClick={() => {
              onManageOrgs(user);
            }}
          >
            {t("actions.orgs")}
          </Button>
        </Box>
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
