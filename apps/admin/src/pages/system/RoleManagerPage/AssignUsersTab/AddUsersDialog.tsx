import { useState } from "react";
import { useTranslations } from "use-intl";

import { useRoleUserCandidatesQuery } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Dialog } from "@repo/ui/dialog";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";

import type { RoleManagerErrorCode } from "../role-manager-error";
import {
  ROLE_USER_CANDIDATES_PAGE_SIZE,
  type RoleRow,
} from "../role-manager-types";

export interface AddUsersDialogProps {
  role: RoleRow;
  isSubmitting: boolean;
  errorCode: RoleManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: (userIds: readonly string[]) => void;
}

/**
 * 加入使用者(Figma 69:697)。清單來自 `roleUserCandidates`(#246 的 4):
 * 操作者**管理範圍**內、**尚未持有**這個角色的人,每筆自帶 `eligible`。
 *
 * **範圍外的人也列出來,只是勾不動**(#261 的 7):直接不列的話,找不到人的人只會覺得
 * 「這個人不見了」,而不知道是資格不符。資格由 api 算(`eligible`),前端不再自己走組織樹。
 *
 * 權限:這支 query 掛在 `system.role-manager.assign-users` 底下 —— 在 #246 之前這裡借
 * `users`,連帶逼得這個彈窗需要 `system.user-manager.view`,能分配使用者的人卻打不開。
 * 判定權仍在 api:送出時 `grantRoleUsers` 會回 `USER_NOT_ELIGIBLE`。
 */
export const AddUsersDialog = ({
  role,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: AddUsersDialogProps) => {
  const t = useTranslations("admin.roleManager.addUsers");
  const tErrors = useTranslations("admin.roleManager.errors");
  const { session } = useSession();
  const [keyword, setKeyword] = useState("");
  const [pickedIds, setPickedIds] = useState<readonly string[]>([]);

  const ownerOrgName = role.ownerOrg?.name ?? t("noOrg");

  const candidatesQuery = useRoleUserCandidatesQuery(session.client, {
    roleId: role.id,
    input: {
      page: 1,
      pageSize: ROLE_USER_CANDIDATES_PAGE_SIZE,
      keyword: keyword.trim() === "" ? null : keyword.trim(),
    },
  });
  const candidates = candidatesQuery.data?.roleUserCandidates.items ?? [];

  const toggle = (userId: string) => {
    setPickedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="sm"
      title={t("title", { name: role.name, org: ownerOrgName })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            disabled={pickedIds.length === 0 || isSubmitting}
            onClick={() => {
              onConfirm(pickedIds);
            }}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <TextField
          label={t("search")}
          placeholder={t("searchPlaceholder")}
          size="small"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
        />
        {/* px:1 讓 checkbox 的左框線落在捲動區內 — 貼齊左緣時會被 overflow 切掉(#283) */}
        <Box sx={{ maxHeight: 280, overflow: "auto", px: 1 }}>
          {candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t("empty")}
            </Typography>
          )}
          {candidates.map((candidate) => (
            <Box key={candidate.id}>
              <FormControlLabel
                disabled={!candidate.eligible}
                control={
                  <Checkbox
                    checked={pickedIds.includes(candidate.id)}
                    disabled={!candidate.eligible}
                    onChange={() => {
                      toggle(candidate.id);
                    }}
                  />
                }
                label={t("candidate", {
                  account: candidate.account,
                  name: candidate.name,
                  orgs:
                    candidate.orgs.length === 0
                      ? t("noOrg")
                      : candidate.orgs.map((org) => org.name).join("、"),
                })}
              />
              {!candidate.eligible && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="p"
                  sx={{ pl: 4, pb: 0.5 }}
                >
                  {t("notEligible", { org: ownerOrgName })}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t("hint", { org: ownerOrgName })}
        </Typography>
        <Typography variant="body2">
          {t("picked", { count: pickedIds.length })}
        </Typography>
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
