import { useTranslations } from "use-intl";

import { DEFAULT_TENANT_TIMEZONE } from "@repo/domain/form";
import { OrgVisibility } from "@repo/graphql";
import { Autocomplete } from "@repo/ui/autocomplete";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { timezoneOptionsOf } from "./timezone-options";
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
  /** 持 `system.org-manager.set-timezone` 才改得了時區;沒有時唯讀顯示目前值 */
  canSetTimezone: boolean;
  candidates: readonly OwnerCandidate[];
  isDisabled: boolean;
}

/**
 * 編輯組織彈窗的**租戶頂層專屬**兩欄(Figma 88:189 是其中的可見範圍;擁有者欄設計稿未畫,
 * 依 `docs/modules/org-manager.md`「編輯組織」補上)。
 *
 * 出現條件是兩件事同時成立:**這個組織是租戶頂層**(api 只讓這一層有擁有者與可見範圍)
 * **且操作者持對應的權限**:
 * - 擁有者轉移是根組織專屬(`tenant-ops.transfer-owner`),租戶管理員拿不到;
 *   租戶短碼同樣只有根組織改得動(api 以「站在根組織」守門),跟著同一把權限出現
 * - 可見範圍開關 2026-09-19 搬到組織管理層(`system.org-manager.set-visibility`,#187):
 *   租戶管理員模板自動取得,設得了自己的租戶;能設哪些由 api 以管理範圍守門
 *
 * 「時區」欄例外:租戶頂層一律顯示(時區影響整個租戶的日期時間,看得到編輯彈窗的人都該知道),
 * 持 `system.org-manager.set-timezone` 才改得動,否則唯讀。選項是瀏覽器的完整 IANA 清單,
 * 沒設時說明會退回預設時區。
 */
export const TenantTopFields = ({
  form,
  canTransferOwner,
  canSetVisibility,
  canSetTimezone,
  candidates,
  isDisabled,
}: TenantTopFieldsProps) => {
  const t = useTranslations("admin.orgManager.form");
  const timezoneUnset = t("timezoneUnset", {
    timezone: DEFAULT_TENANT_TIMEZONE,
  });

  return (
    <Stack spacing={2.25}>
      {canTransferOwner && (
        <TextField
          label={t("slug")}
          value={form.slug}
          required
          fullWidth
          disabled={isDisabled}
          error={form.isSlugInvalid}
          helperText={form.isSlugInvalid ? t("slugInvalid") : t("slugHint")}
          onChange={(event) => {
            form.setSlug(event.target.value);
          }}
        />
      )}
      {canTransferOwner && (
        <SelectField
          label={t("owner")}
          value={form.ownerUserId}
          displayEmpty
          fullWidth
          disabled={isDisabled}
          helperText={t("ownerHint")}
          options={[
            { value: "", label: t("ownerUnset") },
            ...candidates.map((candidate) => ({
              value: candidate.id,
              label: t("ownerOption", {
                name: candidate.name,
                account: candidate.account,
              }),
            })),
          ]}
          onChange={form.setOwnerUserId}
        />
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
      <Autocomplete<string>
        label={t("timezone")}
        options={timezoneOptionsOf(form.timezone)}
        value={form.timezone}
        getOptionLabel={(timezone) => timezone}
        onChange={form.setTimezone}
        placeholder={timezoneUnset}
        noOptionsText={t("timezoneEmpty")}
        helperText={form.timezone === null ? timezoneUnset : t("timezoneHint")}
        disabled={isDisabled || !canSetTimezone}
        fullWidth
      />
    </Stack>
  );
};
