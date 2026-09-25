import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { FormSubmissionStatus, useFormSubmissionQuery } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Card } from "@repo/ui/card";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useFormRuntimeVersion } from "@/hooks/useFormRuntimeVersion";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useMe } from "@/hooks/useMe";
import { useModuleForms } from "@/hooks/useModuleForms";
import { useSnackbar } from "@/hooks/useMutationFeedback";
import { useRouteTabItemLabel } from "@/hooks/useRouteTabItemLabel";
import { liveContextOf } from "@/lib/form-engine/expression-context";
import { permissionsOfSubmission } from "@/lib/form-engine/field-permissions";
import { tabLabelOf } from "@/lib/form-engine/tab-label";
import type { ModulePageProps } from "@/lib/module-tree";

import { FormFillForm } from "./FormFillForm";
import { formModuleOptionsOf } from "./form-module-options";
import { formModuleKeyOf, useFormModuleAccess } from "./useFormModuleAccess";

/**
 * 表單模組編輯頁(預設組裝;Spec 6a §8 畫面 9)。網址 `/<模組>/edit-page/<id>`:
 * - 草稿:存草稿 / 送出(建立者本人)
 * - 已完成:儲存修改(需 `edit` + `abilities.canEdit`),每改一次修訂 +1 並存完整快照
 *
 * 寫入帶 `expectedEditVersion`(已完成另帶 `expectedRevision`);不符 → 提示「已被別人更新,請重新載入」,
 * 按「重新載入」重取這一筆、以新的值重新掛表單(REACT-08:表單以 `editVersion` 為 key)。
 */
export const FormEditPage = ({ module, routeParam }: ModulePageProps) => {
  const moduleKey = formModuleKeyOf(module.key);
  const t = useTranslations("admin.formEngine.fill");
  const tErrors = useTranslations("admin.formEngine.errors");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const showSnackbar = useSnackbar();
  const access = useFormModuleAccess(moduleKey);
  const { forms } = useModuleForms(moduleKey);
  const id = routeParam ?? "";
  const state = useFormSubmission(id);
  const { submission } = state;
  const version = useFormRuntimeVersion(
    submission?.formKey ?? null,
    submission?.version ?? null,
  );
  const [now] = useState(() => new Date());
  const formTemplate =
    forms.find((form) => form.key === submission?.formKey)?.tabLabelTemplate ??
    null;
  useRouteTabItemLabel(
    submission === null
      ? null
      : (tabLabelOf(
          formModuleOptionsOf(moduleKey).tabLabelTemplate,
          formTemplate,
          submission.summary,
        ) ?? submission.formName),
  );

  const leave = () => {
    if (access.listRoute !== null) {
      void navigate(access.listRoute);
    }
  };

  if (state.isLoading || version.isLoading) {
    return <CircularProgress aria-label={t("loading")} />;
  }
  if (submission === null || version.definition === null) {
    return (
      <Alert severity="error">
        {tErrors(state.loadError?.code ?? "NOT_FOUND")}
      </Alert>
    );
  }
  if (!submission.abilities.canEdit) {
    return <Alert severity="error">{tErrors("FORBIDDEN")}</Alert>;
  }

  const isCompleted = submission.status === FormSubmissionStatus.Completed;
  const user = me.data?.me;

  return (
    <Card sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 3, py: 2.5 }}>
      <Stack spacing={2.5}>
        <Typography variant="h6" component="h1">
          {t("editTitle", { form: submission.formName ?? submission.formKey })}
        </Typography>
        <FormFillForm
          key={submission.editVersion}
          definition={version.definition}
          formKey={submission.formKey}
          version={submission.version}
          initialValues={submission.values}
          mode="edit"
          permissions={permissionsOfSubmission(submission)}
          expressionContext={liveContextOf(
            user?.id ?? null,
            user?.currentOrg?.id ?? null,
            now,
          )}
          isCompleted={isCompleted}
          isPending={state.isPending}
          error={state.error}
          onSaveDraft={(values) => {
            void state.save(values).then((saved) => {
              if (saved !== null) {
                showSnackbar(
                  "success",
                  isCompleted ? t("changesSaved") : t("draftSaved"),
                );
              }
            });
          }}
          onSubmit={(values) => {
            void state.submit(values).then((submitted) => {
              if (submitted === null) {
                return;
              }
              showSnackbar("success", t("submitted"));
              if (access.viewRoute === null) {
                leave();
              } else {
                void navigate(`${access.viewRoute}/${submitted.id}`);
              }
            });
          }}
          onCancel={leave}
          onReload={() => {
            void queryClient.invalidateQueries({
              queryKey: useFormSubmissionQuery.getKey({ id }),
            });
          }}
        />
      </Stack>
    </Card>
  );
};
