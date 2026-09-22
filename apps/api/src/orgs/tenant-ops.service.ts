import { randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import { Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import { PasswordService } from "../auth/password/password.service";
import type { Persisted } from "../database/base.repository";
import {
  type ModuleDocument,
  ModulesRepository,
  OrgsRepository,
  PermissionsRepository,
  type RoleDocument,
  RolesRepository,
  UsersRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import {
  type RelationLink,
  RelationService,
} from "../database/relation.service";
import { ModuleSidebarType } from "../permission/models/me-module.model";
import { isOwnedUploadPath } from "../storage/storage.service";
import type { ProvisionTenantInput } from "./dto/provision-tenant.input";
import type { RevokeTenantProvisionInput } from "./dto/revoke-tenant-provision.input";
import type { TransferOrgOwnerInput } from "./dto/transfer-org-owner.input";
import type { Org } from "./models/org.model";
import type {
  ModuleOption,
  ProvisionTenantPayload,
  RevokeTenantProvisionPayload,
} from "./models/tenant-ops.model";
import { orgError, provisionNotRevokableError } from "./org-error";
import { type OrgRecord, isTenantTop, toOrg } from "./org-mapper";
import { OrgsService } from "./orgs.service";
import {
  OwnerProtectionService,
  TEMPLATE_KEY_SETTING,
  TENANT_ADMIN_ROLE_KEY,
} from "./owner-protection.service";

type ModuleRecord = Persisted<ModuleDocument>;
type RoleRecord = Persisted<RoleDocument>;

/** 審計動作名(docs/modules/org-manager.md「審計」;`targetType` 一律 org)。 */
const AUDIT_TARGET_TYPE = "org";
const AUDIT_ACTIONS = {
  provision: "org.provision",
  revokeProvision: "org.revoke-provision",
  transferOwner: "org.transfer-owner",
} as const;

/**
 * 開通失敗時要補償刪除的東西(Mongo 單節點無 transaction,見 `provision` 的說明)。
 * 順序即「建立順序」,回滾時反向處理。
 */
interface ProvisionedArtifacts {
  links: Omit<RelationLink, "meta">[];
  orgId?: Types.ObjectId;
  roleId?: Types.ObjectId;
  userId?: Types.ObjectId;
}

/** 必填文字去空白;空字串即 `VALIDATION_FAILED`,`extensions.fields` 指出是哪一欄。 */
function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw validationError(`${field} must not be empty`, [field]);
  }
  return trimmed;
}

/** 輸入不合法(GQL-04 `VALIDATION_FAILED`):`extensions.fields` 讓前端標到對應的表單欄位。 */
function validationError(message: string, fields: string[]) {
  const error = orgError("VALIDATION_FAILED", message);
  (error.extensions as Record<string, unknown>).fields = fields;
  return error;
}

/** 商標只收本 API 自己簽出來的路徑(ADR-0010;與 `updateOrg` 同一條規則)。 */
function ownedLogoPath(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    return undefined;
  }
  if (!isOwnedUploadPath(trimmed)) {
    throw validationError(
      `logoPath ${trimmed} was not issued by createUploadUrl`,
      ["logoPath"],
    );
  }
  return trimmed;
}

/** 模組文件 → 勾選選項;上層不在選項內時 `parentId` 為 null(該節點自成一棵根)。 */
function toModuleOptions(documents: ModuleRecord[]): ModuleOption[] {
  const ids = new Set(documents.map((document) => String(document._id)));
  return sortForTree(documents).map((document) => ({
    id: String(document._id),
    key: document.key,
    name: document.name,
    parentId:
      document.parentId !== null && ids.has(String(document.parentId))
        ? String(document.parentId)
        : null,
    sidebarType: document.sidebarType as ModuleSidebarType,
    order: document.order,
  }));
}

