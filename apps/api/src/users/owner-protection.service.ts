import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { OrgsRepository, RolesRepository } from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { userError } from "./users-error";

/**
 * 種子「租戶管理員」模板的 key(正本 `apps/db-migrator/seeds/roles.ts`)。
 * 開通租戶時複製到租戶名下的副本另有自己的 `_id`、沒有 `key`(key 全庫唯一),
 * 因此副本以 `settings.templateKey` 標記自己複製自哪個模板 —
 * **#134 的 `provisionTenant` 建副本時要寫入這個標記**,擁有者保護才認得出那一筆授予。
 */
const TENANT_ADMIN_ROLE_KEY = "tenant-admin";

/** 受保護的三個動作(只影響錯誤訊息,便於除錯)。 */
export type OwnerProtectedAction =
  "disable" | "remove-from-org" | "revoke-tenant-admin";

/**
 * 擁有者保護與根組織例外都不該受可見範圍左右:
 * 租戶頂層可能不在操作者可見範圍內(可見性為 "own" 的下層組織管理員),
 * 這時若查不到擁有者就等於保護失效 — 安全檢查要 fail-closed,所以以 "all" 讀,
 * 且只取 `ownerUserId` / `parentId` 這類判斷用欄位,不把組織內容交給呼叫端。
 */
function protectionReader(operator: OperatorContext): OperatorContext {
  return {
    actorId: operator.actorId,
    currentOrgId: operator.currentOrgId,
    visibleOrgIds: "all",
  };
}

/**
 * 擁有者保護(ADR-0009):租戶擁有者不可被停用、不可被移出租戶、
 * 其「租戶管理員」授予不可被解除;**根組織的操作者可執行**(處理擁有者失聯等例外)。
 *
 * 暫置於 `users/`:#135(組織線5,租戶作業)尚未做,轉移擁有者 / 開通租戶也要同一套判斷,
 * 屆時把本服務整個抽成共用(見 PR #136 的「決定事項」)。
 */
@Injectable()
export class OwnerProtectionService {
  constructor(
    private readonly orgs: OrgsRepository,
    private readonly roles: RolesRepository,
    private readonly relations: RelationService,
  ) {}

  /** 操作者的當前組織是不是根組織(`parentId === null`)。 */
  async isRootOperator(operator: OperatorContext): Promise<boolean> {
    if (!operator.currentOrgId) {
      return false;
    }
    const currentOrg = await this.orgs.findById(
      protectionReader(operator),
      operator.currentOrgId,
    );
    return currentOrg?.parentId === null;
  }

  /** 該使用者是哪些組織的擁有者(`orgs.ownerUserId`);不是擁有者即空陣列。 */
  async ownedOrgIdsOf(
    operator: OperatorContext,
    targetUserId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const owned = await this.orgs.findMany(protectionReader(operator), {
      ownerUserId: targetUserId,
    });
    return owned.map((org) => org._id);
  }

  /**
   * 擁有者的「租戶管理員」授予(不可解除的那幾筆):
   * 角色的擁有組織 = 該使用者擁有的組織,且該角色是租戶管理員模板或其副本。
   */
  async protectedRoleIdsOf(
    operator: OperatorContext,
    targetUserId: Types.ObjectId,
  ): Promise<Set<string>> {
    const ownedOrgIds = await this.ownedOrgIdsOf(operator, targetUserId);
    if (ownedOrgIds.length === 0) {
      return new Set();
    }
    const ownedOrgKeys = new Set(ownedOrgIds.map(String));
    const grantedRoleIds = await this.relations.listRoleIdsOfUser(targetUserId);
    const ownerLinks = await this.relations.listLinks("org_role", {
      secondIds: grantedRoleIds,
    });
    const candidateIds = ownerLinks
      .filter((link) => ownedOrgKeys.has(String(link.firstId)))
      .map((link) => link.secondId);
    if (candidateIds.length === 0) {
      return new Set();
    }
    const candidates = await this.roles.findMany(protectionReader(operator), {
      _id: { $in: candidateIds },
    });
    return new Set(
      candidates
        .filter((role) => isTenantAdminRole(role.key, role.settings))
        .map((role) => String(role._id)),
    );
  }

  /**
   * 「這個使用者受擁有者保護嗎」的單一判斷點(停用 / 移出租戶皆用它)。
   * 根組織的操作者放行;其餘只要目標是任一組織的擁有者即拒。
   */
  async assertNotProtectedOwner(
    operator: OperatorContext,
    targetUser: { _id: Types.ObjectId },
    action: OwnerProtectedAction = "disable",
  ): Promise<void> {
    if (await this.isRootOperator(operator)) {
      return;
    }
    const ownedOrgIds = await this.ownedOrgIdsOf(operator, targetUser._id);
    if (ownedOrgIds.length > 0) {
      throw userError(
        "OWNER_PROTECTED",
        `User ${String(targetUser._id)} owns a tenant org; ${action} is only allowed from the root org`,
      );
    }
  }
}

/** 租戶管理員模板本身(有 key),或開通時複製出來、以 `settings.templateKey` 標記的副本。 */
function isTenantAdminRole(
  key: string | undefined,
  settings: Record<string, unknown>,
): boolean {
  return (
    key === TENANT_ADMIN_ROLE_KEY ||
    settings.templateKey === TENANT_ADMIN_ROLE_KEY
  );
}
