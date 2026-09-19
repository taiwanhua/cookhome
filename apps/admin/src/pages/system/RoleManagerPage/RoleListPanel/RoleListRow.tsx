import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { ListItemButton } from "@repo/ui/list";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { RoleActionAbility, RoleRow } from "../role-manager-types";

export interface RoleListRowProps {
  role: RoleRow;
  isSelected: boolean;
  ability: RoleActionAbility;
  onSelect: (roleId: string) => void;
  onEdit: (role: RoleRow) => void;
  onToggleEnabled: (role: RoleRow) => void;
  onDelete: (role: RoleRow) => void;
}

/**
 * 角色清單的一列(Figma 44:630 ~ 44:648):名稱 + 狀態 / 來源標籤,第二行是擁有組織、
 * 持有人數與描述。動作只在選中的那一列出現(Figma 只在 active 列畫了圖示),
 * 並各自依權限顯示(ADR-0011「頁內功能」);動作列放在可點區塊之外,避免點動作連帶選取。
 */
export const RoleListRow = ({
  role,
  isSelected,
  ability,
  onSelect,
  onEdit,
  onToggleEnabled,
  onDelete,
}: RoleListRowProps) => {
  const t = useTranslations("admin.roleManager");
  const hasActions =
    ability.canEdit || ability.canToggleEnabled || ability.canDelete;

  return (
    <Box>
      <ListItemButton
        selected={isSelected}
        sx={{ display: "block", borderRadius: 1, px: 1, py: 1.25 }}
        onClick={() => {
          onSelect(role.id);
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2">{role.name}</Typography>
          {role.isSystem && <Tag label={t("tags.system")} />}
          {role.isTemplateCopy && (
            <Tag tone="primary" label={t("tags.templateCopy")} />
          )}
          {!role.enabled && <Tag tone="error" label={t("status.disabled")} />}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p">
          {t("rowSummary", {
            org: role.ownerOrg?.name ?? t("none"),
            count: role.userCount,
          })}
        </Typography>
        {role.description !== null && role.description !== "" && (
          <Typography variant="caption" color="text.secondary" component="p">
            {role.description}
          </Typography>
        )}
      </ListItemButton>
      {isSelected && hasActions && (
        <Stack direction="row" spacing={0.5} sx={{ px: 0.5, pb: 0.5 }}>
          {ability.canEdit && (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                onEdit(role);
              }}
            >
              {t("actions.edit")}
            </Button>
          )}
          {ability.canToggleEnabled && (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                onToggleEnabled(role);
              }}
            >
              {role.enabled ? t("actions.disable") : t("actions.enable")}
            </Button>
          )}
          {ability.canDelete && (
            <Button
              variant="text"
              size="small"
              color="error"
              onClick={() => {
                onDelete(role);
              }}
            >
              {t("actions.delete")}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
};
