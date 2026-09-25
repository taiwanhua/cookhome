import { useQueryClient } from "@tanstack/react-query";

import {
  type FormSubmissionFieldsFragment,
  useFormSubmissionQuery,
  useFormSubmissionsQuery,
} from "@repo/graphql";

/**
 * 提交寫入後的快取維護(DATA-04 的兩步):先以回傳的那一筆寫回單筆查詢(回詳情頁不閃舊值),
 * 再失效各頁各篩選的清單與單筆。
 */
export const useFormSubmissionCache = () => {
  const queryClient = useQueryClient();
  return (submission: FormSubmissionFieldsFragment | null) => {
    if (submission !== null) {
      const itemKey = useFormSubmissionQuery.getKey({ id: submission.id });
      queryClient.setQueryData(itemKey, {
        formSubmission: { submission },
      });
      void queryClient.invalidateQueries({ queryKey: itemKey });
    }
    void queryClient.invalidateQueries({
      queryKey: useFormSubmissionsQuery
        .getKey({ input: { moduleKey: "" } })
        .slice(0, 1),
    });
  };
};
