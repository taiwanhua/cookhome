import { useTranslations } from "use-intl";

import { Checkbox } from "@repo/ui/checkbox";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { type RoleOption, isRoleSelectable } from "./assignable-roles";

export interface RoleOptionRowProps {
  role: RoleOption;
  isChecked: boolean;
  onToggle: (roleId: string, isChecked: boolean) => void;
}

/**
 * 指派角色的一列(Figma 86:255):勾選框 + 角色名 + 標籤(組織外 / 已停用 / 租戶副本)
 * + 擁有組織與描述。
 *
 * 勾不動的兩種情形講明原因,不是把列藏起來:管理範圍外(我搆不到,只能看)、
 * 角色已停用(勾了也不生效,ADR-0011 步驟 2)。
 */
export const RoleOptionRow = ({
  role,
  isChecked,
  onToggle,
}: RoleOptionRowProps) => {
  const t = useTranslations("admin.userManager.assignRoles");

  const isSelectable = isRoleSelectable(role, isChecked);
  const ownerOrg = role.ownerOrgName ?? role.ownerOrgId ?? "";

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: "center",
        py: 1,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Checkbox
        checked={isChecked}
        disabled={!isSelectable}
        slotProps={{ input: { "aria-label": role.name } }}
        onChange={(event) => {
          onToggle(role.id, event.target.checked);
        }}
      />
      <Typography
        variant="subtitle2"
        color={isSelectable ? "text.primary" : "text.disabled"}
        sx={{ minWidth: 100 }}
      >
        {role.name}
      </Typography>
      {role.isOutOfScope && <Tag tone="warning" label={t("outOfScope")} />}
      {!role.enabled && <Tag tone="error" label={t("roleDisabled")} />}
      {role.isTemplateCopy && <Tag tone="grey" label={t("templateCopy")} />}
      <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          color={role.isOutOfReach ? "warning.main" : "text.secondary"}
        >
          {role.isOutOfReach ? t("outOfReach") : t("ownerOrg", { org: ownerOrg })}
        </Typography>
        {role.description !== null && role.description !== "" && (
          <Typography variant="caption" color="text.disabled">
            {role.description}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
};
