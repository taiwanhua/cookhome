import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  type FormFieldsFragment,
  type SetTenantFormEnabledMutation,
  useSetTenantFormEnabledMutation,
} from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Tabs } from "@repo/ui/tabs";
import { Typography } from "@repo/ui/typography";

import { useMutationFeedback } from "@/hooks/useMutationFeedback";
import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";
import { formErrorOf } from "@/lib/form-engine/form-errors";

import { FormDesigner } from "./FormDesigner/FormDesigner";
import { AssignFormDialog } from "./FormDialogs/AssignFormDialog";
import { EditFormDialog } from "./FormDialogs/EditFormDialog";
import { ForkFormDialog } from "./FormDialogs/ForkFormDialog";
import { VersionPanel } from "./VersionPanel/VersionPanel";
import { WorkflowBindingField } from "./WorkflowBinding/WorkflowBindingField";
import { FORMS_PERMISSIONS } from "./forms-permissions";

export interface FormDetailPanelProps {
  form: FormFieldsFragment;
  onChanged: () => void;
  onForked: (formKey: string) => void;
}

type DetailTab = "design" | "versions";
type OpenDialog = "edit" | "fork" | "assign" | null;

/**
 * 表單管理右欄(Spec 6a §8 畫面 1 的右側):表單資料、設計 / 版本兩個頁籤,以及
 * 編輯名稱與頁籤模板、以此為基底建新表單、分派租戶(root)、在本組織啟用與流程綁定(租戶)。
 * 按鈕一律依 api 的 `form.abilities`(已含權限與「是不是自己的表單 / 站在哪裡」)。
 */
export const FormDetailPanel = ({
  form,
  onChanged,
  onForked,
}: FormDetailPanelProps) => {
  const t = useTranslations("admin.forms.detail");
  const tErrors = useTranslations("admin.forms.errors");
  const { session } = useSession();
  const [tab, setTab] = useState<DetailTab>("design");
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const { hasPermission } = usePermissions();
  // 流程綁定是租戶自己的設定(root 沒有表單綁定,api 回 TENANT_ONLY):租戶視角才有 `tenantEnabled`
  const isTenantView =
    form.tenantEnabled !== null && form.tenantEnabled !== undefined;

  const setEnabled = useSetTenantFormEnabledMutation(
    session.client,
    useMutationFeedback<SetTenantFormEnabledMutation>({
      success: (payload) =>
        payload.setTenantFormEnabled.form.tenantEnabled === true
          ? t("enabledOn")
          : t("enabledOff"),
      error: (failure) => tErrors(formErrorOf(failure).code),
      onSuccess: onChanged,
    }),
  );

  return (
    <Card
      component="section"
      aria-label={t("region")}
      sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto", p: 3 }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 1 }}
        >
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h1">
              {form.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("meta", {
                key: form.key,
                module: form.moduleName ?? form.moduleKey,
              })}
            </Typography>
            {form.forkedFrom !== null && form.forkedFrom !== undefined && (
              <Typography variant="body2" color="text.secondary">
                {t("forkedFrom", {
                  key: form.forkedFrom.formKey,
                  version: form.forkedFrom.version,
                })}
              </Typography>
            )}
          </Stack>
          {form.abilities.canEdit && (
            <Button
              variant="text"
              onClick={() => {
                setDialog("edit");
              }}
            >
              {t("edit")}
            </Button>
          )}
          {form.abilities.canFork && (
            <Button
              variant="outlined"
              onClick={() => {
                setDialog("fork");
              }}
            >
              {t("fork")}
            </Button>
          )}
          {form.abilities.canAssign && (
            <Button
              variant="outlined"
              onClick={() => {
                setDialog("assign");
              }}
            >
              {t("assign")}
            </Button>
          )}
        </Stack>
        {form.abilities.canSetEnabled &&
          form.tenantEnabled !== null &&
          form.tenantEnabled !== undefined && (
            <FormControlLabel
              label={t("tenantEnabled")}
              control={
                <Switch
                  checked={form.tenantEnabled}
                  disabled={setEnabled.isPending}
                  onChange={(_event, enabled) => {
                    setEnabled.mutate({
                      input: { formKey: form.key, enabled },
                    });
                  }}
                />
              }
            />
          )}
        {isTenantView && hasPermission(FORMS_PERMISSIONS.edit) && (
          <WorkflowBindingField form={form} onChanged={onChanged} />
        )}
        {form.assignments.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("assignedTo", {
              tenants: form.assignments
                .map((item) => item.tenantName ?? item.tenantOrgId)
                .join("、"),
            })}
          </Typography>
        )}
        <Tabs
          aria-label={t("tabs")}
          value={tab}
          onChange={(next) => {
            setTab(next === "versions" ? "versions" : "design");
          }}
          items={[
            { value: "design", label: t("tabDesign") },
            { value: "versions", label: t("tabVersions") },
          ]}
        />
        {/* 兩個頁籤都保持掛載、只切顯示:切到「版本」不能讓設計器卸載(未存的改動會無聲消失) */}
        <Box hidden={tab !== "design"}>
          <FormDesigner form={form} onChanged={onChanged} />
        </Box>
        <Box hidden={tab !== "versions"}>
          <VersionPanel form={form} onChanged={onChanged} />
        </Box>
      </Stack>
      {dialog === "edit" && (
        <EditFormDialog
          form={form}
          onClose={() => {
            setDialog(null);
          }}
          onSaved={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
      {dialog === "fork" && (
        <ForkFormDialog
          source={form}
          onClose={() => {
            setDialog(null);
          }}
          onForked={(formKey) => {
            setDialog(null);
            onForked(formKey);
          }}
        />
      )}
      {dialog === "assign" && (
        <AssignFormDialog
          form={form}
          onClose={() => {
            setDialog(null);
          }}
          onChanged={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
};
