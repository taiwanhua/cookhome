import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  type FormFieldsFragment,
  type UpdateFormMutation,
  useUpdateFormMutation,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { useMutationFeedback } from "@/hooks/useMutationFeedback";
import { useSession } from "@/hooks/useSession";
import { type FormError, formErrorOf } from "@/lib/form-engine/form-errors";
import {
  DEFAULT_TAB_LABEL_TEMPLATE,
  applyTabLabelTemplate,
} from "@/lib/form-engine/tab-label";

export interface EditFormDialogProps {
  form: FormFieldsFragment;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 改表單名稱與頁籤 / 標題模板(`updateForm`)。key 建立後不可改,這裡只顯示。
 * 模板只能引用摘要槽(`{{title}}`、`{{date}}`、`{{amount}}`);留空 = 用模組層的預設模板。
 * 模板下方即時顯示以範例摘要套用的結果(留空時以預設模板 `{{title}}` 示範)。
 */
export const EditFormDialog = ({
  form,
  onClose,
  onSaved,
}: EditFormDialogProps) => {
  const t = useTranslations("admin.forms.edit");
  const tErrors = useTranslations("admin.forms.errors");
  const { session } = useSession();
  const [name, setName] = useState(form.name);
  const [template, setTemplate] = useState(form.tabLabelTemplate ?? "");
  const [error, setError] = useState<FormError | null>(null);
  const preview = applyTabLabelTemplate(
    template.trim() === "" ? DEFAULT_TAB_LABEL_TEMPLATE : template,
    {
      title: t("sampleTitle"),
      date: t("sampleDate"),
      amount: t("sampleAmount"),
    },
  );

  const update = useUpdateFormMutation(
    session.client,
    useMutationFeedback<UpdateFormMutation>({
      success: t("success"),
      error: (failure) => tErrors(formErrorOf(failure).code),
      onSuccess: onSaved,
      onError: (failure) => {
        setError(formErrorOf(failure));
      },
    }),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      title={t("title")}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={name.trim() === "" || update.isPending}
            onClick={() => {
              setError(null);
              update.mutate({
                input: {
                  key: form.key,
                  name: name.trim(),
                  tabLabelTemplate:
                    template.trim() === "" ? null : template.trim(),
                },
              });
            }}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          label={t("key")}
          value={form.key}
          disabled
          size="small"
          helperText={t("keyFixed")}
        />
        <TextField
          label={t("name")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          size="small"
          required
        />
        <TextField
          label={t("template")}
          value={template}
          onChange={(event) => {
            setTemplate(event.target.value);
          }}
          helperText={t("templateHint")}
          size="small"
        />
        <Typography
          variant="body2"
          color="text.secondary"
          role="status"
          aria-label={t("previewLabel")}
        >
          {preview === null
            ? t("previewEmpty")
            : t("preview", { label: preview })}
        </Typography>
        {error !== null && (
          <Alert severity="error">{tErrors(error.code)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
