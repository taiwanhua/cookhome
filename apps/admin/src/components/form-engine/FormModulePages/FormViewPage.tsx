import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useModuleForms } from "@/hooks/useModuleForms";
import { useRouteTabItemLabel } from "@/hooks/useRouteTabItemLabel";
import { tabLabelOf } from "@/lib/form-engine/tab-label";
import type { ModulePageProps } from "@/lib/module-tree";

import { FormSubmissionDetail } from "../FormSubmissionDetail/FormSubmissionDetail";
import { DeleteSubmissionDialog } from "./DeleteSubmissionDialog";
import { formModuleOptionsOf } from "./form-module-options";
import { formModuleKeyOf, useFormModuleAccess } from "./useFormModuleAccess";

/**
 * 表單模組詳情頁(預設組裝;Spec 6a §8 畫面 11)。網址 `/<模組>/view-page/<id>`。
 * 頁籤 / 標題 = 模組層模板套摘要槽,表單的 `tabLabelTemplate` 可覆寫;
 * 編輯 / 刪除依 api 的 `abilities`(已含權限)與「有沒有綁編輯頁」相乘。
 */
export const FormViewPage = ({ module, routeParam }: ModulePageProps) => {
  const moduleKey = formModuleKeyOf(module.key);
  const t = useTranslations("admin.formEngine.pages");
  const navigate = useNavigate();
  const access = useFormModuleAccess(moduleKey);
  const { forms } = useModuleForms(moduleKey);
  const id = routeParam ?? "";
  const state = useFormSubmission(id);
  const { submission } = state;
  const [isDeleting, setIsDeleting] = useState(false);

  const formTemplate =
    forms.find((form) => form.key === submission?.formKey)?.tabLabelTemplate ??
    null;
  const title =
    submission === null
      ? null
      : (tabLabelOf(
          formModuleOptionsOf(moduleKey).tabLabelTemplate,
          formTemplate,
          submission.summary,
        ) ??
        submission.formName ??
        submission.formKey);
  useRouteTabItemLabel(title);

  const leave = () => {
    if (access.listRoute !== null) {
      void navigate(access.listRoute);
    }
  };

  return (
    <Card sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 3, py: 2.5 }}>
      <Stack spacing={2.25}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Button variant="text" size="small" onClick={leave}>
            {t("backToList")}
          </Button>
          <Box sx={{ flex: 1 }} />
          {submission?.abilities.canDelete === true && (
            <Button
              variant="text"
              color="error"
              onClick={() => {
                setIsDeleting(true);
              }}
            >
              {t("delete")}
            </Button>
          )}
          {access.editRoute !== null &&
            submission?.abilities.canEdit === true && (
              <Button
                onClick={() => {
                  void navigate(`${access.editRoute ?? ""}/${id}`);
                }}
              >
                {t("edit")}
              </Button>
            )}
        </Stack>
        {title !== null && (
          <Typography variant="h6" component="h1">
            {title}
          </Typography>
        )}
        <FormSubmissionDetail id={id} />
      </Stack>
      {isDeleting && submission !== null && (
        <DeleteSubmissionDialog
          label={title ?? submission.formKey}
          isSubmitting={state.isPending}
          errorCode={state.error?.code ?? null}
          onCancel={() => {
            setIsDeleting(false);
          }}
          onConfirm={() => {
            void state.remove().then((isDeleted) => {
              if (isDeleted) {
                leave();
              }
            });
          }}
        />
      )}
    </Card>
  );
};