/** 上層一定排在下層前面(深度),同層照側欄順序 — 前端不必先排就能一路建樹。 */
function sortForTree(documents: ModuleRecord[]): ModuleRecord[] {
  return documents.toSorted(
    (left, right) =>
      left.ancestors.length - right.ancestors.length ||
      left.order - right.order ||
      left.key.localeCompare(right.key),
  );
}

/**
 * 勾選 → 實際要綁的模組。
 * - 選項外的 key(含根組織專屬模組)→ `VALIDATION_FAILED`
 * - 一個都沒勾 → `VALIDATION_FAILED`(沒有模組的租戶管理員進不了任何頁面)
 * - **自動補上仍在選項內的上層模組**:模組樹是側欄的樹,只綁下層不綁群組會讓側欄斷成孤兒
 *   (ADR-0004「勾下層模組必連動勾上層」,前端矩陣本來就這樣送;API 這一層不依賴前端做對)
 */
function selectModules(
  options: ModuleRecord[],
  requestedKeys: string[],
): ModuleRecord[] {
  const byKey = new Map(options.map((option) => [option.key, option]));
  const byId = new Map(options.map((option) => [String(option._id), option]));
  const unknown = [...new Set(requestedKeys)].filter((key) => !byKey.has(key));
  if (unknown.length > 0) {
    throw validationError(
      `Modules not offered to tenants: ${unknown.join(", ")}`,
      ["moduleKeys"],
    );
  }
  const picked = new Map<string, ModuleRecord>();
  for (const key of requestedKeys) {
    const node = byKey.get(key);
    if (!node) {
      continue;
    }
    picked.set(String(node._id), node);
    for (const ancestorId of node.ancestors) {
      const ancestor = byId.get(String(ancestorId));
      if (ancestor) {
        picked.set(String(ancestor._id), ancestor);
      }
    }
  }
  if (picked.size === 0) {
    throw validationError("At least one module must be selected", [
      "moduleKeys",
    ]);
  }
  return sortForTree([...picked.values()]);
}

/**
 * 租戶作業(`system.org-manager.tenant-ops`,根組織專屬):開通租戶、轉移擁有者。
 * 規則正本 ADR-0009 與 docs/modules/org-manager.md;
 * resolver 以 `@RequirePermission` 守門,本層再確認操作者站在根組織(權限有了也不夠)。
 *
 * 可見範圍開關 2026-09-19 搬出本服務(#187):它是**租戶自己的資料政策**、由管理範圍守門,
 * 不是根組織專屬動作,因此住在 `OrgsService.setVisibility`。
 */
@Injectable()
export class TenantOpsService {
  private readonly logger = new Logger(TenantOpsService.name);

  constructor(
    private readonly orgs: OrgsRepository,
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly modules: ModulesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly relations: RelationService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly ownerProtection: OwnerProtectionService,
    private readonly orgsService: OrgsService,
  ) {}

  /**
   * 開通彈窗的模組勾選清單 = 租戶管理員模板綁的模組(`tenant-ops.model.ts` 說明判準),
   * 前端預設全勾。
   */
  async moduleOptions(operator: OperatorContext): Promise<ModuleOption[]> {
    await this.assertRootOperator(operator, "tenantModuleOptions");
    const template = await this.templateRole(operator);
    return toModuleOptions(await this.optionModules(operator, template));
  }

