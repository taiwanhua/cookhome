import { useTranslations } from "use-intl";

import type { FormDefinition } from "@repo/domain/form";
import { useFormSubmissionQuery } from "@repo/graphql";
import { CircularProgress } from "@repo/ui/circular-progress";
import { Table } from "@repo/ui/table";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";
import {
  type RevisionChange,
  revisionChanges,
} from "@/lib/form-engine/revision-diff";

import { FormValue } from "../FormValue";

export interface RevisionDiffProps {
  submissionId: string;
  definition: FormDefinition;
  /** 看這個修訂相對於前一個修訂的差異(≥ 2) */
  revision: number;
}

/**
 * 修訂差異(Spec 6a §4 `revisions[]`:每個修訂存完整快照,差異在讀取時由相鄰兩筆算)。
 * 兩個快照都走 `formSubmission(id, revision)`,所以受保護欄位的投影照讀者現在的權限套 —— 看不到的欄位兩邊
 * 都是 `"[redacted]"`,不會以「有變動」的形式側漏。
 */
export const RevisionDiff = ({
  submissionId,
  definition,
  revision,
}: RevisionDiffProps) => {
  const t = useTranslations("admin.formEngine.detail");
  const tValue = useTranslations("admin.formEngine.renderer");
  const { session } = useSession();
  const previous = useFormSubmissionQuery(session.client, {
    id: submissionId,
    revision: revision - 1,
  });
  const current = useFormSubmissionQuery(session.client, {
    id: submissionId,
    revision,
  });
  const before = previous.data?.formSubmission.submission;
  const after = current.data?.formSubmission.submission;

  if (before === undefined || after === undefined) {
    return <CircularProgress size={20} aria-label={t("loadingDiff")} />;
  }

  const changes = revisionChanges(
    definition.fields,
    before.values,
    after.values,
  );
  const text = {
    empty: tValue("empty"),
    yes: tValue("yes"),
    no: tValue("no"),
    unavailable: tValue("sourceUnavailable"),
  };
  const displayOf = (source: typeof before, fieldKey: string) =>
    source.displayValues.find((entry) => entry.fieldKey === fieldKey)?.items ??
    [];

  if (changes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("noChanges")}
      </Typography>
    );
  }

  return (
    <Table<RevisionChange>
      aria-label={t("diffAria", { revision })}
      size="small"
      rows={changes}
      getRowKey={(change) => change.field.key}
      columns={[
        {
          key: "field",
          header: t("diffField"),
          render: (change) => change.field.label,
        },
        {
          key: "before",
          header: t("diffBefore", { revision: revision - 1 }),
          render: (change) => (
            <FormValue
              field={change.field}
              value={change.before}
              display={displayOf(before, change.field.key)}
              text={text}
            />
          ),
        },
        {
          key: "after",
          header: t("diffAfter", { revision }),
          render: (change) => (
            <FormValue
              field={change.field}
              value={change.after}
              display={displayOf(after, change.field.key)}
              text={text}
            />
          ),
        },
      ]}
    />
  );
};
