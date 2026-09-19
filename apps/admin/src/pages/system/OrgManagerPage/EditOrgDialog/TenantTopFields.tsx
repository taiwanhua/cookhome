import { useTranslations } from "use-intl";

import { OrgVisibility } from "@repo/graphql";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Typography } from "@repo/ui/typography";

import type { EditOrgFormState } from "./useEditOrgForm";

export interface OwnerCandidate {
  id: string;
  name: string;
  account: string;
}

export interface TenantTopFieldsProps {
  form: EditOrgFormState;
  /** 持 `tenant-ops.transfer-owner` 才給「擁有者」欄 */
  canTransferOwner: boolean;
  /** 持 `system.org-manager.set-visibility` 才給可見範圍開關(#187:不再是根組織專屬) */
  canSetVisibility: boolean;
  candidates: readonly OwnerCandidate[];
  isDisabled: boolean;
}

/**
 * 編輯組織彈窗的**租戶頂層專屬**兩欄(Figma 88:189 是其中的可見範圍;擁有者欄設計稿未畫,
 * 依 `docs/modules/org-manager.md`「編輯組織」補上)。
 *
 * 出現條件是兩件事同時成立:**這個組織是租戶頂層**(api 只讓這一層有擁有者與可見範圍)
 * **且操作者持對應的權限**:
 * - 擁有者轉移是根組織專屬(`tenant-ops.transfer-owner`),租戶管理員拿不到
 * - 可見範圍開關 2026-09-19 搬到組織管理層(`system.org-manager.set-visibility`,#187):
 *   租戶管理員模板自動取得,設得了自己的租戶;能設哪些由 api 以管理範圍守門
 */
export const TenantTopFields = ({
  form,
  canTransferOwner,
  canSetVisibility,
  candidates,
  isDisabled,
}: TenantTopFieldsProps) => {
  const t = useTranslations("admin.orgManager.form");

  return (
    <Stack spacing={2.25}>
      {canTransferOwner && (
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            {t("owner")}
          </Typography>
          <Select
            value={form.ownerUserId}
            displayEmpty
            fullWidth
            disabled={isDisabled}
            aria-label={t("owner")}
            onChange={(event) => {
              form.setOwnerUserId(event.target.value);
            }}
          >
            <MenuItem value="">{t("ownerUnset")}</MenuItem>
            {candidates.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {t("ownerOption", {
                  name: candidate.name,
                  account: candidate.account,
                })}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary">
            {t("ownerHint")}
          </Typography>
        </Stack>
      )}
      {canSetVisibility && (
        <Stack spacing={0.5}>
          <FormControlLabel
            control={
              <Switch
                checked={form.visibility === OrgVisibility.Subtree}
                disabled={isDisabled}
                onChange={(event) => {
                  form.setVisibility(
                    event.target.checked
                      ? OrgVisibility.Subtree
                      : OrgVisibility.Own,
                  );
                }}
              />
            }
            label={t("visibility")}
          />
          <Typography variant="caption" color="text.secondary">
            {t("visibilityHint")}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};