  /**
   * 開通租戶(ADR-0009):建租戶 Org → 複製租戶管理員模板(只綁勾選的模組 + 各該模組的 `*`)
   * → 建首任管理員(不設密碼)並綁 `org_user` / `user_role` → 設 `ownerUserId` → 寄啟用信。
   *
   * **回滾**:Mongo 單節點沒有 transaction,整段以**補償刪除**實作 — 過程中建立的關聯、
   * 使用者、角色副本、租戶組織逐一抹掉(`hardDeleteById`,不是軟刪除:`users` 的唯一索引含
   * 已軟刪除的文件,留殭屍會讓同一組帳號永遠再也開不了)。
   * 補償範圍**不含 `audit_logs`**(只增不改,ADR-0004):極端情況下會留一筆 `org.provision`
   * 但資料已回滾 — 這是刻意取捨,寧可多一筆稽核痕跡,也不要漏記特權動作。
   * 寄信放最後(唯一不可逆的外部副作用);信寄出後失敗的話 token 指向已刪除的使用者,
   * 對方點連結得到 `ACTION_TOKEN_INVALID`,重新開通即可。
   */
  async provision(
    operator: OperatorContext,
    input: ProvisionTenantInput,
  ): Promise<ProvisionTenantPayload> {
    await this.assertRootOperator(operator, AUDIT_ACTIONS.provision);
    const name = requireText(input.name, "name");
    const account = requireText(input.adminAccount, "adminAccount");
    const email = requireText(input.adminEmail, "adminEmail");
    const logoPath = ownedLogoPath(input.logoPath);
    await this.assertAccountAndEmailFree(operator, account, email);

    const template = await this.templateRole(operator);
    const selected = selectModules(
      await this.optionModules(operator, template),
      input.moduleKeys,
    );
    const permissionIds = await this.templatePermissionIds(
      operator,
      template,
      selected,
    );
    const rootOrg = await this.rootOrg(operator);

    const created: ProvisionedArtifacts = { links: [] };
    try {
      // 1. 租戶 Org:根組織的直接子組織
      const org = await this.orgs.create(operator, {
        name,
        parentId: rootOrg._id,
        ancestors: [rootOrg._id],
        enabled: true,
        isSystem: false,
        settings: {},
        ...(logoPath === undefined ? {} : { logoPath }),
      });
      created.orgId = org._id;

      // 2. 租戶管理員副本:沒有 key(全庫唯一),以 settings.templateKey 標記來源(ADR-0009)
      const role = await this.roles.create(operator, {
        name: template.name,
        ...(template.description === undefined
          ? {}
          : { description: template.description }),
        enabled: true,
        isSystem: false,
        settings: { [TEMPLATE_KEY_SETTING]: TENANT_ADMIN_ROLE_KEY },
      });
      created.roleId = role._id;
      await this.link(operator, created, [
        { type: "org_role", firstId: org._id, secondId: role._id },
        ...selected.map((module) => ({
          type: "role_module" as const,
          firstId: role._id,
          secondId: module._id,
        })),
        ...permissionIds.map((permissionId) => ({
          type: "role_permission" as const,
          firstId: role._id,
          secondId: permissionId,
        })),
      ]);

      // 3. 首任租戶管理員:不設可用密碼(隨機值雜湊,驗不過),由啟用信自行設定
      const user = await this.users.create(operator, {
        name: account,
        account,
        email,
        passwordHash: await hash(randomBytes(32).toString("hex")),
        enabled: true,
        settings: { mustChangePassword: false },
      });
      created.userId = user._id;
      await this.link(operator, created, [
        { type: "org_user", firstId: org._id, secondId: user._id },
        { type: "user_role", firstId: user._id, secondId: role._id },
      ]);

      // 4. 租戶擁有者
      const owned = await this.orgs.updateById(operator, org._id, {
        $set: { ownerUserId: user._id },
      });

      await this.audit.record(operator, {
        action: AUDIT_ACTIONS.provision,
        targetType: AUDIT_TARGET_TYPE,
        targetId: org._id,
        after: {
          name,
          adminAccount: account,
          adminEmail: email,
          ownerUserId: String(user._id),
          roleId: String(role._id),
          moduleKeys: selected.map((module) => module.key),
          ...(logoPath === undefined ? {} : { logoPath }),
        },
      });

      // 5. 啟用信(7 天;逾期走忘記密碼自助,不重寄)
      await this.passwords.sendActivationEmail(user._id);

      return {
        org: toOrg(owned ?? org),
        ownerUserId: String(user._id),
        roleId: String(role._id),
        moduleKeys: selected.map((module) => module.key),
      };
    } catch (error) {
      await this.rollback(operator, created);
      throw error;
    }
  }

