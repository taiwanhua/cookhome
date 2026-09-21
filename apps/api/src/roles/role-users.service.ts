import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import type { Persisted } from "../database/base.repository";
import {
  OrgsRepository,
  type UserDocument,
  UsersRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import { OrgQualificationService } from "../users/org-qualification.service";
import type { GrantRoleUsersInput } from "./dto/grant-role-users.input";
import type { RevokeRoleUsersInput } from "./dto/revoke-role-users.input";
import type { RoleUsersInput } from "./dto/role-users.input";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./dto/roles.input";
import type {
  RoleUser,
  RoleUserOrg,
  RoleUsersPayload,
} from "./models/role-payloads.model";
import {
  type RoleRecord,
  RoleScopeService,
  toObjectId,
  uniqueIds,
  uniqueObjectIds,
} from "./role-scope.service";
import { notFoundError, roleError } from "./roles-error";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPE } from "./roles.service";

type UserRecord = Persisted<UserDocument>;

/**
 * 分配使用者頁籤(`system.role-manager.assign-users`)。
 *
 * 三條規則,都不是本模組自創的:
 * - **候選**(ADR-0003「被授予角色的資格」):使用者的所屬組織至少一個落在角色擁有組織的子樹內;
 *   判斷共用 `OrgQualificationService`(使用者管理的「組織外」標記、移除所屬組織的 dry-run
 *   用的是同一支),不在此另寫一份
 * - **組織外**(ADR-0003):失去子樹支撐的授予照常有效,只標記不解除
 * - **擁有者保護**(ADR-0009):租戶擁有者的「租戶管理員」授予不可解除,根組織操作者例外;
 *   判斷共用 `OwnerProtectionService`
 *
 * 清單不套管理範圍:角色本身已經在操作者的管理範圍內(`RoleScopeService`),
 * 而持有者可能因為被移出組織而落在範圍外(ADR-0003「組織外」)— 列不出來就移不掉。
 * 使用者的**所屬組織名稱**仍只露管理範圍內的(`this.orgs` 是治理類,過濾自動生效)。
 */
