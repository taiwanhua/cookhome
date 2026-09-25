import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import type { FieldDef } from "@repo/domain/form";
import {
  FormSubmissionStatus,
  useFormSubmissionAttachmentUrlQuery,
  useFormSubmissionQuery,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { useFormRuntimeVersion } from "@/hooks/useFormRuntimeVersion";
import { useSession } from "@/hooks/useSession";
import {
  liveContextOf,
  revisionContextOf,
} from "@/lib/form-engine/expression-context";
import { permissionsOfSubmission } from "@/lib/form-engine/field-permissions";
import { formErrorOf } from "@/lib/form-engine/form-errors";

import { FormRenderer } from "../FormRenderer/FormRenderer";
import { RevisionHistory } from "./RevisionHistory";

export interface FormSubmissionDetailProps {
  id: string;
}

/**
 * 詳情(Spec 6a §8 `<FormSubmissionDetail id>`、畫面 11):唯讀渲染(條件用**該修訂的 `ctx`**、不重算存值)、
 * 現名 / 快照顯示(`displayValues`)、附件下載(簽名網址,看得到這一欄才簽)、修訂紀錄與差異。
 * 讀取權限(哪些欄位遮蔽)永遠看現在的讀者 —— 由 api 投影,前端照 `fieldStates` 不渲染看不到的欄。
 */
export const FormSubmissionDetail = ({ id }: FormSubmissionDetailProps) => {
  const t = useTranslations("admin.formEngine.detail");
  const tErrors = useTranslations("admin.formEngine.errors");
  const { session } = useSession();
  const [viewedRevision, setViewedRevision] = useState<number | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const current = useFormSubmissionQuery(
    session.client,
    { id },
    { retry: false },
  );
  const viewed = useFormSubmissionQuery(
    session.client,
    { id, revision: viewedRevision ?? 0 },
    { enabled: viewedRevision !== null, retry: false },
  );
  const base = current.data?.formSubmission.submission ?? null;
  const shown =
    viewedRevision === null
      ? base
      : (viewed.data?.formSubmission.submission ?? null);
  const [now] = useState(() => new Date());
  // 已完成:條件用那次修訂的 ctx;草稿(還沒有 ctx):用真正的現在 + 填寫者本人與那一筆的組織
  const expressionContext = useMemo(() => {
    if (shown === null) {
      return null;
    }
    return shown.ctx === null || shown.ctx === undefined
      ? liveContextOf(shown.createdBy?.id ?? null, shown.orgId, now)
      : revisionContextOf(shown.ctx);
  }, [shown, now]);
  const permissions = useMemo(
    () => (shown === null ? null : permissionsOfSubmission(shown)),
    [shown],
  );
  const version = useFormRuntimeVersion(
    base?.formKey ?? null,
    base?.version ?? null,
  );

  const download = async (field: FieldDef) => {
    setDownloadFailed(false);
    try {
      const payload = await useFormSubmissionAttachmentUrlQuery.fetcher(
        session.client,
        {
          id,
          fieldKey: field.key,
          ...(viewedRevision !== null && { revision: viewedRevision }),
        },
      )();
      window.open(
        payload.formSubmissionAttachmentUrl.url,
        "_blank",
        "noopener",
      );
    } catch {
      setDownloadFailed(true);
    }
  };

  if (current.isLoading || version.isLoading) {
    return <CircularProgress aria-label={t("loading")} />;
  }
  if (
    base === null ||
    shown === null ||
    version.definition === null ||
    expressionContext === null ||
    permissions === null
  ) {
    const code =
      current.error === null ? "NOT_FOUND" : formErrorOf(current.error).code;
    return <Alert severity="error">{tErrors(code)}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="body2" color="text.secondary">
          {t("formLine", {
            form: base.formName ?? base.formKey,
            version: base.version,
          })}
        </Typography>
        {base.status === FormSubmissionStatus.Draft ? (
          <Tag tone="warning" label={t("statusDraft")} />
        ) : (
          <Tag tone="success" label={t("statusCompleted")} />
        )}
        <Typography variant="body2" color="text.secondary">
          {t("createdBy", { name: base.createdBy?.name ?? "—" })}
        </Typography>
        {viewedRevision !== null && (
          <Tag
            tone="primary"
            label={t("viewingRevision", { revision: viewedRevision })}
          />
        )}
      </Stack>
      {downloadFailed && <Alert severity="error">{t("downloadFailed")}</Alert>}
      <FormRenderer
        version={version.definition}
        values={shown.values}
        mode="readonly"
        context={{ formKey: base.formKey, version: base.version }}
        expressionContext={expressionContext}
        permissions={permissions}
        displayValues={shown.displayValues}
        onDownload={(field) => {
          void download(field);
        }}
      />
      <RevisionHistory
        submission={base}
        definition={version.definition}
        viewedRevision={viewedRevision}
        onViewRevision={setViewedRevision}
      />
    </Stack>
  );
};
