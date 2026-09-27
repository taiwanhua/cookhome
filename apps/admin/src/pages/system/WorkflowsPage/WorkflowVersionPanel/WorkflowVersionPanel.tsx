import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  type WorkflowFieldsFragment,
  type WorkflowVersionFieldsFragment,
  WorkflowVersionStatus,
  useCreateWorkflowVersionDraftMutation,
  useRetryPublishWorkflowVersionMutation,
  useWorkflowVersionsQuery,
} from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Table } from "@repo/ui/table";
import { Tag, type TagTone } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { useDateTimeText } from "@/hooks/useDateTimeText";
import { useMutationFeedback } from "@/hooks/useMutationFeedback";
import { useSession } from "@/hooks/useSession";
import { definitionOf } from "@/lib/workflow/definition";
import { workflowVersionDiff } from "@/lib/workflow/version-diff";
import { workflowErrorOf } from "@/lib/workflow/workflow-errors";

import { PublishWorkflowDialog } from "./PublishWorkflowDialog";
import { RetireWorkflowDialog } from "./RetireWorkflowDialog";

export interface WorkflowVersionPanelProps {
  workflow: WorkflowFieldsFragment;
  onChanged: () => void;
}

const STATUS_TONE: Record<WorkflowVersionStatus, TagTone> = {
  [WorkflowVersionStatus.Draft]: "grey",
  [WorkflowVersionStatus.Publishing]: "warning",
  [WorkflowVersionStatus.Published]: "success",
  [WorkflowVersionStatus.Retired]: "grey",
};

type VersionRow = WorkflowVersionFieldsFragment;

/**
 * 版本面板(Spec 6b §8 畫面 4,同表單版本面板):草稿 / 發布(含中斷重試)/ 退役目前版本、changelog、
 * 與上一版差異、以任一版本(已發布或已退役)為基底開新草稿。發布看 `abilities.canPublish`、
 * 開草稿看 `abilities.canEdit`;發布中斷時只剩「重試發布」。
 */
export const WorkflowVersionPanel = ({
  workflow,
  onChanged,
}: WorkflowVersionPanelProps) => {
  const t = useTranslations("admin.workflows.versions");
  const tErrors = useTranslations("admin.workflows.errors");
  const dateTimeText = useDateTimeText();
  const { session } = useSession();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);
  const [diffOf, setDiffOf] = useState<number | null>(null);
  const versions = useWorkflowVersionsQuery(session.client, {
    workflowKey: workflow.key,
  });
  const items = versions.data?.workflowVersions.items ?? [];
  const draft = items.find(
    (item) => item.status === WorkflowVersionStatus.Draft,
  );
  const { canEdit, canPublish } = workflow.abilities;
  const isLocked = workflow.publishInterrupted;

  const createDraft = useCreateWorkflowVersionDraftMutation(
    session.client,
    useMutationFeedback({
      success: t("draftCreated"),
      error: (failure) => tErrors(workflowErrorOf(failure).code),
      onSuccess: onChanged,
    }),
  );
  const retry = useRetryPublishWorkflowVersionMutation(
    session.client,
    useMutationFeedback({
      success: t("retried"),
      error: (failure) => tErrors(workflowErrorOf(failure).code),
      onSuccess: onChanged,
    }),
  );

  const previousOf = (item: VersionRow): VersionRow | undefined =>
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

  const renderActions = (item: VersionRow) => {
    const isDraft = item.status === WorkflowVersionStatus.Draft;
    const isCurrent =
      item.status === WorkflowVersionStatus.Published &&
      item.version === workflow.currentVersion;
    const isBase =
      item.status === WorkflowVersionStatus.Published ||
      item.status === WorkflowVersionStatus.Retired;
    return (
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
        {canPublish && !isLocked && isDraft && (
          <Button
            size="small"
            onClick={() => {
              setIsPublishing(true);
            }}
          >
            {t("publish")}
          </Button>
        )}
        {canPublish && !isLocked && isCurrent && (
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
                input: { workflowKey: workflow.key, baseVersion: item.version },
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
  const diff =
    diffTarget === undefined || diffBase === undefined
      ? null
      : workflowVersionDiff(definitionOf(diffBase), definitionOf(diffTarget));

  return (
    <Stack spacing={2}>
      {isLocked && (
        <Alert
          severity="warning"
          action={
            canPublish && (
              <Button
                size="small"
                variant="text"
                disabled={retry.isPending}
                onClick={() => {
                  retry.mutate({ input: { workflowKey: workflow.key } });
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
      <Table<VersionRow>
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
      {diff !== null && (
        <Stack spacing={0.5} component="section" aria-label={t("diffRegion")}>
          <Typography variant="subtitle2">{t("diffTitle")}</Typography>
          <Typography variant="body2">
            {t("diffAdded", { steps: diff.added.join("、") || "—" })}
          </Typography>
          <Typography variant="body2">
            {t("diffRemoved", { steps: diff.removed.join("、") || "—" })}
          </Typography>
          <Typography variant="body2">
            {t("diffChanged", { steps: diff.changed.join("、") || "—" })}
          </Typography>
          {diff.isStructureChanged && (
            <Typography variant="body2">{t("diffStructure")}</Typography>
          )}
        </Stack>
      )}
      {isPublishing && draft !== undefined && (
        <PublishWorkflowDialog
          workflowKey={workflow.key}
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
        <RetireWorkflowDialog
          workflowKey={workflow.key}
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
