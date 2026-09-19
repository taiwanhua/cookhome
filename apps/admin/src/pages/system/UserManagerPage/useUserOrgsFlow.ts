import { useState } from "react";

import { UserOrgRemovalPolicy, useSetUserOrgsMutation } from "@repo/graphql";

import { useSession } from "@/hooks/useSession";

import {
  type UserManagerErrorCode,
  userManagerErrorOf,
} from "./user-manager-error";
import type { SetUserOrgsResult, UserRow } from "./user-manager-types";

/** 兩段式流程:先勾組織,有移除才進確認彈窗。 */
export type OrgsFlow =
  | { stage: "picker"; user: UserRow }
  | {
      stage: "confirm";
      user: UserRow;
      orgIds: readonly string[];
      preview: SetUserOrgsResult;
    }
  | null;

/**
 * 所屬組織的增減(ADR-0003):勾完組織後,
 * 有移除 → 先 `setUserOrgs(dryRun: true)` 取得失去資格清單 → 確認彈窗選三檔 → 正式送出;
 * 沒有移除 → 直接送出(預設檔位,反正沒有東西會被解除)。
 */
export const useUserOrgsFlow = (onSaved: (userId: string) => void) => {
  const { session } = useSession();
  const [flow, setFlow] = useState<OrgsFlow>(null);
  const [errorCode, setErrorCode] = useState<UserManagerErrorCode | null>(null);

  const onError = (error: unknown) => {
    setErrorCode(userManagerErrorOf(error).code);
  };

  const dryRun = useSetUserOrgsMutation(session.client, {
    onSuccess: (data, variables) => {
      setFlow((current) =>
        current === null
          ? null
          : {
              stage: "confirm",
              user: current.user,
              orgIds: variables.input.orgIds,
              preview: data.setUserOrgs,
            },
      );
    },
    onError,
  });

  const submit = useSetUserOrgsMutation(session.client, {
    onSuccess: (_data, variables) => {
      setFlow(null);
      onSaved(variables.input.userId);
    },
    onError,
  });

  const open = (user: UserRow) => {
    setErrorCode(null);
    setFlow({ stage: "picker", user });
  };

  const close = () => {
    setFlow(null);
    setErrorCode(null);
  };

  /** 勾選完成:算出有沒有移除,決定走 dry-run 還是直接送出。 */
  const pick = (orgIds: string[]) => {
    if (flow?.stage !== "picker") {
      return;
    }
    setErrorCode(null);
    const hasRemoval = flow.user.orgs.some((org) => !orgIds.includes(org.id));
    if (hasRemoval) {
      dryRun.mutate({
        input: { userId: flow.user.id, orgIds, dryRun: true },
      });
      return;
    }
    submit.mutate({ input: { userId: flow.user.id, orgIds, dryRun: false } });
  };

  const confirm = (removalPolicy: UserOrgRemovalPolicy) => {
    if (flow?.stage !== "confirm") {
      return;
    }
    setErrorCode(null);
    submit.mutate({
      input: {
        userId: flow.user.id,
        orgIds: [...flow.orgIds],
        dryRun: false,
        removalPolicy,
      },
    });
  };

  return {
    flow,
    errorCode,
    isSubmitting: dryRun.isPending || submit.isPending,
    open,
    close,
    pick,
    confirm,
  };
};
