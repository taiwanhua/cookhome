import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { OrgsRepository } from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import { userError } from "./users-error";

/**
 * 使用者的組織 / 角色異動共用的兩組判斷:**角色可及範圍**(防越權,ADR-0003)與
 * **擁有者保護**(ADR-0009)。`setUserOrgs`、`assignUserRoles` 與複製組織與角色
 * (`copyUserOrgRoles`)都走這一份,不各寫一套。
 *
 * 每組都有「找出被擋的那些」(給試算列 `blockers`)與「擋下來」(給正式寫入)兩種出口,
 * 後者只是前者非空時丟錯 —— 同一個判斷,兩種用法。
 */
@Injectable()
export class UserGrantRulesService {
  constructor(
    private readonly orgs: OrgsRepository,
    private readonly relations: RelationService,
    private readonly ownerProtection: OwnerProtectionService,
  ) {}

  /**
   * 操作者可觸及的角色 = **擁有組織在管理範圍內**的那些(ADR-0003「擁有組織 = 角色的
   * 管轄邊界」、ADR-0005)。與角色頁的 `roles` / `grantRoleUsers` 同一條判準 ——
   * 兩套判準會讓同一個授予從角色頁做得到、從使用者頁做不到。
   *
   * 落實點與 `RoleScopeService.managedRoleFilter` 相同:凡查組織都經 `this.orgs`
   * (治理類 collection,過濾自動吃 `managedOrgIds`),再由組織反查 `org_role` ——
   * 本檔不自己比對任何組織集合。
   */
  async reachableRoleIds(
    operator: OperatorContext,
  ): Promise<ReadonlySet<string> | "all"> {
    if (operator.managedOrgIds === "all") {
      return "all";
    }
    const managedOrgs = await this.orgs.findMany(operator, {});
    if (managedOrgs.length === 0) {
      return new Set();
    }
    const links = await this.relations.listLinks("org_role", {
      firstIds: managedOrgs.map((org) => org._id),
    });
    return new Set(links.map((link) => String(link.secondId)));
  }

  /** 該使用者受擁有者保護、不可解除的角色授予;根組織操作者一律空集合(ADR-0009 的例外)。 */
  async protectedRoleIds(
    operator: OperatorContext,
    userId: Types.ObjectId,
  ): Promise<ReadonlySet<string>> {
    if (await this.ownerProtection.isRootOperator(operator)) {
      return new Set();
    }
    return this.ownerProtection.protectedRoleIdsOf(operator, userId);
  }

  /** 要移除的所屬組織裡,哪些是該使用者擁有的(擁有者不可被移出,ADR-0009);根組織操作者放行。 */
  async ownedOrgsAmong(
    operator: OperatorContext,
    userId: Types.ObjectId,
    removedOrgKeys: ReadonlySet<string>,
  ): Promise<Types.ObjectId[]> {
    if (removedOrgKeys.size === 0) {
      return [];
    }
    if (await this.ownerProtection.isRootOperator(operator)) {
      return [];
    }
    const ownedOrgIds = await this.ownerProtection.ownedOrgIdsOf(
      operator,
      userId,
    );
    return ownedOrgIds.filter((orgId) => removedOrgKeys.has(String(orgId)));
  }

  /** 要解除的授予裡,哪些是擁有者的「租戶管理員」授予(ADR-0009);根組織操作者放行。 */
  async protectedRolesAmong(
    operator: OperatorContext,
    userId: Types.ObjectId,
    revokedRoleIds: readonly Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    if (revokedRoleIds.length === 0) {
      return [];
    }
    const protectedIds = await this.protectedRoleIds(operator, userId);
    return revokedRoleIds.filter((roleId) => protectedIds.has(String(roleId)));
  }

  /** 擁有者不可被移出自己擁有的組織(ADR-0009);根組織操作者放行。 */
  async assertOwnedOrgsKept(
    operator: OperatorContext,
    userId: Types.ObjectId,
    removedOrgKeys: ReadonlySet<string>,
  ): Promise<void> {
    const [blocked] = await this.ownedOrgsAmong(
      operator,
      userId,
      removedOrgKeys,
    );
    if (blocked) {
      throw userError(
        "OWNER_PROTECTED",
        `User ${String(userId)} owns org ${String(blocked)} and cannot be removed from it outside the root org`,
      );
    }
  }

  /** 擁有者的「租戶管理員」授予不可解除(ADR-0009);根組織操作者放行。 */
  async assertProtectedRolesKept(
    operator: OperatorContext,
    userId: Types.ObjectId,
    revokedRoleIds: readonly Types.ObjectId[],
  ): Promise<void> {
    const [blocked] = await this.protectedRolesAmong(
      operator,
      userId,
      revokedRoleIds,
    );
    if (blocked) {
      throw userError(
        "OWNER_PROTECTED",
        `Role ${String(blocked)} is the tenant owner's tenant-admin grant and cannot be revoked outside the root org`,
      );
    }
  }
}
