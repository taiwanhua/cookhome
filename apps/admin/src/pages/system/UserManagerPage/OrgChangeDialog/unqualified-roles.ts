import { RoleUnqualifiedReason, UserOrgRemovalPolicy } from "@repo/graphql";

import type { SetUserOrgsResult } from "../user-manager-types";

export type UnqualifiedRole = SetUserOrgsResult["unqualifiedRoles"][number];

/**
 * 某一檔會解除哪些授予(ADR-0003;與 api 的 `removalPolicy` 同一份判斷,
 * 這裡只是把 dry-run 已經算好的清單依檔位過濾,給使用者在送出前看見後果):
 * - `KEEP_ALL` 不解除任何一筆
 * - `REVOKE_OWNED_BY_ORG` 只解除「由被移除組織擁有」的
 * - `REVOKE_ALL_UNQUALIFIED` 解除全部失去資格的
 *
 * 受擁有者保護的授予(`ownerProtected`)一律不會被解除,三檔皆同(ADR-0009)。
 */
export const revokedByPolicy = (
  roles: readonly UnqualifiedRole[],
  policy: UserOrgRemovalPolicy,
): UnqualifiedRole[] => {
  if (policy === UserOrgRemovalPolicy.KeepAll) {
    return [];
  }
  const revocable = roles.filter((role) => !role.ownerProtected);
  if (policy === UserOrgRemovalPolicy.RevokeOwnedByOrg) {
    return revocable.filter((role) =>
      role.reasons.includes(RoleUnqualifiedReason.OwnedByRemovedOrg),
    );
  }
  return revocable;
};
