import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { type OrgDocument, OrgsRepository } from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { RelationService } from "../database/relation.service";

/** 租戶頂層 `orgs.settings.visibility` 的值(ADR-0005;未設視為 "own")。 */
const VISIBILITY_SUBTREE = "subtree";

/**
 * 登入線自己讀組織樹時用的上下文:計算可見範圍的當下還沒有可見範圍可用,
 * 這是唯一合法以 "all" 讀 orgs 的地方(此服務即可見範圍的計算明文;資料層只消費結果)。
 */
function systemOperator(actorId: Types.ObjectId): OperatorContext {
  return { actorId, currentOrgId: null, visibleOrgIds: "all" };
}

export interface MemberOrg {
  id: Types.ObjectId;
  name: string;
  parentId: Types.ObjectId | null;
}

export interface OperatorResolution {
  operator: OperatorContext;
  /** 所屬組織清單,依加入時間(org_user 建立時間)排序。 */
  memberOrgs: MemberOrg[];
}

/**
 * 由 userId 算出操作者上下文(CONTEXT.md:操作者 / 當前組織 / 可見範圍;規則 ADR-0005):
 * - 所屬組織 = org_user(RelationService)
 * - 根組織成員 → 可見範圍 "all"
 * - 其餘 = 所屬組織聯集;所屬組織的租戶頂層 `settings.visibility` 為 "subtree" 時各自含其整棵下層
 */
@Injectable()
export class OperatorContextService {
  constructor(
    private readonly relations: RelationService,
    private readonly orgs: OrgsRepository,
  ) {}

  async resolve(
    userId: Types.ObjectId,
    currentOrgId: Types.ObjectId | null,
  ): Promise<OperatorResolution> {
    const reader = systemOperator(userId);
    const memberships = await this.relations.listOrgMembershipsOfUser(userId);
    const memberOrgIds = memberships.map((membership) => membership.orgId);
    const memberDocuments = await this.orgs.findMany(reader, {
      _id: { $in: memberOrgIds },
    });
    const byId = new Map(memberDocuments.map((org) => [String(org._id), org]));
    // 依加入時間排序(RelationService 已排序),只留仍存在的組織
    const memberOrgDocuments = memberOrgIds
      .map((id) => byId.get(String(id)))
      .filter(
        (org): org is (typeof memberDocuments)[number] => org !== undefined,
      );

    const memberOrgs = memberOrgDocuments.map((org) => ({
      id: org._id,
      name: org.name,
      parentId: org.parentId,
    }));
    const resolvedCurrentOrgId =
      currentOrgId && memberOrgs.some((org) => org.id.equals(currentOrgId))
        ? currentOrgId
        : (memberOrgs[0]?.id ?? null);

    const visibleOrgIds = await this.visibleOrgIdsOf(
      reader,
      memberOrgDocuments,
    );
    return {
      operator: {
        actorId: userId,
        currentOrgId: resolvedCurrentOrgId,
        visibleOrgIds,
      },
      memberOrgs,
    };
  }

  private async visibleOrgIdsOf(
    reader: OperatorContext,
    memberOrgs: OrgDocument[],
  ): Promise<Types.ObjectId[] | "all"> {
    if (memberOrgs.some((org) => org.parentId === null)) {
      return "all";
    }
    const visible = new Map<string, Types.ObjectId>();
    for (const org of memberOrgs) {
      visible.set(String(org._id), org._id);
      if (await this.isSubtreeVisible(reader, org)) {
        const descendants = await this.orgs.findMany(reader, {
          ancestors: org._id,
        });
        for (const descendant of descendants) {
          visible.set(String(descendant._id), descendant._id);
        }
      }
    }
    return [...visible.values()];
  }

  /** 開關只看租戶頂層(ancestors = [根, 租戶頂層, …];所屬組織本身是租戶頂層時 ancestors 只有根)。 */
  private async isSubtreeVisible(
    reader: OperatorContext,
    org: OrgDocument,
  ): Promise<boolean> {
    const tenantTopId = org.ancestors[1] ?? org._id;
    const tenantTop = tenantTopId.equals(org._id)
      ? org
      : await this.orgs.findById(reader, tenantTopId);
    return tenantTop?.settings.visibility === VISIBILITY_SUBTREE;
  }
}
