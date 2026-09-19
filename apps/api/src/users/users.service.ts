import { randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import { Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { assertPasswordRule } from "../auth/password/password-error";
import { PasswordService } from "../auth/password/password.service";
import type { Persisted } from "../database/base.repository";
import {
  OrgsRepository,
  type RoleDocument,
  RolesRepository,
  type UserDocument,
  UsersRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import { PermissionResolver } from "../permission/permission-resolver";
import type { AssignUserRolesInput } from "./dto/assign-user-roles.input";
import type { CreateUserInput } from "./dto/create-user.input";
import type { SetUserEnabledInput } from "./dto/set-user-enabled.input";
import type { SetUserOrgsInput } from "./dto/set-user-orgs.input";
import type { UpdateUserInput } from "./dto/update-user.input";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type UsersInput,
} from "./dto/users.input";
import {
  RoleUnqualifiedReason,
  type SetUserOrgsPayload,
  type UnqualifiedRole,
  UserActivationMode,
  UserOrgRemovalPolicy,
  type UsersPayload,
} from "./models/user-payloads.model";
import type { UserModel, UserOrg, UserRoleGrant } from "./models/user.model";
import { OrgQualificationService } from "./org-qualification.service";
import {
  forbiddenError,
  notFoundError,
  userError,
  validationError,
} from "./users-error";

/** 欄位級權限(user-manager.md 權限表);在 service 投影,不靠 resolver 的單一 key 守門。 */
const SHOW_NATIONAL_ID = "system.user-manager.show-national-id";
const EDIT_NATIONAL_ID = "system.user-manager.edit-national-id";

/** 身分證字號永不寫進 audit_logs(user-manager.md「審計」),只記「已變更」。 */
const NATIONAL_ID_AUDIT_PLACEHOLDER = "(已變更)";

/** 可更新的基本欄位(user-manager.md「編輯使用者」);`nationalId` 另有欄位級權限,不在此列。 */
const EDITABLE_FIELDS = [
  "name",
  "account",
  "email",
  "nickname",
  "gender",
  "phone",
  "address",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

type UserRecord = Persisted<UserDocument>;
type RoleRecord = Persisted<RoleDocument>;

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw validationError(`${field} is not a valid id: ${value}`, [field]);
  }
  return new Types.ObjectId(value);
}

/** 關鍵字做部分比對,使用者輸入的 regex 特殊字元一律當字面值。 */
function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function mustChangePasswordOf(user: UserRecord): boolean {
  return user.settings.mustChangePassword === true;
}

/**
 * 使用者管理(`system.user-manager`)。resolver 薄、service 厚(STRUCT-01):
 * **管理範圍**(治理模組吃它,不吃可見範圍;ADR-0005 的分工表)、欄位級權限、防越權、
 * 擁有者保護與稽核都在這裡,寫入一律經 BaseRepository / RelationService。
 *
 * 範圍的落實點只有一個:凡查組織都經 `this.orgs`(治理類 collection,過濾自動吃 `managedOrgIds`),
 * 再由組織反查 `org_user` — 本檔不自己比對任何組織集合。
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly orgs: OrgsRepository,
    private readonly roles: RolesRepository,
    private readonly relations: RelationService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly permissions: PermissionResolver,
    private readonly qualification: OrgQualificationService,
    private readonly ownerProtection: OwnerProtectionService,
  ) {}

  // ---- 讀 ----

  /** 清單:選中組織的子樹成員 ∩ 操作者**管理範圍**(user-manager.md「清單範圍」、ADR-0005)。 */
  async list(
    operator: OperatorContext,
    input: UsersInput,
  ): Promise<UsersPayload> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const scope = await this.scopeFilter(operator, input.orgId);
    if (scope === null) {
      return { items: [], totalCount: 0, page, pageSize };
    }
    const keyword = input.keyword?.trim();
    const filter = {
      ...scope,
      ...(keyword
        ? {
            $or: [
              { name: { $regex: escapeRegex(keyword), $options: "i" } },
              { account: { $regex: escapeRegex(keyword), $options: "i" } },
              { email: { $regex: escapeRegex(keyword), $options: "i" } },
            ],
          }
        : {}),
    };
    const totalCount = await this.users.count(operator, filter);
    const documents = await this.users.findMany(operator, filter, {
      sort: { createdAt: -1, _id: -1 },
      skip: (page - 1) * pageSize,
      limit: pageSize,
    });
    return {
      items: await this.decorate(operator, documents),
      totalCount,
      page,
      pageSize,
    };
  }

  /** 單筆;`nationalId` 只在持 `show-national-id` 時回傳(ADR-0007)。 */
  async findOne(operator: OperatorContext, id: string): Promise<UserModel> {
    const user = await this.loadManagedUser(operator, id);
    const canShow = await this.hasPermission(operator, SHOW_NATIONAL_ID);
    const withNationalId = canShow
      ? ((await this.users.findById(operator, user._id, {
          select: "+nationalId",
        })) ?? user)
      : user;
    return this.decorateOne(operator, withNationalId, canShow);
  }

  // ---- 寫 ----

  /** 新增使用者:啟用信 / 初始密碼二選一(ADR-0009);帳號與 Email 各自唯一(ADR-0003)。 */
  async create(
    operator: OperatorContext,
    input: CreateUserInput,
  ): Promise<UserModel> {
    const name = requireText(input.name, "name");
    const account = requireText(input.account, "account");
    const email = requireText(input.email, "email");
    await this.assertAccountAndEmailFree(operator, { account, email });

    const orgIds = uniqueIds(input.orgIds).map((id) =>
      toObjectId(id, "orgIds"),
    );
    if (orgIds.length === 0) {
      throw validationError("At least one member org is required", ["orgIds"]);
    }
    await this.assertOrgsManaged(operator, orgIds);
    if (input.nationalId !== undefined) {
      await this.assertCanEditNationalId(operator);
    }
    const roleIds = uniqueIds(input.roleIds ?? []).map((id) =>
      toObjectId(id, "roleIds"),
    );
    await this.assertRolesGrantable(operator, roleIds, orgIds);

    const mode = input.activation.mode;
    const passwordHash = await this.initialPasswordHash(input);
    const user = await this.users.create(operator, {
      name,
      account,
      email,
      ...optional("nickname", input.nickname),
      ...optional("gender", input.gender),
      ...optional("phone", input.phone),
      ...optional("address", input.address),
      ...optional("nationalId", input.nationalId),
      passwordHash,
      enabled: true,
      settings: { mustChangePassword: mode === UserActivationMode.PASSWORD },
    });

    await this.relations.linkMany(operator, [
      ...orgIds.map((orgId) => ({
        type: "org_user" as const,
        firstId: orgId,
        secondId: user._id,
      })),
      ...roleIds.map((roleId) => ({
        type: "user_role" as const,
        firstId: user._id,
        secondId: roleId,
      })),
    ]);

    await this.audit.record(operator, {
      action: "user.create",
      targetType: "user",
      targetId: user._id,
      after: {
        name,
        account,
        email,
        orgIds: orgIds.map(String),
        roleIds: roleIds.map(String),
        activationMode: mode,
        ...(input.nationalId === undefined
          ? {}
          : { nationalId: NATIONAL_ID_AUDIT_PLACEHOLDER }),
      },
    });

    if (mode === UserActivationMode.EMAIL) {
      await this.passwords.sendActivationEmail(user._id);
    }
    return this.decorateOne(operator, user);
  }

  /** 編輯基本欄位;`nationalId` 需 `edit-national-id`(ADR-0007)。 */
  async update(
    operator: OperatorContext,
    input: UpdateUserInput,
  ): Promise<UserModel> {
    const user = await this.loadManagedUser(operator, input.id);
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const update: Record<string, unknown> = {};

    for (const field of EDITABLE_FIELDS) {
      const given = input[field];
      if (given === undefined) {
        continue;
      }
      const value = isRequiredField(field)
        ? requireText(given, field)
        : given.trim();
      if (value === (user[field] ?? "")) {
        continue;
      }
      before[field] = user[field] ?? null;
      after[field] = value;
      update[field] = value;
    }
    await this.assertAccountAndEmailFree(
      operator,
      {
        account: after.account as string | undefined,
        email: after.email as string | undefined,
      },
      user._id,
    );

    if (input.nationalId !== undefined) {
      await this.assertCanEditNationalId(operator);
      update.nationalId = input.nationalId;
      // 身分證字號永不寫進 audit_logs(user-manager.md「審計」):只記「已變更」
      before.nationalId = NATIONAL_ID_AUDIT_PLACEHOLDER;
      after.nationalId = NATIONAL_ID_AUDIT_PLACEHOLDER;
    }
    if (Object.keys(update).length === 0) {
      return this.decorateOne(operator, user);
    }

    const updated =
      (await this.users.updateById(operator, user._id, { $set: update })) ??
      user;
    await this.audit.record(operator, {
      action: "user.edit",
      targetType: "user",
      targetId: user._id,
      before,
      after,
    });
    return this.decorateOne(operator, updated);
  }

  /** 停用 / 啟用;停用即刻作廢該使用者全部 refresh token(擁有者不可被停用,ADR-0009)。 */
  async setEnabled(
    operator: OperatorContext,
    input: SetUserEnabledInput,
  ): Promise<UserModel> {
    const user = await this.loadManagedUser(operator, input.id);
    if (!input.enabled) {
      await this.ownerProtection.assertNotProtectedOwner(
        operator,
        user,
        "disable",
      );
    }
    if (user.enabled === input.enabled) {
      return this.decorateOne(operator, user);
    }
    const updated =
      (await this.users.updateById(operator, user._id, {
        $set: { enabled: input.enabled },
      })) ?? user;
    if (!input.enabled) {
      // 下一次請求即 UNAUTHENTICATED / ACCOUNT_DISABLED(登入線既有的「登出所有裝置」)
      await this.auth.logoutAllDevices(user);
    }
    await this.audit.record(operator, {
      action: "user.toggle-enabled",
      targetType: "user",
      targetId: user._id,
      before: { enabled: user.enabled },
      after: { enabled: input.enabled },
    });
    return this.decorateOne(operator, updated);
  }

  /** 所屬組織增減:`dryRun` 先回失去資格清單,正式送出依 radio 三檔處理(ADR-0003)。 */
  async setOrgs(
    operator: OperatorContext,
    input: SetUserOrgsInput,
  ): Promise<SetUserOrgsPayload> {
    const user = await this.loadManagedUser(operator, input.userId);
    const desired = uniqueIds(input.orgIds).map((id) =>
      toObjectId(id, "orgIds"),
    );
    await this.assertOrgsManaged(operator, desired);
    const currentIds = await this.relations.listOrgIdsOfUser(user._id);
    const currentKeys = new Set(currentIds.map(String));
    const desiredKeys = new Set(desired.map(String));
    // 管理範圍外的既有所屬組織不受全量覆蓋影響(彈窗根本勾不到,ADR-0003)
    const managedCurrent = await this.orgs.findMany(operator, {
      _id: { $in: currentIds },
    });

    const toAdd = desired.filter((orgId) => !currentKeys.has(String(orgId)));
    const removed = managedCurrent.filter(
      (org) => !desiredKeys.has(String(org._id)),
    );
    const removedKeys = new Set(removed.map((org) => String(org._id)));
    const remaining = [
      ...currentIds.filter((orgId) => !removedKeys.has(String(orgId))),
      ...toAdd,
    ];
    if (remaining.length === 0) {
      throw userError(
        "LAST_ORG",
        "A user must keep at least one member org; the last one cannot be removed",
      );
    }
    await this.assertOwnedOrgsKept(operator, user, removedKeys);

    const protectedRoleIds = (await this.ownerProtection.isRootOperator(
      operator,
    ))
      ? new Set<string>()
      : await this.ownerProtection.protectedRoleIdsOf(operator, user._id);
    const unqualifiedRoles = await this.unqualifiedRolesOf(
      operator,
      user._id,
      remaining,
      removedKeys,
      protectedRoleIds,
    );
    const removedOrgs: UserOrg[] = removed.map((org) => ({
      id: String(org._id),
      name: org.name,
    }));

    if (input.dryRun === true) {
      return {
        user: await this.decorateOne(operator, user),
        removedOrgs,
        unqualifiedRoles,
        revokedRoleIds: [],
      };
    }

    const revokedRoleIds = revokedByPolicy(
      unqualifiedRoles,
      input.removalPolicy ?? UserOrgRemovalPolicy.REVOKE_ALL_UNQUALIFIED,
    );
    await this.relations.linkMany(
      operator,
      toAdd.map((orgId) => ({
        type: "org_user" as const,
        firstId: orgId,
        secondId: user._id,
      })),
    );
    await this.relations.unlinkMany(operator, [
      ...removed.map((org) => ({
        type: "org_user" as const,
        firstId: org._id,
        secondId: user._id,
      })),
      ...revokedRoleIds.map((roleId) => ({
        type: "user_role" as const,
        firstId: user._id,
        secondId: new Types.ObjectId(roleId),
      })),
    ]);

    if (toAdd.length > 0) {
      await this.audit.record(operator, {
        action: "user.add-org",
        targetType: "user",
        targetId: user._id,
        after: { orgIds: toAdd.map(String) },
      });
    }
    if (removed.length > 0) {
      await this.audit.record(operator, {
        action: "user.remove-org",
        targetType: "user",
        targetId: user._id,
        before: { orgIds: currentIds.map(String) },
        after: {
          orgIds: [...removedKeys],
          removalPolicy:
            input.removalPolicy ?? UserOrgRemovalPolicy.REVOKE_ALL_UNQUALIFIED,
          revokedRoleIds,
        },
      });
    }
    return {
      user: await this.decorateOne(operator, user),
      removedOrgs,
      unqualifiedRoles,
      revokedRoleIds,
    };
  }

  /** 指派角色(全量覆蓋);防越權 `ROLE_OUT_OF_REACH`、擁有者保護 `OWNER_PROTECTED`(ADR-0003 / 0009)。 */
  async assignRoles(
    operator: OperatorContext,
    input: AssignUserRolesInput,
  ): Promise<UserModel> {
    const user = await this.loadManagedUser(operator, input.userId);
    const desired = uniqueIds(input.roleIds).map((id) =>
      toObjectId(id, "roleIds"),
    );
    const currentIds = await this.relations.listRoleIdsOfUser(user._id);
    const currentKeys = new Set(currentIds.map(String));
    const desiredKeys = new Set(desired.map(String));
    const reachable = await this.reachableRoleIds(operator);

    const toAdd = desired.filter((roleId) => !currentKeys.has(String(roleId)));
    const memberOrgIds = await this.relations.listOrgIdsOfUser(user._id);
    await this.assertRolesGrantable(operator, toAdd, memberOrgIds, reachable);

    // 操作者觸及不到的既有授予不動(彈窗列不出來,不該被順手解除)
    const toRemove = currentIds.filter(
      (roleId) =>
        !desiredKeys.has(String(roleId)) &&
        (reachable === "all" || reachable.has(String(roleId))),
    );
    const protectedRoleIds = (await this.ownerProtection.isRootOperator(
      operator,
    ))
      ? new Set<string>()
      : await this.ownerProtection.protectedRoleIdsOf(operator, user._id);
    const blocked = toRemove.find((roleId) =>
      protectedRoleIds.has(String(roleId)),
    );
    if (blocked) {
      throw userError(
        "OWNER_PROTECTED",
        `Role ${String(blocked)} is the tenant owner's tenant-admin grant and cannot be revoked outside the root org`,
      );
    }

    await this.relations.linkMany(
      operator,
      toAdd.map((roleId) => ({
        type: "user_role" as const,
        firstId: user._id,
        secondId: roleId,
      })),
    );
    await this.relations.unlinkMany(
      operator,
      toRemove.map((roleId) => ({
        type: "user_role" as const,
        firstId: user._id,
        secondId: roleId,
      })),
    );
    if (toAdd.length > 0) {
      await this.audit.record(operator, {
        action: "user.grant-role",
        targetType: "user",
        targetId: user._id,
        after: { roleIds: toAdd.map(String) },
      });
    }
    if (toRemove.length > 0) {
      await this.audit.record(operator, {
        action: "user.revoke-role",
        targetType: "user",
        targetId: user._id,
        after: { roleIds: toRemove.map(String) },
      });
    }
    return this.decorateOne(operator, user);
  }

  // ---- 內部 ----

  /**
   * 清單的使用者過濾條件:**管理範圍**內的組織的成員(ADR-0005 的分工表;#187 起不看可見範圍)。
   * 選中的組織不在管理範圍(或子樹內沒有管理範圍內的組織)回 null = 空清單。
   * 組織一律經 `this.orgs`(治理類 collection,過濾自動吃 `managedOrgIds`),此處不自己比對範圍。
   */
  private async scopeFilter(
    operator: OperatorContext,
    orgId: string | undefined,
  ): Promise<Record<string, unknown> | null> {
    if (orgId === undefined && operator.managedOrgIds === "all") {
      // 管理範圍是全部(超級管理員 / 擁有組織是根組織):不必先攤開組織樹再反查
      return {};
    }
    const scopeOrgs = await (orgId === undefined
      ? this.orgs.findMany(operator, {})
      : this.orgs.findMany(operator, {
          $or: [
            { _id: toObjectId(orgId, "orgId") },
            { ancestors: toObjectId(orgId, "orgId") },
          ],
        }));
    if (scopeOrgs.length === 0) {
      return null;
    }
    const links = await this.relations.listLinks("org_user", {
      firstIds: scopeOrgs.map((org) => org._id),
    });
    if (links.length === 0) {
      return null;
    }
    return { _id: { $in: links.map((link) => link.secondId) } };
  }

  /** 使用者是否在操作者**管理範圍**內 = 其所屬組織至少一個在管理範圍(ADR-0005);否則視為不存在。 */
  private async loadManagedUser(
    operator: OperatorContext,
    id: string,
  ): Promise<UserRecord> {
    const user = await this.users.findById(operator, toObjectId(id, "id"));
    if (!user) {
      throw notFoundError(`User ${id} not found`);
    }
    if (operator.managedOrgIds === "all") {
      return user;
    }
    const memberOrgIds = await this.relations.listOrgIdsOfUser(user._id);
    const managed = await this.orgs.findMany(operator, {
      _id: { $in: memberOrgIds },
    });
    if (managed.length === 0) {
      throw notFoundError(`User ${id} not found`);
    }
    return user;
  }

  /** 把使用者文件組成 GraphQL 形狀:所屬組織(只列管理範圍內的)+ 角色授予(含「組織外」標記)。 */
  private async decorate(
    operator: OperatorContext,
    documents: UserRecord[],
    includeNationalId = false,
  ): Promise<UserModel[]> {
    if (documents.length === 0) {
      return [];
    }
    const userIds = documents.map((user) => user._id);
    const [orgLinks, roleLinks] = await Promise.all([
      this.relations.listLinks("org_user", { secondIds: userIds }),
      this.relations.listLinks("user_role", { firstIds: userIds }),
    ]);
    const roleIds = uniqueObjectIds(roleLinks.map((link) => link.secondId));
    const [roleDocuments, ownerLinks] = await Promise.all([
      roleIds.length === 0
        ? Promise.resolve<RoleRecord[]>([])
        : this.roles.findMany(operator, { _id: { $in: roleIds } }),
      this.relations.listLinks("org_role", { secondIds: roleIds }),
    ]);
    const ownerOrgIdByRole = new Map(
      ownerLinks.map((link) => [String(link.secondId), String(link.firstId)]),
    );
    const roleById = new Map(
      roleDocuments.map((role) => [String(role._id), role]),
    );

    const allOrgIds = uniqueObjectIds([
      ...orgLinks.map((link) => link.firstId),
      ...ownerLinks.map((link) => link.firstId),
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
    const roleIdsByUser = new Map<string, string[]>();
    for (const link of roleLinks) {
      const key = String(link.firstId);
      roleIdsByUser.set(key, [
        ...(roleIdsByUser.get(key) ?? []),
        String(link.secondId),
      ]);
    }

    return documents.map((user) => {
      const key = String(user._id);
      const memberOrgIds = memberOrgIdsByUser.get(key) ?? [];
      return {
        id: key,
        account: user.account,
        name: user.name,
        email: user.email,
        nickname: user.nickname ?? null,
        gender: user.gender ?? null,
        phone: user.phone ?? null,
        address: user.address ?? null,
        nationalId: includeNationalId ? (user.nationalId ?? null) : null,
        enabled: user.enabled,
        mustChangePassword: mustChangePasswordOf(user),
        orgs: memberOrgIds.flatMap((orgId): UserOrg[] => {
          const name = orgNameById.get(orgId);
          return name === undefined ? [] : [{ id: orgId, name }];
        }),
        roles: (roleIdsByUser.get(key) ?? []).flatMap(
          (roleId): UserRoleGrant[] => {
            const role = roleById.get(roleId);
            if (!role) {
              return [];
            }
            const ownerOrgId = ownerOrgIdByRole.get(roleId) ?? null;
            return [
              {
                id: roleId,
                name: role.name,
                ownerOrgId,
                ownerOrgName:
                  ownerOrgId === null
                    ? null
                    : (orgNameById.get(ownerOrgId) ?? null),
                outOfScope: !this.qualification.qualifies(
                  memberOrgIds,
                  ownerOrgId,
                  ancestry,
                ),
              },
            ];
          },
        ),
      };
    });
  }

  /** 單筆的 `decorate`(寫入動作的回傳都是一份文件)。 */
  private async decorateOne(
    operator: OperatorContext,
    document: UserRecord,
    includeNationalId = false,
  ): Promise<UserModel> {
    const [model] = await this.decorate(
      operator,
      [document],
      includeNationalId,
    );
    if (!model) {
      throw notFoundError(`User ${String(document._id)} not found`);
    }
    return model;
  }

  /** 移除後逐筆判斷失去資格的角色(ADR-0003),附原因與擁有者保護標記。 */
  private async unqualifiedRolesOf(
    operator: OperatorContext,
    userId: Types.ObjectId,
    remainingOrgIds: Types.ObjectId[],
    removedOrgKeys: ReadonlySet<string>,
    protectedRoleIds: ReadonlySet<string>,
  ): Promise<UnqualifiedRole[]> {
    const grantedRoleIds = await this.relations.listRoleIdsOfUser(userId);
    if (grantedRoleIds.length === 0) {
      return [];
    }
    const [roleDocuments, ownerLinks] = await Promise.all([
      this.roles.findMany(operator, { _id: { $in: grantedRoleIds } }),
      this.relations.listLinks("org_role", { secondIds: grantedRoleIds }),
    ]);
    const ownerOrgIdByRole = new Map(
      ownerLinks.map((link) => [String(link.secondId), String(link.firstId)]),
    );
    const ownerOrgIds = uniqueObjectIds(ownerLinks.map((link) => link.firstId));
    const [ancestry, managedOrgs] = await Promise.all([
      this.qualification.loadAncestry(operator, [
        ...remainingOrgIds,
        ...ownerOrgIds,
      ]),
      this.orgs.findMany(operator, { _id: { $in: ownerOrgIds } }),
    ]);
    const orgNameById = new Map(
      managedOrgs.map((org) => [String(org._id), org.name]),
    );
    const remainingKeys = remainingOrgIds.map(String);

    return roleDocuments.flatMap((role): UnqualifiedRole[] => {
      const roleId = String(role._id);
      const ownerOrgId = ownerOrgIdByRole.get(roleId) ?? null;
      const reasons: RoleUnqualifiedReason[] = [];
      if (ownerOrgId !== null && removedOrgKeys.has(ownerOrgId)) {
        reasons.push(RoleUnqualifiedReason.OWNED_BY_REMOVED_ORG);
      }
      if (!this.qualification.qualifies(remainingKeys, ownerOrgId, ancestry)) {
        reasons.push(RoleUnqualifiedReason.NO_REMAINING_SUBTREE_SUPPORT);
      }
      if (reasons.length === 0) {
        return [];
      }
      return [
        {
          roleId,
          roleName: role.name,
          ownerOrgId,
          ownerOrgName:
            ownerOrgId === null ? null : (orgNameById.get(ownerOrgId) ?? null),
          reasons,
          ownerProtected: protectedRoleIds.has(roleId),
        },
      ];
    });
  }

  /** 擁有者不可被移出自己擁有的租戶(ADR-0009);根組織操作者放行。 */
  private async assertOwnedOrgsKept(
    operator: OperatorContext,
    user: UserRecord,
    removedOrgKeys: ReadonlySet<string>,
  ): Promise<void> {
    if (removedOrgKeys.size === 0) {
      return;
    }
    if (await this.ownerProtection.isRootOperator(operator)) {
      return;
    }
    const ownedOrgIds = await this.ownerProtection.ownedOrgIdsOf(
      operator,
      user._id,
    );
    const blocked = ownedOrgIds.find((orgId) =>
      removedOrgKeys.has(String(orgId)),
    );
    if (blocked) {
      throw userError(
        "OWNER_PROTECTED",
        `User ${String(user._id)} owns org ${String(blocked)} and cannot be removed from it outside the root org`,
      );
    }
  }

  /** 操作者可觸及的角色 = 自己持有的那些(ADR-0003);超級管理員全權放行(ADR-0004)。 */
  private async reachableRoleIds(
    operator: OperatorContext,
  ): Promise<ReadonlySet<string> | "all"> {
    if (!operator.actorId) {
      return new Set();
    }
    const { isSuperAdmin } = await this.permissions.resolve(
      operator.actorId,
      operator.currentOrgId,
    );
    if (isSuperAdmin) {
      return "all";
    }
    const roleIds = await this.relations.listRoleIdsOfUser(operator.actorId);
    return new Set(roleIds.map(String));
  }

  /** 防越權 + 授予資格(ADR-0003:只在按下授予的當下檢查一次)。 */
  private async assertRolesGrantable(
    operator: OperatorContext,
    roleIds: Types.ObjectId[],
    memberOrgIds: Types.ObjectId[],
    known?: ReadonlySet<string> | "all",
  ): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }
    const reachable = known ?? (await this.reachableRoleIds(operator));
    if (reachable !== "all") {
      const blocked = roleIds.find((roleId) => !reachable.has(String(roleId)));
      if (blocked) {
        throw userError(
          "ROLE_OUT_OF_REACH",
          `Role ${String(blocked)} is not held by the operator and cannot be granted`,
        );
      }
    }
    const ownerLinks = await this.relations.listLinks("org_role", {
      secondIds: roleIds,
    });
    const ownerOrgIdByRole = new Map(
      ownerLinks.map((link) => [String(link.secondId), String(link.firstId)]),
    );
    const ancestry = await this.qualification.loadAncestry(operator, [
      ...memberOrgIds,
      ...ownerLinks.map((link) => link.firstId),
    ]);
    const memberKeys = memberOrgIds.map(String);
    const unqualified = roleIds.find(
      (roleId) =>
        !this.qualification.qualifies(
          memberKeys,
          ownerOrgIdByRole.get(String(roleId)) ?? null,
          ancestry,
        ),
    );
    if (unqualified) {
      throw validationError(
        `Role ${String(unqualified)} cannot be granted: none of the user's member orgs is inside the role's owner org subtree`,
        ["roleIds"],
      );
    }
  }

  /** 組織必須在操作者**管理範圍**內(ADR-0005 的分工表);回傳查到的組織文件供取名稱。 */
  private async assertOrgsManaged(
    operator: OperatorContext,
    orgIds: Types.ObjectId[],
  ): Promise<Persisted<import("../database/database.module").OrgDocument>[]> {
    if (orgIds.length === 0) {
      return [];
    }
    const found = await this.orgs.findMany(operator, { _id: { $in: orgIds } });
    if (found.length !== orgIds.length) {
      throw forbiddenError(
        "One or more orgs are outside the operator's managed scope",
      );
    }
    return found;
  }

  private async assertCanEditNationalId(
    operator: OperatorContext,
  ): Promise<void> {
    if (!(await this.hasPermission(operator, EDIT_NATIONAL_ID))) {
      throw forbiddenError(`Missing permission ${EDIT_NATIONAL_ID}`);
    }
  }

  private async hasPermission(
    operator: OperatorContext,
    key: string,
  ): Promise<boolean> {
    if (!operator.actorId) {
      return false;
    }
    const { permissionKeys } = await this.permissions.resolve(
      operator.actorId,
      operator.currentOrgId,
    );
    return hasEffectivePermission(permissionKeys, key);
  }

  /** 帳號與 Email 各自在 `users` 內唯一(ADR-0003);重複回 `VALIDATION_FAILED` 並列出欄位。 */
  private async assertAccountAndEmailFree(
    operator: OperatorContext,
    values: { account?: string; email?: string },
    excludeUserId?: Types.ObjectId,
  ): Promise<void> {
    const conditions = [
      ...(values.account === undefined ? [] : [{ account: values.account }]),
      ...(values.email === undefined ? [] : [{ email: values.email }]),
    ];
    if (conditions.length === 0) {
      return;
    }
    const clashes = await this.users.findMany(operator, { $or: conditions });
    const fields = new Set<string>();
    for (const clash of clashes) {
      if (excludeUserId && clash._id.equals(excludeUserId)) {
        continue;
      }
      if (clash.account === values.account) {
        fields.add("account");
      }
      if (clash.email === values.email) {
        fields.add("email");
      }
    }
    if (fields.size > 0) {
      throw validationError(`Already taken: ${[...fields].join(", ")}`, [
        ...fields,
      ]);
    }
  }

  /**
   * 啟用方式(ADR-0009):EMAIL → 不設可用密碼(隨機值雜湊,驗不過),由啟用信自行設定;
   * PASSWORD → 檢查規則後雜湊,並在 settings 設 `mustChangePassword`(首登強改)。
   */
  private initialPasswordHash(input: CreateUserInput): Promise<string> {
    if (input.activation.mode === UserActivationMode.PASSWORD) {
      const initial = input.activation.initialPassword ?? "";
      assertPasswordRule(initial);
      return hash(initial);
    }
    return hash(randomBytes(32).toString("hex"));
  }
}

