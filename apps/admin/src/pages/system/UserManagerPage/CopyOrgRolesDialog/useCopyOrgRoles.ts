import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  CopyUserOrgRolesMode,
  type CopyUserOrgRolesMutation,
  type CopyUserOrgRolesMutationVariables,
  useCopyUserOrgRolesMutation,
} from "@repo/graphql";

import type { UserCandidate } from "@/components/UserPicker/useUserCandidates";
import { useMutationFeedback } from "@/hooks/useMutationFeedback";
import { useSession } from "@/hooks/useSession";

import {
  type UserManagerErrorCode,
  userManagerErrorOf,
} from "../user-manager-error";
import type { CopyUserOrgRolesResult, UserRow } from "../user-manager-types";

/** 預覽對應的是哪一組「目標 × 方式」;切換後舊的回應不算數(避免慢回來的覆蓋新的)。 */
const previewKeyOf = (targetId: string, mode: CopyUserOrgRolesMode) =>
  `${targetId}:${mode}`;

/** 有沒有任何一項會變(新增或移除);只有保留 = 不需變更。 */
export const hasCopyChanges = (result: CopyUserOrgRolesResult): boolean =>
  result.orgs.added.length +
    result.orgs.removed.length +
    result.roles.added.length +
    result.roles.removed.length >
  0;

/**
 * 複製組織與角色的流程:選目標或切方式 → `copyUserOrgRoles(dryRun: true)` 重新預覽 →
 * 確認 → `dryRun: false` 正式送出(api 端重算重驗)。
 * 預覽是「還沒完成的操作」,成功不跳提示、失敗照跳(同 `useUserOrgsFlow` 的試算)。
 */
export const useCopyOrgRoles = (
  source: UserRow,
  onCopied: (targetId: string) => void,
) => {
  const t = useTranslations("admin.userManager");
  const tErrors = useTranslations("admin.userManager.errors");
  const { session } = useSession();
  const [target, setTarget] = useState<UserCandidate | null>(null);
  const [mode, setMode] = useState<CopyUserOrgRolesMode>(
    CopyUserOrgRolesMode.Merge,
  );
  const [preview, setPreview] = useState<{
    key: string;
    result: CopyUserOrgRolesResult;
  } | null>(null);
  const [errorCode, setErrorCode] = useState<UserManagerErrorCode | null>(null);

  const onError = (error: unknown) => {
    setErrorCode(userManagerErrorOf(error).code);
  };
  const feedbackError = (error: unknown) =>
    tErrors(userManagerErrorOf(error).code);

  const previewMutation = useCopyUserOrgRolesMutation(
    session.client,
    useMutationFeedback<
      CopyUserOrgRolesMutation,
      CopyUserOrgRolesMutationVariables
    >({
      success: null,
      error: feedbackError,
      onSuccess: (data, variables) => {
        setPreview({
          key: previewKeyOf(variables.input.targetUserId, variables.input.mode),
          result: data.copyUserOrgRoles,
        });
      },
      onError,
    }),
  );

  const submitMutation = useCopyUserOrgRolesMutation(
    session.client,
    useMutationFeedback<
      CopyUserOrgRolesMutation,
      CopyUserOrgRolesMutationVariables
    >({
      success: t("feedback.copyOrgRolesSuccess", { name: target?.name ?? "" }),
      error: feedbackError,
      onSuccess: (data) => {
        onCopied(data.copyUserOrgRoles.user.id);
      },
      onError,
    }),
  );

  const requestPreview = (
    nextTarget: UserCandidate | null,
    nextMode: CopyUserOrgRolesMode,
  ) => {
    setErrorCode(null);
    if (nextTarget === null) {
      return;
    }
    previewMutation.mutate({
      input: {
        sourceUserId: source.id,
        targetUserId: nextTarget.id,
        mode: nextMode,
        dryRun: true,
      },
    });
  };

  const selectTarget = (user: UserCandidate | null) => {
    setTarget(user);
    requestPreview(user, mode);
  };

  const selectMode = (nextMode: CopyUserOrgRolesMode) => {
    setMode(nextMode);
    requestPreview(target, nextMode);
  };

  const currentPreview =
    target !== null && preview?.key === previewKeyOf(target.id, mode)
      ? preview.result
      : null;
  const isPreviewing = previewMutation.isPending;
  const canConfirm =
    currentPreview !== null &&
    !isPreviewing &&
    !submitMutation.isPending &&
    currentPreview.blockers.length === 0 &&
    hasCopyChanges(currentPreview);

  const confirm = () => {
    if (!canConfirm || target === null) {
      return;
    }
    setErrorCode(null);
    submitMutation.mutate({
      input: {
        sourceUserId: source.id,
        targetUserId: target.id,
        mode,
        dryRun: false,
      },
    });
  };

  return {
    target,
    mode,
    preview: currentPreview,
    isPreviewing,
    isSubmitting: submitMutation.isPending,
    canConfirm,
    errorCode,
    selectTarget,
    selectMode,
    confirm,
  };
};
