import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  type FormFieldsFragment,
  type FormVersionFieldsFragment,
  FormVersionStatus,
  useCreateFormVersionDraftMutation,
  useFormVersionsQuery,
  useRetryPublishFormVersionMutation,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Table } from "@repo/ui/table";
import { Tag, type TagTone } from "@repo/ui/tag";

import { useDateTimeText } from "@/hooks/useDateTimeText";
import { useMutationFeedback } from "@/hooks/useMutationFeedback";
import { useSession } from "@/hooks/useSession";
import { definitionOf } from "@/lib/form-engine/definition";
import { formErrorOf } from "@/lib/form-engine/form-errors";
import { versionDiff } from "@/lib/form-engine/version-diff";

import { PublishDialog } from "./PublishDialog";
import { RetireDialog } from "./RetireDialog";
import { VersionDiffView } from "./VersionDiffView";

export interface VersionPanelProps {
  form: FormFieldsFragment;
  /** 寫入成功後(清單、單張、版本、草稿都要重查) */
  onChanged: () => void;
  /** 「檢視」已發布 / 已退役的版本:設計頁籤以唯讀設計器打開那一版 */
  onView: (version: number) => void;
}

const STATUS_TONE: Record<FormVersionStatus, TagTone> = {
  [FormVersionStatus.Draft]: "grey",
  [FormVersionStatus.Publishing]: "warning",
  [FormVersionStatus.Published]: "success",
  [FormVersionStatus.Retired]: "grey",
};

/**
 * 版本面板(Spec 6a §8 畫面 3):草稿 / 發布(含中斷重試)/ 退役目前版本、changelog、
 * 與上一版差異、以任一版本(已發布或已退役)為基底開新草稿、「檢視」任一已發布 / 已退役版本(唯讀設計器)。
 * 按鈕依 `form.abilities.canEdit`;
 * 發布中斷時只剩「重試發布」(api 在中斷期間擋開草稿 / 退役 / 再發布)。
 */
