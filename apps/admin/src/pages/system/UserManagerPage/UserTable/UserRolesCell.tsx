import { Fragment } from "react";
import { useTranslations } from "use-intl";

import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { UserRow } from "../user-manager-types";

export interface UserRolesCellProps {
  user: UserRow;
}

/**
 * 角色欄(Figma roles-cell 139:1503):角色名以頓號串接,
 * `outOfScope` 的授予在名稱後面掛一個「組織外」警示標籤(ADR-0003;白話說明在工具列下方)。
 */
export const UserRolesCell = ({ user }: UserRolesCellProps) => {
  const t = useTranslations("admin.userManager");

  if (user.roles.length === 0) {
    return <>{t("none")}</>;
  }

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}
    >
      {user.roles.map((role, index) => (
        <Fragment key={role.id}>
          <Typography variant="body2" component="span">
            {role.name}
          </Typography>
          {role.outOfScope && (
            <Tag tone="warning" label={t("roleOutOfScope")} />
          )}
          {index < user.roles.length - 1 && (
            <Typography variant="body2" component="span">
              、
            </Typography>
          )}
        </Fragment>
      ))}
    </Stack>
  );
};
