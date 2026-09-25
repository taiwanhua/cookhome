import { useState } from "react";

import type { StoredValues } from "@repo/domain/form";
import {
  type FormSubmissionFieldsFragment,
  FormSubmissionStatus,
  useDeleteFormSubmissionMutation,
  useFormSubmissionQuery,
  useSaveFormDraftMutation,
  useSubmitFormSubmissionMutation,
  useUpdateFormSubmissionMutation,
} from "@repo/graphql";

import { type FormError, formErrorOf } from "@/lib/form-engine/form-errors";

import { useFormSubmissionCache } from "./useFormSubmissionCache";
import { useSession } from "./useSession";

export interface FormSubmissionState {
  submission: FormSubmissionFieldsFragment | null;
  isLoading: boolean;
  loadError: FormError | null;
  /** 草稿:存草稿;已完成:儲存修改(修訂 +1,帶 `expectedRevision`) */
  save: (values: StoredValues) => Promise<FormSubmissionFieldsFragment | null>;
  /** 草稿:存 + 送出(一顆鈕) */
  submit: (
    values: StoredValues,
  ) => Promise<FormSubmissionFieldsFragment | null>;
  remove: () => Promise<boolean>;
  isPending: boolean;
  error: FormError | null;
}

/**
 * 讀 / 寫一筆既有的提交(Spec 6a §6、docs/modules/forms.md「api 介面」)。
 * `revision` 省略 = 目前;給了就是讀那個修訂的快照(唯讀,修訂差異用)。
 *
 * 每次寫入帶 `expectedEditVersion`(= 讀到的 `editVersion`),已完成修改另帶 `expectedRevision`;
 * 不符 → `CONFLICT`,由頁面提示「這筆資料已被別人更新,請重新載入」。
 */
export const useFormSubmission = (
  id: string,
  revision: number | null = null,
): FormSubmissionState => {
  const { session } = useSession();
  const updateCache = useFormSubmissionCache();
  const [error, setError] = useState<FormError | null>(null);
  const [isPending, setIsPending] = useState(false);

  const query = useFormSubmissionQuery(
    session.client,
    { id, ...(revision !== null && { revision }) },
    { enabled: id !== "", retry: false },
  );
  const submission = query.data?.formSubmission.submission ?? null;

  const saveDraft = useSaveFormDraftMutation(session.client);
  const submitDraft = useSubmitFormSubmissionMutation(session.client);
  const update = useUpdateFormSubmissionMutation(session.client);
  const deleteMutation = useDeleteFormSubmissionMutation(session.client);

  const wrap = async <T>(action: () => Promise<T>): Promise<T | null> => {
    setIsPending(true);
    setError(null);
    try {
      return await action();
    } catch (error_) {
      setError(formErrorOf(error_));
      return null;
    } finally {
      setIsPending(false);
    }
  };

  const saveAsDraft = async (
    current: FormSubmissionFieldsFragment,
    values: StoredValues,
  ): Promise<FormSubmissionFieldsFragment> => {
    const payload = await saveDraft.mutateAsync({
      input: {
        id: current.id,
        expectedEditVersion: current.editVersion,
        values,
      },
    });
    return payload.saveFormDraft.submission;
  };

  const saveCompleted = async (
    current: FormSubmissionFieldsFragment,
    values: StoredValues,
  ): Promise<FormSubmissionFieldsFragment> => {
    const payload = await update.mutateAsync({
      input: {
        id: current.id,
        expectedEditVersion: current.editVersion,
        expectedRevision: current.revision,
        values,
      },
    });
    return payload.updateFormSubmission.submission;
  };

  const save = (values: StoredValues) =>
    wrap(async () => {
      if (submission === null) {
        return null;
      }
      const next =
        submission.status === FormSubmissionStatus.Draft
          ? await saveAsDraft(submission, values)
          : await saveCompleted(submission, values);
      updateCache(next);
      return next;
    });

  const submit = (values: StoredValues) =>
    wrap(async () => {
      if (submission === null) {
        return null;
      }
      const saved = await saveAsDraft(submission, values);
      const payload = await submitDraft.mutateAsync({
        input: { id: saved.id, expectedEditVersion: saved.editVersion },
      });
      const submitted = payload.submitFormSubmission.submission;
      updateCache(submitted);
      return submitted;
    });

  const remove = async (): Promise<boolean> =>
    (await wrap(async () => {
      await deleteMutation.mutateAsync({ input: { id } });
      updateCache(null);
      return true;
    })) ?? false;

  return {
    submission,
    isLoading: query.isLoading,
    loadError: query.error === null ? null : formErrorOf(query.error),
    save,
    submit,
    remove,
    isPending,
    error,
  };
};
