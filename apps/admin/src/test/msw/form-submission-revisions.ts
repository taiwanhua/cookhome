import type { FormSubmissionFieldsFragment } from "@repo/graphql";

import type { MockRevisionMeta, MockSubmission } from "./form-fixtures";

/** 對外只回 fragment 的欄位(修訂紀錄由 `FormSubmissionRevisions` 另查,與 api 的 field resolver 一致)。 */
export const fragmentOf = (
  submission: MockSubmission,
): FormSubmissionFieldsFragment => {
  const fragment: MockSubmission = { ...submission };
  delete fragment.revisions;
  return fragment;
};

/** 修訂紀錄:給了照給(補版本與來由);沒給 = 修訂 1..`revision`,都綁提交的版本、建立者、同一時間。 */
export const revisionsOf = (submission: MockSubmission) =>
  (
    submission.revisions ??
    Array.from(
      { length: submission.revision },
      (_, index): MockRevisionMeta => ({
        revision: index + 1,
        at: submission.submittedAt ?? submission.createdAt,
        user: submission.createdBy ?? null,
      }),
    )
  ).map((entry) => ({
    ...entry,
    version: entry.version ?? submission.version,
    kind: entry.kind ?? null,
    upgradedBy: entry.upgradedBy ?? null,
    upgradedAt: entry.upgradedAt ?? null,
  }));