/** 與 PermissionGuard 同一判斷語意(含同層 wildcard,ADR-0004)。 */
function hasEffectivePermission(
  permissionKeys: ReadonlySet<string>,
  key: string,
): boolean {
  if (permissionKeys.has(key)) {
    return true;
  }
  const lastDot = key.lastIndexOf(".");
  return lastDot > 0 && permissionKeys.has(`${key.slice(0, lastDot)}.*`);
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [...new Map(ids.map((id) => [String(id), id])).values()];
}

const REQUIRED_FIELDS = new Set<EditableField>(["name", "account", "email"]);

function isRequiredField(field: EditableField): boolean {
  return REQUIRED_FIELDS.has(field);
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw validationError(`${field} is required`, [field]);
  }
  return trimmed;
}

function optional<TKey extends string>(
  key: TKey,
  value: string | undefined,
): Record<TKey, string> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<TKey, string>);
}

/** radio 三檔 → 實際要解除的授予(ADR-0003);擁有者保護的那筆永遠留著。 */
function revokedByPolicy(
  unqualified: UnqualifiedRole[],
  policy: UserOrgRemovalPolicy,
): string[] {
  if (policy === UserOrgRemovalPolicy.KEEP_ALL) {
    return [];
  }
  return unqualified
    .filter((entry) => !entry.ownerProtected)
    .filter(
      (entry) =>
        policy === UserOrgRemovalPolicy.REVOKE_ALL_UNQUALIFIED ||
        entry.reasons.includes(RoleUnqualifiedReason.OWNED_BY_REMOVED_ORG),
    )
    .map((entry) => entry.roleId);
}
