import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Checkbox } from "@repo/ui/checkbox";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { roleOptionLabel } from "@/lib/role-options";

import { type RoleOption, isRoleSelectable } from "./assignable-roles";

export interface RoleOptionRowProps {
  role: RoleOption;
  /** 目標使用者的姓名,用在「此使用者不在角色擁有組織之下」那句提示 */
  userName: string;
  isChecked: boolean;
  onToggle: (roleId: string, isChecked: boolean) => void;
}

/**
 * 指派角色的一列(Figma 86:255):勾選框 + 「角色名稱 — 擁有組織」+ 標籤
 * (組織外 / 已停用 / 租戶副本)+ 描述。
 *
 * 勾不動的三種情形都講明原因,不是把列藏起來:管理範圍外(我搆不到,只能看)、
 * 角色已停用(勾了也不生效,ADR-0011 步驟 2)、**沒有授予資格**(#261 的 6:
 * 使用者的所屬組織不在角色擁有組織的子樹內,ADR-0003)。
 */
export const RoleOptionRow = ({
  role,
  userName,
  isChecked,
  onToggle,
}: RoleOptionRowProps) => {
  const t = useTranslations("admin.userManager.assignRoles");

  const isSelectable = isRoleSelectable(role, isChecked);
  const ownerOrg = role.ownerOrgName ?? role.ownerOrgId ?? "";
  // 「角色名稱 — 擁有組織」:根組織視角下同名角色靠這一段分辨(#261 的 8)
  const label = roleOptionLabel(role.name, role.ownerOrgName);

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
        slotProps={{ input: { "aria-label": label } }}
        onChange={(event) => {
          onToggle(role.id, event.target.checked);
        }}
      />
      <Typography
        variant="subtitle2"
        color={isSelectable ? "text.primary" : "text.disabled"}
        sx={{ minWidth: 100 }}
      >
        {label}
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
        {!role.isEligible && !role.isOutOfReach && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("notEligible", { org: ownerOrg, name: userName })}
            </Typography>
          </Box>
        )}
        {role.description !== null && role.description !== "" && (
          <Typography variant="caption" color="text.disabled">
            {role.description}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
};
