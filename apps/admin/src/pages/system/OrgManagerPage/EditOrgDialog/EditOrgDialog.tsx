import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  useMoveOrgMutation,
  useSetOrgVisibilityMutation,
  useTransferOrgOwnerMutation,
  useUpdateOrgMutation,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";
import type { OrgOption } from "@/lib/org-tree";

import { OrgLogoField } from "../OrgLogoField";
import {
  type OrgManagerErrorCode,
  orgManagerErrorOf,
} from "../org-manager-error";
import type { OrgActionAbility, OrgDetail } from "../org-manager-types";
import { useLogoUpload } from "../useLogoUpload";
import { type OwnerCandidate, TenantTopFields } from "./TenantTopFields";
import { useEditOrgForm } from "./useEditOrgForm";

export interface EditOrgDialogProps {
  org: OrgDetail;
  /** 可當新上層的組織(管理範圍內、同租戶、不含自己與自己的子樹;租戶頂層本身候選為空) */
  parentOptions: readonly OrgOption[];
  /** 這個組織是租戶頂層(api 只讓這一層有擁有者與可見範圍) */
  isTenantTop: boolean;
  ownerCandidates: readonly OwnerCandidate[];
  ability: OrgActionAbility;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 編輯組織(Figma 88:168):名稱、描述、上層組織(搬移)、商標,租戶頂層再多擁有者與可見範圍。
 *
 * 送出時**只打有變動的 mutation**,依序:商標上傳 → `updateOrg` → `moveOrg` →
 * `transferOrgOwner` → `setOrgVisibility`。任何一步失敗就停在那裡並顯示錯誤 —
 * 前面已成功的不回滾(它們各自是完整的動作、各自留了審計),重新送出只會補上還沒做的那幾步。
 */
export const EditOrgDialog = ({
  org,
  parentOptions,
  isTenantTop,
  ownerCandidates,
  ability,
  onClose,
  onSaved,
}: EditOrgDialogProps) => {
  const t = useTranslations("admin.orgManager.form");
  const tEdit = useTranslations("admin.orgManager.edit");
  const tErrors = useTranslations("admin.orgManager.errors");
  const { session } = useSession();
  const form = useEditOrgForm(org);
  const { uploadLogo, isUploading } = useLogoUpload();

  const [errorCode, setErrorCode] = useState<OrgManagerErrorCode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateOrg = useUpdateOrgMutation(session.client);
  const moveOrg = useMoveOrgMutation(session.client);
  const transferOwner = useTransferOrgOwnerMutation(session.client);
  const setVisibility = useSetOrgVisibilityMutation(session.client);

  const isBusy = isSaving || isUploading;

  const submit = async () => {
    setErrorCode(null);
    setIsSaving(true);
    try {
      const { changes } = form;
      if (changes.hasProfileChange) {
        const logoPath = await uploadLogo(form.logoFile);
        await updateOrg.mutateAsync({
          input: {
            id: org.id,
            name: form.name.trim(),
            description:
              form.description.trim() === "" ? null : form.description.trim(),
            logoPath,
          },
        });
      }
      if (changes.hasMove) {
        await moveOrg.mutateAsync({
          input: { id: org.id, newParentId: form.parentId },
        });
      }
      if (changes.hasOwnerChange) {
        await transferOwner.mutateAsync({
          input: { orgId: org.id, newOwnerUserId: form.ownerUserId },
        });
      }
      if (changes.hasVisibilityChange) {
        await setVisibility.mutateAsync({
          input: { orgId: org.id, visibility: form.visibility },
        });
      }
      onSaved();
    } catch (error) {
      setErrorCode(orgManagerErrorOf(error).code);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      title={tEdit("title", { name: org.name })}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!form.isValid || isBusy}
            onClick={() => {
              void submit();
            }}
          >
            {t("save")}
          </Button>
        </>
      }
    >
      <Stack spacing={2.25}>
        <TextField
          label={t("name")}
          value={form.name}
          required
          fullWidth
          disabled={isBusy}
          onChange={(event) => {
            form.setName(event.target.value);
          }}
        />
        <TextField
          label={t("description")}
          value={form.description}
          fullWidth
          multiline
          minRows={2}
          disabled={isBusy}
          onChange={(event) => {
            form.setDescription(event.target.value);
          }}
        />
        {ability.canMove && !org.isSystem && (
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary">
              {t("parent")}
            </Typography>
            <Select
              value={form.parentId}
              displayEmpty
              fullWidth
              disabled={isBusy}
              aria-label={t("parent")}
              onChange={(event) => {
                form.setParentId(event.target.value);
              }}
            >
              <MenuItem value="">{t("parentUnset")}</MenuItem>
              {parentOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.path}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">
              {t("parentHint")}
            </Typography>
          </Stack>
        )}
        <OrgLogoField
          file={form.logoFile}
          onFileChange={form.setLogoFile}
          isDisabled={isBusy}
        />
        {isTenantTop && (
          <TenantTopFields
            form={form}
            canTransferOwner={ability.canTransferOwner}
            canSetVisibility={ability.canSetVisibility}
            candidates={ownerCandidates}
            isDisabled={isBusy}
          />
        )}
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
