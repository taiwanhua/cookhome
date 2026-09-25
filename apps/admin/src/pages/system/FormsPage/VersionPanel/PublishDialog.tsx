import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  type PublishFormVersionMutation,
  usePublishFormVersionMutation,
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

export interface PublishDialogProps {
  formKey: string;
  draftRevision: number;
  onClose: () => void;
  onPublished: () => void;
}

/**
 * 發布草稿(Spec 6a §6 四步發布):`changelog` 必填;帶 `expectedDraftRevision`(草稿被別人改過 → `CONFLICT`)。
 * 檢查器有錯 → `VALIDATION_FAILED` + `issues`,就地列出(改完草稿再發布);中斷則在版本面板顯示「重試」。
 */
export const PublishDialog = ({
  formKey,
  draftRevision,
  onClose,
  onPublished,
}: PublishDialogProps) => {
  const t = useTranslations("admin.forms.publish");
  const tErrors = useTranslations("admin.forms.errors");
  const { session } = useSession();
  const [changelog, setChangelog] = useState("");
  const [error, setError] = useState<FormError | null>(null);

  const publish = usePublishFormVersionMutation(
    session.client,
    useMutationFeedback<PublishFormVersionMutation>({
      success: (payload) =>
        t("success", {
          version: payload.publishFormVersion.formVersion.version ?? 0,
        }),
      error: (failure) => tErrors(formErrorOf(failure).code),
      onSuccess: onPublished,
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
      maxWidth="sm"
      title={t("title")}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={changelog.trim() === "" || publish.isPending}
            onClick={() => {
              setError(null);
              publish.mutate({
                input: {
                  formKey,
                  expectedDraftRevision: draftRevision,
                  changelog: changelog.trim(),
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
        <Typography variant="body2">{t("body")}</Typography>
        <TextField
          label={t("changelog")}
          value={changelog}
          onChange={(event) => {
            setChangelog(event.target.value);
          }}
          multiline
          minRows={3}
          required
          size="small"
        />
        {error !== null && (
          <Alert severity="error">
            <Stack spacing={0.5}>
              <span>{tErrors(error.code)}</span>
              {(error.issues ?? []).map((issue, index) => (
                <span key={`${issue.code}-${String(index)}`}>
                  {issue.message}
                </span>
              ))}
            </Stack>
          </Alert>
        )}
      </Stack>
    </Dialog>
  );
};