@Injectable()
export class RoleUsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly orgs: OrgsRepository,
    private readonly relations: RelationService,
    private readonly audit: AuditService,
    private readonly scope: RoleScopeService,
    private readonly qualification: OrgQualificationService,
    private readonly ownerProtection: OwnerProtectionService,
  ) {}

  /** 被授予這個角色的使用者(分頁);每筆附「組織外」與擁有者保護標記。 */
  async list(
    operator: OperatorContext,
    roleId: string,
    input: RoleUsersInput,
  ): Promise<RoleUsersPayload> {
    const role = await this.scope.loadManagedRole(operator, roleId);
    return this.payload(operator, role, input);
  }

  /**
   * 加入使用者(增量):候選 = 所屬組織在角色擁有組織子樹內,否則 `USER_NOT_ELIGIBLE`。
   * 已持有者重送不報錯(冪等),不計入稽核。
   */
  async grant(
    operator: OperatorContext,
    input: GrantRoleUsersInput,
  ): Promise<RoleUsersPayload> {
    const role = await this.scope.loadManagedRole(operator, input.roleId);
    const ownerOrgId = await this.scope.ownerOrgIdOf(role);
    const userIds = uniqueIds(input.userIds).map((id) =>
      toObjectId(id, "userIds"),
    );
    const holderIds = await this.relations.listUserIdsOfRole(role._id);
    const holders = new Set(holderIds.map(String));
    const toAdd = userIds.filter((userId) => !holders.has(String(userId)));
    if (toAdd.length > 0) {
      await this.assertEligible(operator, toAdd, role._id, ownerOrgId);
      await this.relations.linkMany(
        operator,
        toAdd.map((userId) => ({
          type: "user_role" as const,
          firstId: userId,
          secondId: role._id,
        })),
      );
      await this.audit.record(operator, {
        action: AUDIT_ACTIONS.grantUser,
        targetType: AUDIT_TARGET_TYPE,
        targetId: role._id,
        after: { userIds: toAdd.map(String) },
      });
    }
    return this.payload(operator, role, {});
  }

  /**
   * 移除授予:擁有者保護(ADR-0009)擋下租戶擁有者的「租戶管理員」授予;
   * 沒有這筆授予的人重送不報錯(冪等)。
   */
  async revoke(
    operator: OperatorContext,
    input: RevokeRoleUsersInput,
  ): Promise<RoleUsersPayload> {
    const role = await this.scope.loadManagedRole(operator, input.roleId);
    const userIds = uniqueIds(input.userIds).map((id) =>
      toObjectId(id, "userIds"),
    );
    const holderIds = await this.relations.listUserIdsOfRole(role._id);
    const holders = new Set(holderIds.map(String));
    const toRemove = userIds.filter((userId) => holders.has(String(userId)));
    if (toRemove.length > 0) {
      await this.assertNotOwnerProtected(operator, toRemove, role._id);
      await this.relations.unlinkMany(
        operator,
        toRemove.map((userId) => ({
          type: "user_role" as const,
          firstId: userId,
          secondId: role._id,
        })),
      );
      await this.audit.record(operator, {
        action: AUDIT_ACTIONS.revokeUser,
        targetType: AUDIT_TARGET_TYPE,
        targetId: role._id,
        after: { userIds: toRemove.map(String) },
      });
    }
    return this.payload(operator, role, {});
  }

  // ---- 內部 ----

  private async payload(
    operator: OperatorContext,
    role: RoleRecord,
    input: RoleUsersInput,
  ): Promise<RoleUsersPayload> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const roleModel = await this.scope.decorateOne(operator, role);
    const holderIds = await this.relations.listUserIdsOfRole(role._id);
    if (holderIds.length === 0) {
      return { role: roleModel, items: [], totalCount: 0, page, pageSize };
    }
    // 持有者可能落在管理範圍外(ADR-0003「組織外」),所以不套 users 的範圍條件;
    // users 本身不掛租戶過濾(歸屬走 org_user 關聯,ADR-0005),此處以 id 明列。
    const filter = { _id: { $in: holderIds } };
    const totalCount = await this.users.count(operator, filter);
    const documents = await this.users.findMany(operator, filter, {
      sort: { createdAt: -1, _id: -1 },
      skip: (page - 1) * pageSize,
      limit: pageSize,
    });
    return {
      role: roleModel,
      items: await this.decorate(operator, role, documents),
      totalCount,
      page,
      pageSize,
    };
  }

  private async decorate(
    operator: OperatorContext,
    role: RoleRecord,
    documents: UserRecord[],
  ): Promise<RoleUser[]> {
    if (documents.length === 0) {
      return [];
    }
    const ownerOrgId = await this.scope.ownerOrgIdOf(role);
    const userIds = documents.map((user) => user._id);
    const orgLinks = await this.relations.listLinks("org_user", {
      secondIds: userIds,
    });
    const allOrgIds = uniqueObjectIds([
      ...orgLinks.map((link) => link.firstId),
      ...(ownerOrgId === null ? [] : [ownerOrgId]),
    ]);
    const [ancestry, managedOrgs] = await Promise.all([
      this.qualification.loadAncestry(operator, allOrgIds),
      allOrgIds.length === 0
        ? Promise.resolve([])
        : this.orgs.findMany(operator, { _id: { $in: allOrgIds } }),
    ]);
    const orgNameById = new Map(
      managedOrgs.map((org) => [String(org._id), org.name]),
    );
    const memberOrgIdsByUser = new Map<string, string[]>();
    for (const link of orgLinks) {
      const key = String(link.secondId);
      memberOrgIdsByUser.set(key, [
        ...(memberOrgIdsByUser.get(key) ?? []),
        String(link.firstId),
      ]);
    }
    const protectedUserIds = await this.protectedHolderIds(
      operator,
      documents,
      role._id,
    );

    return documents.map((user) => {
      const key = String(user._id);
      const memberOrgIds = memberOrgIdsByUser.get(key) ?? [];
      return {
        id: key,
        account: user.account,
        name: user.name,
        email: user.email,
        enabled: user.enabled,
        orgs: memberOrgIds.flatMap((orgId): RoleUserOrg[] => {
          const name = orgNameById.get(orgId);
          return name === undefined ? [] : [{ id: orgId, name }];
        }),
        outOfScope: !this.qualification.qualifies(
          memberOrgIds,
          ownerOrgId === null ? null : String(ownerOrgId),
          ancestry,
        ),
        ownerProtected: protectedUserIds.has(key),
      };
    });
  }

  /** 這一頁裡,哪些人的這筆授予受擁有者保護(根組織操作者不受限 → 空集合)。 */
  private async protectedHolderIds(
    operator: OperatorContext,
    documents: UserRecord[],
    roleId: Types.ObjectId,
  ): Promise<Set<string>> {
    if (await this.ownerProtection.isRootOperator(operator)) {
      return new Set();
    }
    const flagged = new Set<string>();
    for (const user of documents) {
      const protectedRoleIds = await this.ownerProtection.protectedRoleIdsOf(
        operator,
        user._id,
      );
      if (protectedRoleIds.has(String(roleId))) {
        flagged.add(String(user._id));
      }
    }
    return flagged;
  }

  /**
   * 候選規則(ADR-0003):所屬組織至少一個落在角色擁有組織的子樹內。
   * 查不到的使用者一律 `NOT_FOUND`(不透露差別);資格判斷本身共用
   * `OrgQualificationService.assertEligible`(#261:與使用者頁的 `assignUserRoles`
   * 同一份判斷、同一個 `USER_NOT_ELIGIBLE`),本檔不自己再算一次。
   */
  private async assertEligible(
    operator: OperatorContext,
    userIds: Types.ObjectId[],
    roleId: Types.ObjectId,
    ownerOrgId: Types.ObjectId | null,
  ): Promise<void> {
    const found = await this.users.findMany(operator, {
      _id: { $in: userIds },
    });
    if (found.length !== userIds.length) {
      throw notFoundError("One or more users not found");
    }
    await this.qualification.assertEligible(
      operator,
      await this.qualification.loadMembers(userIds),
      [{ id: roleId, ownerOrgId }],
    );
  }

  /** 擁有者保護(ADR-0009):租戶擁有者的「租戶管理員」授予不可解除;根組織操作者放行。 */
  private async assertNotOwnerProtected(
    operator: OperatorContext,
    userIds: Types.ObjectId[],
    roleId: Types.ObjectId,
  ): Promise<void> {
    if (await this.ownerProtection.isRootOperator(operator)) {
      return;
    }
    for (const userId of userIds) {
      const protectedRoleIds = await this.ownerProtection.protectedRoleIdsOf(
        operator,
        userId,
      );
      if (protectedRoleIds.has(String(roleId))) {
        throw roleError(
          "OWNER_PROTECTED",
          `Role ${String(roleId)} is the tenant owner's tenant-admin grant and cannot be revoked outside the root org`,
        );
      }
    }
  }
}