export const VersionPanel = ({
  form,
  onChanged,
  onView,
}: VersionPanelProps) => {
  const t = useTranslations("admin.forms.versions");
  const dateTimeText = useDateTimeText();
  const tErrors = useTranslations("admin.forms.errors");
  const { session } = useSession();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);
  const [diffOf, setDiffOf] = useState<number | null>(null);
  const versions = useFormVersionsQuery(session.client, { formKey: form.key });
  const items = versions.data?.formVersions.items ?? [];
  const draft = items.find((item) => item.status === FormVersionStatus.Draft);
  const canEdit = form.abilities.canEdit;
  const isLocked = form.publishInterrupted;

  const createDraft = useCreateFormVersionDraftMutation(
    session.client,
    useMutationFeedback({
      success: t("draftCreated"),
      error: (failure) => tErrors(formErrorOf(failure).code),
      onSuccess: onChanged,
    }),
  );
  const retry = useRetryPublishFormVersionMutation(
    session.client,
    useMutationFeedback({
      success: t("retried"),
      error: (failure) => tErrors(formErrorOf(failure).code),
      onSuccess: onChanged,
    }),
  );

  const previousOf = (item: FormVersionFieldsFragment) =>
    items
      .filter(
        (candidate) =>
          candidate.version !== null &&
          candidate.version !== undefined &&
          item.version !== null &&
          item.version !== undefined &&
          candidate.version < item.version,
      )
      .toSorted((a, b) => (b.version ?? 0) - (a.version ?? 0))
      .at(0);

  const renderActions = (item: FormVersionFieldsFragment) => {
    const isDraft = item.status === FormVersionStatus.Draft;
    const isCurrent =
      item.status === FormVersionStatus.Published &&
      item.version === form.currentVersion;
    const isBase =
      item.status === FormVersionStatus.Published ||
      item.status === FormVersionStatus.Retired;
    return (
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
        {isBase && item.version !== null && item.version !== undefined && (
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onView(item.version ?? 0);
            }}
          >
            {t("view", { version: item.version })}
          </Button>
        )}
        {canEdit && !isLocked && isDraft && (
          <Button
            size="small"
            onClick={() => {
              setIsPublishing(true);
            }}
          >
            {t("publish")}
          </Button>
        )}
        {canEdit && !isLocked && isCurrent && (
          <Button
            size="small"
            variant="text"
            color="error"
            onClick={() => {
              setIsRetiring(true);
            }}
          >
            {t("retire")}
          </Button>
        )}
        {canEdit && !isLocked && isBase && draft === undefined && (
          <Button
            size="small"
            variant="text"
            disabled={createDraft.isPending}
            onClick={() => {
              createDraft.mutate({
                input: { formKey: form.key, baseVersion: item.version },
              });
            }}
          >
            {t("baseOn", { version: item.version ?? 0 })}
          </Button>
        )}
        {!isDraft && previousOf(item) !== undefined && (
          <Button
            size="small"
            variant="text"
            onClick={() => {
              setDiffOf(
                diffOf === item.version ? null : (item.version ?? null),
              );
            }}
          >
            {t("diff")}
          </Button>
        )}
      </Stack>
    );
  };

  const diffTarget = items.find((item) => item.version === diffOf);
  const diffBase =
    diffTarget === undefined ? undefined : previousOf(diffTarget);

  return (
    <Stack spacing={2}>
      {isLocked && (
        <Alert
          severity="warning"
          action={
            canEdit && (
              <Button
                size="small"
                variant="text"
                disabled={retry.isPending}
                onClick={() => {
                  retry.mutate({ input: { formKey: form.key } });
                }}
              >
                {t("retry")}
              </Button>
            )
          }
        >
          {t("interrupted")}
        </Alert>
      )}
      {canEdit && !isLocked && draft === undefined && items.length === 0 && (
        <Stack direction="row">
          <Button
            variant="outlined"
            disabled={createDraft.isPending}
            onClick={() => {
              createDraft.mutate({ input: { formKey: form.key } });
            }}
          >
            {t("newDraft")}
          </Button>
        </Stack>
      )}
      <Table<FormVersionFieldsFragment>
        aria-label={t("tableAria")}
        size="small"
        rows={items}
        getRowKey={(item) => item.id}
        isLoading={versions.isLoading}
        emptyMessage={t("empty")}
        columns={[
          {
            key: "version",
            header: t("version"),
            render: (item) =>
              item.version === null || item.version === undefined
                ? t("draftLabel", { revision: item.draftRevision })
                : t("versionLabel", { version: item.version }),
          },
          {
            key: "status",
            header: t("status"),
            render: (item) => (
              <Tag
                tone={STATUS_TONE[item.status]}
                label={t(`statuses.${item.status}`)}
              />
            ),
          },
          {
            key: "changelog",
            header: t("changelog"),
            render: (item) => item.changelog ?? "—",
          },
          {
            key: "publishedAt",
            header: t("publishedAt"),
            render: (item) =>
              item.publishedAt === null || item.publishedAt === undefined
                ? "—"
                : t("publishedLine", {
                    at: dateTimeText(item.publishedAt),
                    user: item.publishedBy?.name ?? "—",
                  }),
          },
          { key: "actions", header: t("actions"), render: renderActions },
        ]}
      />
      {diffTarget !== undefined && diffBase !== undefined && (
        <VersionDiffView
          diff={versionDiff(
            definitionOf(diffBase).fields,
            definitionOf(diffTarget).fields,
          )}
        />
      )}
      {isPublishing && draft !== undefined && (
        <PublishDialog
          formKey={form.key}
          draftRevision={draft.draftRevision}
          onClose={() => {
            setIsPublishing(false);
          }}
          onPublished={() => {
            setIsPublishing(false);
            onChanged();
          }}
        />
      )}
      {isRetiring && (
        <RetireDialog
          formKey={form.key}
          onClose={() => {
            setIsRetiring(false);
          }}
          onRetired={() => {
            setIsRetiring(false);
            onChanged();
          }}
        />
      )}
    </Stack>
  );
};
