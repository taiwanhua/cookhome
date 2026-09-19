import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { OrgsRepository } from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";

/**
 * 判定「角色授予資格」時讀組織用的上下文,**刻意不套任何範圍**(可見範圍與管理範圍都放到全部):
 * ADR-0005 明定「可見性開關不影響被授予角色的資格 — 資格恆以擁有組織子樹判定(ADR-0003)」,
 * 若拿操作者的可見範圍去算,看不到的所屬組織會被誤判成「失去支撐」而誤解角色。
 * 讀出來的只有 `_id` / `ancestors`(樹的形狀),不外流組織名稱等內容 —
 * 對外顯示的名稱一律另以操作者上下文查(見 UsersService 的 `visibleOrgsOf`)。
 */
function ancestryReader(operator: OperatorContext): OperatorContext {
  return {
    actorId: operator.actorId,
    currentOrgId: operator.currentOrgId,
    visibleOrgIds: "all",
    managedOrgIds: "all",
  };
}

/** 一棵組織樹的形狀快照:組織 id → 它的祖先 id(物化路徑,ADR-0005)。 */
export type OrgAncestry = ReadonlyMap<string, string[]>;

/**
 * 「被授予角色的資格」(ADR-0003):使用者的所屬組織中,至少一個落在該角色擁有組織的子樹內。
 * 三個地方用同一份判斷 — 清單的「組織外」標記、移除所屬組織的 dry-run、授予角色當下的檢查。
 */
@Injectable()
export class OrgQualificationService {
  constructor(private readonly orgs: OrgsRepository) {}

  /** 載入這些組織的祖先路徑(判定子樹歸屬的原料)。 */
  async loadAncestry(
    operator: OperatorContext,
    orgIds: Types.ObjectId[],
  ): Promise<OrgAncestry> {
    if (orgIds.length === 0) {
      return new Map();
    }
    const documents = await this.orgs.findMany(ancestryReader(operator), {
      _id: { $in: orgIds },
    });
    return new Map(
      documents.map((org) => [String(org._id), org.ancestors.map(String)]),
    );
  }

  /** 組織是否落在 `rootId` 的子樹內(含自己);樹形狀取自 `loadAncestry`。 */
  isInSubtree(orgId: string, rootId: string, ancestry: OrgAncestry): boolean {
    return orgId === rootId || (ancestry.get(orgId)?.includes(rootId) ?? false);
  }

  /** 有資格 = 所屬組織任一落在擁有組織的子樹內;沒有擁有組織的角色一律視為無資格。 */
  qualifies(
    memberOrgIds: readonly string[],
    ownerOrgId: string | null,
    ancestry: OrgAncestry,
  ): boolean {
    if (ownerOrgId === null) {
      return false;
    }
    return memberOrgIds.some((orgId) =>
      this.isInSubtree(orgId, ownerOrgId, ancestry),
    );
  }
}
