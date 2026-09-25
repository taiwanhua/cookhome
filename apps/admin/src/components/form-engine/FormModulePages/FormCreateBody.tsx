import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";

import type { FormDefinition } from "@repo/domain/form";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useFormDraft } from "@/hooks/useFormDraft";
import { useMe } from "@/hooks/useMe";
import type { ModuleFormSummary } from "@/hooks/useModuleForms";
import { useSnackbar } from "@/hooks/useMutationFeedback";
import { usePermissions } from "@/hooks/usePermissions";
import { liveContextOf } from "@/lib/form-engine/expression-context";
import {
  permissionsFromHeld,
  permissionsOfSubmission,
} from "@/lib/form-engine/field-permissions";

import { FormFillForm } from "./FormFillForm";
import type { FormModuleAccess } from "./useFormModuleAccess";

export interface FormCreateBodyProps {
  moduleKey: string;
  form: ModuleFormSummary;
  definition: FormDefinition;
  access: FormModuleAccess;
  onLeave: () => void;
}

/**
 * 新增的本體(外層已 gate 好表單與版本定義)。欄位級權限:草稿還沒建之前由持有的權限 key 推,
 * 建了之後用 api 算的 `fieldStates` / `abilities`(docs/modules/forms.md「讀取投影」)。
 * 送出成功 → 詳情頁(沒綁詳情頁就回列表);存草稿成功留在原頁,之後的寫入都針對同一筆草稿。
 */
export const FormCreateBody = ({
  moduleKey,
  form,
  definition,
  access,
  onLeave,
}: FormCreateBodyProps) => {
  const t = useTranslations("admin.formEngine.fill");
  const navigate = useNavigate();
  const me = useMe();
  const { hasPermission } = usePermissions();
  const showSnackbar = useSnackbar();
  const draft = useFormDraft(form.key);
  const [now] = useState(() => new Date());
  const user = me.data?.me;

  const permissions =
    draft.draft === null
      ? permissionsFromHeld({
          moduleKey,
          formKey: form.key,
          fields: definition.fields,
          hasPermission,
        })
      : permissionsOfSubmission(draft.draft);

  return (
    <Stack spacing={2.5}>
      <Typography variant="h6" component="h1">
        {t("createTitle", { form: form.name })}
      </Typography>
      <FormFillForm
        definition={definition}
        formKey={form.key}
        version={form.currentVersion}
        initialValues={{}}
        mode="create"
        permissions={permissions}
        expressionContext={liveContextOf(
          user?.id ?? null,
          user?.currentOrg?.id ?? null,
          now,
        )}
        isCompleted={false}
        isPending={draft.isPending}
        error={draft.error}
        onSaveDraft={(values) => {
          void draft.saveDraft(values).then((saved) => {
            if (saved !== null) {
              showSnackbar("success", t("draftSaved"));
            }
          });
        }}
        onSubmit={(values) => {
          void draft.submit(values).then((submitted) => {
            if (submitted === null) {
              return;
            }
            showSnackbar("success", t("submitted"));
            if (access.viewRoute === null) {
              onLeave();
            } else {
              void navigate(`${access.viewRoute}/${submitted.id}`);
            }
          });
        }}
        onCancel={onLeave}
        onReload={() => {
          if (draft.draft !== null && access.editRoute !== null) {
            void navigate(`${access.editRoute}/${draft.draft.id}`);
          }
        }}
      />
    </Stack>
  );
};
