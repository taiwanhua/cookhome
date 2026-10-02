import { type MouseEvent, useState } from "react";
import { useTranslations } from "use-intl";

import { Popover } from "@repo/ui/popover";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { UserRow } from "../user-manager-types";

export interface UserOrgsCellProps {
  user: UserRow;
}

/**
 * 所屬組織欄(Figma org-cell 85:163):只寫第一個組織名,其餘收進「+N」標籤,
 * 點開 Popover 列出完整清單(help.md「+N 表示他還屬於其他組織,點開可見完整清單」)。
 */
export const UserOrgsCell = ({ user }: UserOrgsCellProps) => {
  const t = useTranslations("admin.userManager");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [first, ...rest] = user.orgs;

  if (user.orgs.length === 0) {
    return <>{t("none")}</>;
  }

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchor(event.currentTarget);
  };

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <Typography variant="body2" component="span">
        {first.name}
      </Typography>
      {rest.length > 0 && (
        <>
          <Tag
            tone="primary"
            clickable
            label={t("orgsMore", { count: rest.length })}
            aria-label={t("orgsMoreLabel", {
              name: user.name,
              count: rest.length,
            })}
            onClick={handleOpen}
            sx={{ cursor: "pointer" }}
          />
          <Popover
            open={anchor !== null}
            anchorEl={anchor}
            onClose={() => {
              setAnchor(null);
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            <Stack spacing={1} sx={{ px: 1.75, py: 1.5 }}>
              {user.orgs.map((org) => (
                <Typography key={org.id} variant="body2">
                  {org.name}
                </Typography>
              ))}
            </Stack>
          </Popover>
        </>
      )}
    </Stack>
  );
};
