import { CopyUserOrgRolesMode } from "./models/copy-user-org-roles.model";

/** 一組 id(組織或角色)在複製前後的差異;id 一律是字串,以字串比對去重。 */
export interface CopySetPlan {
  /** 要新增的:來源有、目標沒有 */
  added: string[];
  /** 要移除的:只有取代才有 —— 目標在管理範圍內、來源沒有的 */
  removed: string[];
  /** 管理範圍內、複製後仍留著的(畫面只列這些;範圍外的不動也不列) */
  kept: string[];
  /** 複製後的完整集合(含管理範圍外的) */
  final: string[];
}

/**
 * 複製使用者的組織與角色的集合運算(`docs/modules/user-manager.md`「複製組織與角色」)。
 * 組織與角色同一套:T = 目標現有的、M = 操作者管理範圍內的(`isManaged`)、
 * S = 來源的 ∩ M(呼叫端先濾好,範圍外的來源不授予)。
 *
 * - 合併:`final = T ∪ S`
 * - 取代:`final = (T − M) ∪ S` —— 範圍外的目標不因取代而被解除(權限邊界,不是選項);
 *   管理範圍是全部時 `T − M` 為空,取代即完全取代。
 */
export function planCopySet(
  mode: CopyUserOrgRolesMode,
  target: readonly string[],
  source: readonly string[],
  isManaged: (id: string) => boolean,
): CopySetPlan {
  const targetIds = [...new Set(target)];
  const sourceIds = [...new Set(source)];
  const targetKeys = new Set(targetIds);
  const sourceKeys = new Set(sourceIds);

  const added = sourceIds.filter((id) => !targetKeys.has(id));
  const removed =
    mode === CopyUserOrgRolesMode.REPLACE
      ? targetIds.filter((id) => isManaged(id) && !sourceKeys.has(id))
      : [];
  const removedKeys = new Set(removed);
  const remaining = targetIds.filter((id) => !removedKeys.has(id));
  return {
    added,
    removed,
    kept: remaining.filter((id) => isManaged(id)),
    final: [...remaining, ...added],
  };
}
