import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { tabLabelOf, tabLabelValuesOf } from "@/lib/form-engine/tab-label";
import type { ModulePageProps } from "@/lib/module-tree";

import { FormFillForm } from "./FormFillForm";
import { formModuleOptionsOf } from "./form-module-options";
import { formModuleKeyOf, useFormModuleAccess } from "./useFormModuleAccess";

/**
 * 表單模組編輯頁(預設組裝;Spec 6a §8 畫面 9)。網址 `/<模組>/edit-page/<id>`:
 * - 草稿:存草稿 / 送出(建立者本人)
 * - 已完成(沒走過流程):儲存修改(需 `edit` + `abilities.canEdit`),每改一次修訂 +1 並存完整快照
 * - 被退回 / 已撤回(申請人本人):同草稿,改完再送出 = 修訂 +1、重新審核
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
  const user = me.data?.me;
  const userId = user?.id ?? null;
  const orgId = user?.currentOrg?.id ?? null;
  // 權限與 ctx 以 useMemo 保持身分穩定:`FormRenderer` 以它們為 memo 依賴
  const timezone = version.timezone;
  const expressionContext = useMemo(
    () => liveContextOf(userId, orgId, now, timezone),
    [userId, orgId, now, timezone],
  );
  const permissions = useMemo(
    () => (submission === null ? null : permissionsOfSubmission(submission)),
    [submission],
  );
  const formTemplate =
    forms.find((form) => form.key === submission?.formKey)?.tabLabelTemplate ??
    null;
  useRouteTabItemLabel(
    submission === null
      ? null
      : (tabLabelOf(
          formModuleOptionsOf(moduleKey).tabLabelTemplate,
          formTemplate,
          tabLabelValuesOf(submission),
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
  // 預設值只在「還沒送出過的草稿」跟著依賴重算;送出過(退回 / 撤回 / 已完成)不再動使用者的值
  const isFreshDraft =
    submission.status === FormSubmissionStatus.Draft &&
    submission.revision === 0;

  return (
    <Card sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 3, py: 2.5 }}>
      <Stack spacing={2.5}>
        <Typography variant="h6" component="h1">
          {t("editTitle", { form: submission.formName ?? submission.formKey })}
        </Typography>
        {(submission.status === FormSubmissionStatus.Returned ||
          submission.status === FormSubmissionStatus.Withdrawn) && (
          <Alert severity="info">
            {t(
              submission.status === FormSubmissionStatus.Returned
                ? "returnedHint"
                : "withdrawnHint",
            )}
          </Alert>
        )}
        <FormFillForm
          key={submission.editVersion}
          definition={version.definition}
          formKey={submission.formKey}
          version={submission.version}
          initialValues={submission.values}
          initialTouched={submission.touched}
          recomputeDefaults={isFreshDraft}
          fillDefaultsOnMount={false}
          systemLabels={{
            user: user?.name ?? null,
            org: user?.currentOrg?.name ?? null,
          }}
          mode="edit"
          permissions={permissions ?? permissionsOfSubmission(submission)}
          expressionContext={expressionContext}
          isCompleted={isCompleted}
          isPending={state.isPending}
          error={state.error}
          onSaveDraft={(values, touched) => {
            void state.save(values, touched).then((saved) => {
              if (saved !== null) {
                showSnackbar(
                  "success",
                  isCompleted ? t("changesSaved") : t("draftSaved"),
                );
              }
            });
          }}
          onSubmit={(values, touched) => {
            void state.submit(values, touched).then((submitted) => {
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