  /**
   * 撤銷開通(#374,根組織專屬):把 `provision` 建出來的三樣**反向抹掉** —
   * 租戶頂層組織、擁有者使用者、租戶管理員角色副本,以及三者身上的全部核心關聯。
   *
   * **為什麼不是「刪除組織」**:刪除的前置要求「無成員」,而擁有者要能被移出租戶又卡在
   * 「使用者至少要有一個所屬組織」(`docs/modules/user-manager.md`)與擁有者保護(ADR-0009)—
   * 兩條規則互相咬住,開錯的租戶只能停用、清不掉。撤銷是**開通的反向動作**:
   * 連同它自己建出來的擁有者與副本一起收回,所以那兩筆不算「還有別的資料」。
   *
   * **前置檢查沿用刪除的同一支函式**(`OrgsService.orgContentReasons`,reasons 語彙相同):
   * 無子組織 / 除擁有者外無其他成員 / 除副本外無其他擁有角色 / 無業務資料引用;
   * 任一不過即 `PROVISION_NOT_REVOKABLE` 附 reasons(前端逐項顯示)。
   *
   * **抹除沿用開通回滾的同一支函式**(`hardDeleteArtifacts`,`hardDeleteById` 不是軟刪除:
   * `users` 的 account / email 唯一索引含已軟刪除文件,留殭屍會讓同一組帳號永遠再也開不了 —
   * 撤銷的重點就是「同一組帳號可以重新開通」)。差別只在錯誤處理:開通回滾吞錯以免蓋掉原始錯誤,
   * 撤銷沒有原始錯誤,抹除失敗就要讓呼叫端知道。
   * 審計 `org.revoke-provision`(`audit_logs` 不在抹除範圍,ADR-0004 只增不改)。
   */
  async revokeProvision(
    operator: OperatorContext,
    input: RevokeTenantProvisionInput,
  ): Promise<RevokeTenantProvisionPayload> {
    await this.assertRootOperator(operator, AUDIT_ACTIONS.revokeProvision);
    const org = await this.requireTenantTop(operator, input.orgId);
    const ownerUserId = org.ownerUserId;
    const copy = await this.tenantAdminCopyOf(operator, org);

    const reasons = await this.orgsService.orgContentReasons(operator, org, {
      ...(ownerUserId === undefined ? {} : { userIds: [ownerUserId] }),
      ...(copy === null ? {} : { roleIds: [copy._id] }),
    });
    if (reasons.length > 0) {
      throw provisionNotRevokableError(reasons);
    }

    const artifacts: ProvisionedArtifacts = {
      links: await this.linksOfProvisionedTenant(org._id, ownerUserId, copy),
      orgId: org._id,
      ...(copy === null ? {} : { roleId: copy._id }),
      ...(ownerUserId === undefined ? {} : { userId: ownerUserId }),
    };
    await this.hardDeleteArtifacts(operator, artifacts);

    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.revokeProvision,
      targetType: AUDIT_TARGET_TYPE,
      targetId: org._id,
      before: {
        name: org.name,
        ownerUserId: ownerUserId === undefined ? null : String(ownerUserId),
        roleId: copy === null ? null : String(copy._id),
      },
    });

    return {
      success: true,
      revokedOrgId: String(org._id),
      revokedOwnerUserId:
        ownerUserId === undefined ? null : String(ownerUserId),
      revokedRoleId: copy === null ? null : String(copy._id),
    };
  }

  /** 轉移擁有者(ADR-0009:v1 僅根組織可操作);轉移後擁有者保護的對象隨之換人。 */
  async transferOwner(
    operator: OperatorContext,
    input: TransferOrgOwnerInput,
  ): Promise<Org> {
    await this.assertRootOperator(operator, AUDIT_ACTIONS.transferOwner);
    const org = await this.requireTenantTop(operator, input.orgId);
    const newOwner = await this.requireUser(operator, input.newOwnerUserId);
    if (!newOwner.enabled) {
      throw validationError(
        `User ${input.newOwnerUserId} is disabled and cannot own a tenant`,
        ["newOwnerUserId"],
      );
    }
    if (!(await this.isMemberOfTenant(operator, newOwner._id, org))) {
      throw validationError(
        `User ${input.newOwnerUserId} does not belong to tenant ${input.orgId}`,
        ["newOwnerUserId"],
      );
    }
    const previous = org.ownerUserId;
    if (previous?.equals(newOwner._id)) {
      return toOrg(org);
    }
    const updated = await this.orgs.updateById(operator, org._id, {
      $set: { ownerUserId: newOwner._id },
    });
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.transferOwner,
      targetType: AUDIT_TARGET_TYPE,
      targetId: org._id,
      before: { ownerUserId: previous === undefined ? null : String(previous) },
      after: { ownerUserId: String(newOwner._id) },
    });
    return toOrg(updated ?? org);
  }

  /**
   * 租戶作業一律只在根組織執行(docs/modules/org-manager.md):持有權限還不夠 —
   * 權限可能經角色被帶到別的組織,站在哪裡才是判準(與擁有者保護的根組織例外同一個函式)。
   *
   * 另要求**管理範圍是整個平台**(`"all"`,#187):租戶作業跨全平台寫入(在根組織底下建租戶、
   * 回頭寫它的 `ownerUserId`),而 `orgs` 是治理類 collection、寫入吃管理範圍。
   * 若操作者站在根組織、卻只持有某個租戶的角色(管理範圍 = 那個租戶),
   * 建得出租戶、`ownerUserId` 那一步卻會被過濾掉而**靜默不寫入** — 與其半套成功,不如當場拒絕。
   * 正常設定不會走到這裡:根組織的操作者持有的是擁有組織 = 根組織的角色(或超級管理員),
   * 兩者的管理範圍都是 `"all"`。
   */
  private async assertRootOperator(
    operator: OperatorContext,
    action: string,
  ): Promise<void> {
    if (
      !(await this.ownerProtection.isRootOperator(operator)) ||
      operator.managedOrgIds !== "all"
    ) {
      throw orgError(
        "FORBIDDEN",
        `${action} is only available from the root org`,
      );
    }
  }

  /** 種子的「租戶管理員」模板;沒有它代表 seed 沒跑完,屬部署問題不是使用者錯誤。 */
  private async templateRole(operator: OperatorContext): Promise<RoleRecord> {
    const template = await this.roles.findOne(operator, {
      key: TENANT_ADMIN_ROLE_KEY,
    });
    if (!template) {
      throw new Error(
        `找不到種子角色 ${TENANT_ADMIN_ROLE_KEY}(apps/db-migrator/seeds/roles.ts;seed 未跑?)`,
      );
    }
    return template;
  }

  /** 模板綁的模組(role_module)= 可開放給租戶的全部模組。 */
  private async optionModules(
    operator: OperatorContext,
    template: RoleRecord,
  ): Promise<ModuleRecord[]> {
    const moduleIds = await this.relations.listModuleIdsOfRoles([template._id]);
    if (moduleIds.length === 0) {
      return [];
    }
    return this.modules.findMany(operator, { _id: { $in: moduleIds } });
  }

  /**
   * 副本要綁的權限 = **模板綁的權限**(每個模組一筆該模組的 `*`,ADR-0004)中,
   * 擁有模組落在勾選範圍內的那些。直接取模板的綁定而不是自己組 key,
   * 模板未來多綁 / 少綁什麼,副本自動跟著,不會在這裡長出第二套規則。
   */
  private async templatePermissionIds(
    operator: OperatorContext,
    template: RoleRecord,
    selected: ModuleRecord[],
  ): Promise<Types.ObjectId[]> {
    const permissionIds = await this.relations.listPermissionIdsOfRoles([
      template._id,
    ]);
    if (permissionIds.length === 0) {
      return [];
    }
    const selectedModuleIds = new Set(
      selected.map((module) => String(module._id)),
    );
    const permissions = await this.permissions.findMany(operator, {
      _id: { $in: permissionIds },
    });
    return permissions
      .filter((permission) =>
        selectedModuleIds.has(String(permission.moduleId)),
      )
      .map((permission) => permission._id);
  }

  private async rootOrg(operator: OperatorContext): Promise<OrgRecord> {
    const root = await this.orgs.findOne(operator, { parentId: null });
    if (!root) {
      throw new Error(
        "找不到根組織(apps/db-migrator/seeds/orgs.ts;seed 未跑?)",
      );
    }
    return root;
  }

  /** 擁有者只存在於租戶頂層(根組織的直接子組織);其餘層級一律拒。 */
  private async requireTenantTop(
    operator: OperatorContext,
    id: string,
  ): Promise<OrgRecord> {
    const org = Types.ObjectId.isValid(id)
      ? await this.orgs.findById(operator, id)
      : null;
    if (org === null) {
      throw orgError("NOT_FOUND", `Org ${id} not found`);
    }
    if (!isTenantTop(org)) {
      throw validationError(
        `Org ${id} is not a tenant top-level org; the owner only exists there`,
        ["orgId"],
      );
    }
    return org;
  }

  private async requireUser(operator: OperatorContext, id: string) {
    const user = Types.ObjectId.isValid(id)
      ? await this.users.findById(operator, id)
      : null;
    if (user === null) {
      throw orgError("NOT_FOUND", `User ${id} not found`);
    }
    return user;
  }

  /** 新擁有者必須是這個租戶的人:任一所屬組織是租戶頂層自己或其子孫。 */
  private async isMemberOfTenant(
    operator: OperatorContext,
    userId: Types.ObjectId,
    tenantTop: OrgRecord,
  ): Promise<boolean> {
    const orgIds = await this.relations.listOrgIdsOfUser(userId);
    if (orgIds.length === 0) {
      return false;
    }
    const memberOrgs = await this.orgs.findMany(operator, {
      _id: { $in: orgIds },
    });
    return memberOrgs.some(
      (org) =>
        org._id.equals(tenantTop._id) ||
        org.ancestors.some((ancestor) => ancestor.equals(tenantTop._id)),
    );
  }

  /** 帳號與 Email 在 `users` 內各自唯一(ADR-0003);先問一次,不靠唯一索引的例外當流程。 */
  private async assertAccountAndEmailFree(
    operator: OperatorContext,
    account: string,
    email: string,
  ): Promise<void> {
    const clashes = await this.users.findMany(operator, {
      $or: [{ account }, { email }],
    });
    const fields = new Set<string>();
    for (const clash of clashes) {
      if (clash.account === account) {
        fields.add("adminAccount");
      }
      if (clash.email === email) {
        fields.add("adminEmail");
      }
    }
    if (fields.size > 0) {
      throw validationError(`Already taken: ${[...fields].join(", ")}`, [
        ...fields,
      ]);
    }
  }

  /** 建關聯並記進補償清單(回滾時逐筆移除)。 */
  private async link(
    operator: OperatorContext,
    created: ProvisionedArtifacts,
    links: RelationLink[],
  ): Promise<void> {
    await this.relations.linkMany(operator, links);
    created.links.push(
      ...links.map(({ type, firstId, secondId }) => ({
        type,
        firstId,
        secondId,
      })),
    );
  }

  /**
   * 這個租戶頂層底下的「租戶管理員副本」(`org_role` 擁有、`settings.templateKey` 標記;
   * 判準與擁有者保護同一條,ADR-0009 第 2 步)。找不到副本回 null —
   * 撤銷照樣走得下去,只是少抹一樣(該租戶的副本可能早被刪掉)。
   *
   * 副本不只一份時取第一份:多出來的那幾份不在豁免名單內,前置檢查會以 `OWNS_ROLES` 擋下,
   * 不會被悄悄留下成為孤兒。
   */
  private async tenantAdminCopyOf(
    operator: OperatorContext,
    org: OrgRecord,
  ): Promise<RoleRecord | null> {
    const ownedRoleIds = await this.relations.listRoleIdsOfOrg(org._id);
    if (ownedRoleIds.length === 0) {
      return null;
    }
    const owned = await this.roles.findMany(operator, {
      _id: { $in: ownedRoleIds },
    });
    return (
      owned.find(
        (role) => role.settings[TEMPLATE_KEY_SETTING] === TENANT_ADMIN_ROLE_KEY,
      ) ?? null
    );
  }

  /**
   * 要一起抹掉的核心關聯:**以「被刪的三樣」為端點反查**,不是照開通時的清單重建。
   * 開通之後可能還長出別的關聯(例如擁有者又被綁了別的角色),照清單重建會留下指向
   * 已刪除文件的孤兒關聯(ADR-0001:關聯不隨實體連動)。
   */
  private async linksOfProvisionedTenant(
    orgId: Types.ObjectId,
    ownerUserId: Types.ObjectId | undefined,
    copy: RoleRecord | null,
  ): Promise<Omit<RelationLink, "meta">[]> {
    const userIds = ownerUserId === undefined ? [] : [ownerUserId];
    const roleIds = copy === null ? [] : [copy._id];
    const found = await Promise.all([
      this.relations.listLinks("org_user", { firstIds: [orgId] }),
      this.relations.listLinks("org_role", { firstIds: [orgId] }),
      this.relations.listLinks("org_user", { secondIds: userIds }),
      this.relations.listLinks("user_role", { firstIds: userIds }),
      this.relations.listLinks("user_role", { secondIds: roleIds }),
      this.relations.listLinks("org_role", { secondIds: roleIds }),
      this.relations.listLinks("role_module", { firstIds: roleIds }),
      this.relations.listLinks("role_permission", { firstIds: roleIds }),
    ]);
    const unique = new Map<string, Omit<RelationLink, "meta">>();
    for (const link of found.flat()) {
      const { type, firstId, secondId } = link;
      unique.set(`${type}:${String(firstId)}:${String(secondId)}`, {
        type,
        firstId,
        secondId,
      });
    }
    return [...unique.values()];
  }

  /**
   * 補償刪除:反向抹掉已建立的東西。回滾自己失敗時只記 log 不蓋掉原始錯誤 —
   * 呼叫端該看到的是「為什麼開通失敗」,殘留資料由 log 交給維運處理。
   */
  private async rollback(
    operator: OperatorContext,
    created: ProvisionedArtifacts,
  ): Promise<void> {
    try {
      await this.hardDeleteArtifacts(operator, created);
    } catch (error) {
      this.logger.error(
        `開通租戶回滾失敗,可能留下殘留資料:org=${String(created.orgId)} role=${String(created.roleId)} user=${String(created.userId)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 抹掉一組「開通建出來的東西」:關聯 → 使用者 → 角色 → 組織(建立順序的反向)。
   * **硬刪除**:`users` 的 account / email 唯一索引含已軟刪除的文件,留殭屍會讓同一組帳號
   * 永遠再也開不了(ADR-0007 的軟刪除針對「還看得到的歷史」,這裡要的是「當作沒發生過」)。
   *
   * 開通回滾(`rollback`)與撤銷開通(`revokeProvision`)共用這一支,錯誤處理各自決定:
   * 回滾吞錯只記 log,撤銷讓錯誤往上丟。
   */
  private async hardDeleteArtifacts(
    operator: OperatorContext,
    artifacts: ProvisionedArtifacts,
  ): Promise<void> {
    await this.relations.unlinkMany(operator, artifacts.links);
    if (artifacts.userId) {
      await this.users.hardDeleteById(operator, artifacts.userId);
    }
    if (artifacts.roleId) {
      await this.roles.hardDeleteById(operator, artifacts.roleId);
    }
    if (artifacts.orgId) {
      await this.orgs.hardDeleteById(operator, artifacts.orgId);
    }
  }
}
