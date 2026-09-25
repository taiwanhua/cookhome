import { useState } from "react";
import { useTranslations } from "use-intl";

import type { FormDefinition } from "@repo/domain/form";
import type { FormSubmissionFieldsFragment } from "@repo/graphql";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import { RevisionDiff } from "./RevisionDiff";

export interface RevisionHistoryProps {
  submission: FormSubmissionFieldsFragment;
  definition: FormDefinition;
  /** 目前畫面上看的是哪個修訂(null = 目前) */
  viewedRevision: number | null;
  onViewRevision: (revision: number | null) => void;
}

/**
 * 修訂紀錄(Spec 6a §8 畫面 11):已完成的提交每改一次修訂號 +1,每個修訂都留完整快照。
 * 每列「修訂 N、誰、什麼時候」,可切換檢視那個修訂(唯讀渲染用它自己的 `ctx`),修訂 2 起可看與前一修訂的差異。
 */
export const RevisionHistory = ({
  submission,
  definition,
  viewedRevision,
  onViewRevision,
}: RevisionHistoryProps) => {
  const t = useTranslations("admin.formEngine.detail");
  const [diffRevision, setDiffRevision] = useState<number | null>(null);
  const revisions = submission.revisions.toSorted(
    (a, b) => b.revision - a.revision,
  );

  if (revisions.length === 0) {
    return null;
  }

  return (
    <Stack component="section" spacing={1} aria-label={t("revisions")}>
      <Typography variant="subtitle1" component="h2">
        {t("revisions")}
      </Typography>
      {revisions.map((entry) => {
        const isViewed =
          (viewedRevision ?? submission.revision) === entry.revision;
        return (
          <Stack key={entry.revision} spacing={1}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {t("revisionLine", {
                  revision: entry.revision,
                  user: entry.user?.name ?? "—",
                  at: new Date(entry.at).toLocaleString(),
                })}
              </Typography>
              {isViewed ? (
                <Tag tone="primary" label={t("viewing")} />
              ) : (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    onViewRevision(
                      entry.revision === submission.revision
                        ? null
                        : entry.revision,
                    );
                  }}
                >
                  {t("viewRevision", { revision: entry.revision })}
                </Button>
              )}
              {entry.revision > 1 && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setDiffRevision(
                      diffRevision === entry.revision ? null : entry.revision,
                    );
                  }}
                >
                  {t("showDiff", { revision: entry.revision })}
                </Button>
              )}
            </Stack>
            {diffRevision === entry.revision && (
              <RevisionDiff
                submissionId={submission.id}
                definition={definition}
                revision={entry.revision}
              />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
};
