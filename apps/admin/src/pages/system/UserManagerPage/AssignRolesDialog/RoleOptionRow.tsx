import { useTranslations } from "use-intl";

import { Checkbox } from "@repo/ui/checkbox";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { RoleOption } from "./assignable-roles";

export interface RoleOptionRowProps {
  role: RoleOption;
  isChecked: boolean;
  onToggle: (roleId: string, isChecked: boolean) => void;
}

/**
 * 指派角色的一列(Figma 86:255):勾選框 + 角色名 +「組織外」標籤 + 擁有組織。
 * 操作者自己沒有的角色 disabled 並說明原因(防越權,不是壞掉)。
 */
export const RoleOptionRow = ({
  role,
  isChecked,
  onToggle,
}: RoleOptionRowProps) => {
  const t = useTranslations("admin.userManager.assignRoles");

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
        disabled={role.isOutOfReach}
        slotProps={{ input: { "aria-label": role.name } }}
        onChange={(event) => {
          onToggle(role.id, event.target.checked);
        }}
      />
      <Typography
        variant="subtitle2"
        color={role.isOutOfReach ? "text.disabled" : "text.primary"}
        sx={{ minWidth: 100 }}
      >
        {role.name}
      </Typography>
      {role.isOutOfScope && <Tag tone="warning" label={t("outOfScope")} />}
      <Typography
        variant="caption"
        color={role.isOutOfReach ? "warning.main" : "text.secondary"}
        sx={{ flex: 1 }}
      >
        {role.isOutOfReach
          ? t("outOfReach")
          : t("ownerOrg", { org: role.ownerOrgName ?? role.ownerOrgId ?? "" })}
      </Typography>
    </Stack>
  );
};
