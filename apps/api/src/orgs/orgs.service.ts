import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import {
  CustomersRepository,
  DemoItemsOneRepository,
  DemoItemsTwoRepository,
  FieldsRepository,
  OrgsRepository,
  RolesRepository,
} from "../database/database.module";
import {
  type OperatorContext,
  isOrgManaged,
} from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { StorageService, isOwnedUploadPath } from "../storage/storage.service";
import type { CreateChildOrgInput } from "./dto/create-child-org.input";
import type { DeleteOrgInput } from "./dto/delete-org.input";
import type { MoveOrgInput } from "./dto/move-org.input";
import type { SetOrgEnabledInput } from "./dto/set-org-enabled.input";
import type { SetOrgVisibilityInput } from "./dto/set-org-visibility.input";
import type { UpdateOrgInput } from "./dto/update-org.input";
import type { DeletePayload } from "./models/org-payloads.model";
import { type Org, OrgNode } from "./models/org.model";
import {
  type OrgNotDeletableReason,
  orgError,
  orgNotDeletableError,
} from "./org-error";
import {
  type OrgRecord,
  VISIBILITY_SETTING,
  isTenantTop,
  tenantTopIdOf,
  toOrg,
  visibilityOf,
  visibilitySettingOf,
} from "./org-mapper";
import { OwnerProtectionService } from "./owner-protection.service";

/** 審計動作名(docs/modules/org-manager.md「審計」;`targetType` 一律 org)。 */
const AUDIT_TARGET_TYPE = "org";
const AUDIT_ACTIONS = {
  createChild: "org.create-child",
  edit: "org.edit",
  toggleEnabled: "org.toggle-enabled",
  move: "org.move",
  delete: "org.delete",
  setVisibility: "org.set-visibility",
} as const;

/** 編輯可動的欄位(擁有者屬租戶作業 #135、可見範圍開關另有 mutation,都不在此)。 */
type EditablePath = "name" | "description" | "logoPath";

/** 一個欄位的變動;`value` / `previous` 為 undefined 代表「沒有值 / 清空」。 */
interface OrgFieldChange {
  path: EditablePath;
  value: string | undefined;
  previous: string | undefined;
}

/**
 * 讀 / 寫「操作者已確認可操作的組織」底下整棵子樹時用的上下文:**兩個範圍**暫時提升為 `"all"`。
 *
 * **只准搭配把查詢釘在該子樹內的條件**(`ancestors: <已驗過的組織 id>`,或由那種查詢取回的 id)。
 * 理由:管理範圍決定「動得了誰」(ADR-0005),但停用連動、搬移後的 `ancestors` 重算、
 * 刪除前置的「有沒有子組織」三件事的正確性以**整棵子樹**為準 —
 * 不能因為操作者的管理範圍只到某一層就只改一半、或誤判成沒有子組織。
 * 管理範圍換掉可見範圍成為治理類的過濾依據後(#187),兩個都要放開才擋得住漏改。
 */
function subtreeContext(operator: OperatorContext): OperatorContext {
  return { ...operator, visibleOrgIds: "all", managedOrgIds: "all" };
}

/** 名稱是必填且不可只有空白;回傳去空白後的值。 */
function requireName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw orgError("VALIDATION_FAILED", "Org name must not be empty");
  }
  return trimmed;
}

/** 空白 / 空字串視同「清空這個欄位」。 */
function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? undefined : trimmed;
}

/** 商標只收本 API 自己簽出來的路徑,不讓呼叫端把任意 bucket 物件塞進 DB(ADR-0010)。 */
function ownedLogoPath(value: string | null): string | undefined {
  const logoPath = optionalText(value);
  if (logoPath !== undefined && !isOwnedUploadPath(logoPath)) {
    throw orgError(
      "VALIDATION_FAILED",
      `logoPath ${logoPath} was not issued by createUploadUrl`,
    );
  }
  return logoPath;
}

/** 算出這次編輯真正變動的欄位(沒變的不寫、不入審計)。 */
function editChangesOf(
  input: UpdateOrgInput,
  current: OrgRecord,
): OrgFieldChange[] {
  const changes: OrgFieldChange[] = [];
  if (input.name !== undefined && input.name !== null) {
    const name = requireName(input.name);
    if (name !== current.name) {
      changes.push({ path: "name", value: name, previous: current.name });
    }
  }
  if (input.description !== undefined) {
    const description = optionalText(input.description);
    if (description !== current.description) {
      changes.push({
        path: "description",
        value: description,
        previous: current.description,
      });
    }
  }
  if (input.logoPath !== undefined) {
    const logoPath = ownedLogoPath(input.logoPath);
    if (logoPath !== current.logoPath) {
      changes.push({
        path: "logoPath",
        value: logoPath,
        previous: current.logoPath,
      });
    }
  }
  return changes;
}

/** 變動清單 → Mongo update(有值 `$set`、清空 `$unset`)。 */
function updateOf(changes: OrgFieldChange[]): Record<string, unknown> {
  const set: Record<string, string> = {};
  const unset: Record<string, ""> = {};
  for (const change of changes) {
    if (change.value === undefined) {
      unset[change.path] = "";
    } else {
      set[change.path] = change.value;
    }
  }
  return {
    ...(Object.keys(set).length === 0 ? {} : { $set: set }),
    ...(Object.keys(unset).length === 0 ? {} : { $unset: unset }),
  };
}

/** 變動清單 → 審計的 before / after(只放有變的欄位;清空記成 null)。 */
function auditSideOf(
  changes: OrgFieldChange[],
  side: "value" | "previous",
): Record<string, unknown> {
  return Object.fromEntries(
    changes.map((change) => [change.path, change[side] ?? null]),
  );
}

/** 同層依名稱排序,讓樹的順序穩定(不依賴寫入順序)。 */
function byName(documents: OrgRecord[]): OrgRecord[] {
  return documents.toSorted((left, right) =>
    left.name.localeCompare(right.name),
  );
}

/**
 * 由平坦的組織清單組回樹(森林:`rootIds` 可能有多個根,#187)。
 *
 * 每棵樹的樹根對外一律回 `parentId: null`(它的上層不在樹上,給了前端也查不到)。
 * 因此**前端不能拿 `parentId` 判斷「樹根是不是平台根組織」** — 租戶視角的樹根也是 null;
 * 那件事由 `org(樹根).isSystem` 回答(#186 ④,`useOrgManagerData.ts`)。
 */
function buildForest(
  operator: OperatorContext,
  documents: OrgRecord[],
  rootIds: Types.ObjectId[],
): OrgNode[] {
  const rootKeys = new Set(rootIds.map(String));
  const childrenByParent = new Map<string, OrgRecord[]>();
  for (const document of documents) {
    if (document.parentId === null || rootKeys.has(String(document._id))) {
      continue;
    }
    const key = String(document.parentId);
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(document);
    childrenByParent.set(key, siblings);
  }
  const toNode = (document: OrgRecord): OrgNode => ({
    id: String(document._id),
    name: document.name,
    parentId:
      rootKeys.has(String(document._id)) || document.parentId === null
        ? null
        : String(document.parentId),
    enabled: document.enabled,
    // 僅租戶頂層有值(ADR-0009);樹上就給,前端不必逐筆查 org(id) 才判斷得出擁有者(#139)
    ownerUserId:
      document.ownerUserId === undefined ? null : String(document.ownerUserId),
    // 管理範圍外的節點根本不會出現在樹上(#187),這個欄位因此恆為 false;
    // 保留是為了與使用者列的 `roles[].outOfScope` 命名一致、且不必同步改前端(GQL-05 相容)
    outOfScope: !isOrgManaged(operator, document._id),
    children: byName(childrenByParent.get(String(document._id)) ?? []).map(
      (child) => toNode(child),
    ),
  });
  const roots = documents.filter((document) =>
    rootKeys.has(String(document._id)),
  );
  return byName(roots).map((document) => toNode(document));
}

/**
 * 組織管理(docs/modules/org-manager.md)的業務邏輯:resolver 薄、service 厚(STRUCT-01)。
 * 資料存取一律經 OrgsRepository / RelationService;每個寫入動作由 resolver 以
 * `@RequirePermission` 守門,本層負責規則、審計與錯誤碼。
 */
@Injectable()
export class OrgsService {
  constructor(
    private readonly orgs: OrgsRepository,
    private readonly relations: RelationService,
    private readonly audit: AuditService,
    private readonly customers: CustomersRepository,
    private readonly demoItemsOne: DemoItemsOneRepository,
    private readonly demoItemsTwo: DemoItemsTwoRepository,
    private readonly fields: FieldsRepository,
    private readonly roles: RolesRepository,
    private readonly protection: OwnerProtectionService,
    private readonly storage: StorageService,
  ) {}

  private readonly logger = new Logger(OrgsService.name);

  /**
   * **管理範圍**的組織樹(CONTEXT.md「管理範圍」;ADR-0005 的分工表)。
   * 根 = 管理範圍的各個頂點,**可能有多個**(持兩個沒有共同上層的角色就有兩棵樹);
   * 根組織成員以根組織為根、看得到全部租戶。管理範圍外的組織**不出現**在樹上。
   */
  async tree(operator: OperatorContext): Promise<OrgNode[]> {
    const rootIds = await this.treeRootIds(operator);
    if (rootIds.length === 0) {
      return [];
    }
    // 讀取範圍由 rootIds 釘死在「管理範圍的各頂點子樹」內 = 管理範圍本身
    const documents = await this.orgs.findMany(subtreeContext(operator), {
      $or: [{ _id: { $in: rootIds } }, { ancestors: { $in: rootIds } }],
    });
    return buildForest(operator, documents, rootIds);
  }

  /** 單一組織:管理範圍外視為不存在(不透露差別)。 */
  async one(operator: OperatorContext, id: string): Promise<Org> {
    return toOrg(await this.requireManaged(operator, id));
  }

  async createChild(
    operator: OperatorContext,
    input: CreateChildOrgInput,
  ): Promise<Org> {
    const name = requireName(input.name);
    const description = optionalText(input.description);
    const parent = await this.requireManaged(operator, input.parentId);
    const created = await this.orgs.create(operator, {
      name,
      parentId: parent._id,
      ancestors: [...parent.ancestors, parent._id],
      enabled: true,
      isSystem: false,
      settings: {},
      ...(description === undefined ? {} : { description }),
    });
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.createChild,
      targetType: AUDIT_TARGET_TYPE,
      targetId: created._id,
      after: {
        name,
        parentId: String(parent._id),
        ...(description === undefined ? {} : { description }),
      },
    });
    return toOrg(created);
  }

  /**
   * 編輯:名稱、描述、商標三個欄位。沒有任何欄位真的變動時不寫入、也不留審計
   * (審計的 before / after 只放有變的欄位,空紀錄是雜訊)。
   */
  async update(operator: OperatorContext, input: UpdateOrgInput): Promise<Org> {
    const current = await this.requireManaged(operator, input.id);
    const changes = editChangesOf(input, current);
    if (changes.length === 0) {
      return toOrg(current);
    }
    const updated = await this.orgs.updateById(
      operator,
      current._id,
      updateOf(changes),
    );
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.edit,
      targetType: AUDIT_TARGET_TYPE,
      targetId: current._id,
      before: auditSideOf(changes, "previous"),
      after: auditSideOf(changes, "value"),
    });
    await this.discardReplacedLogo(changes);
    return toOrg(updated ?? current);
  }

  /**
   * 換商標 / 清空商標之後,把**舊的**物件刪掉(#161:換圖即刪舊;ADR-0010)。
   *
   * 只在更新已經成功之後做,而且**刪不掉只記 warn、不往外拋** — 清不掉的後果是 bucket 裡
   * 留一個沒人引用的孤兒物件(幾百 KB),不該因此讓使用者的編輯失敗、更不該回滾已寫好的資料。
   * `changes` 只會在新值與舊值真的不同時帶 `logoPath`,所以「送同一張圖」不會走到這裡;
   * 舊值不是本 API 簽出來的路徑(歷史殘留 / 被塞進來的值)由 `deleteObject` 的
   * `isOwnedUploadPath` 擋下,不會刪到任意物件。
   */
  private async discardReplacedLogo(changes: OrgFieldChange[]): Promise<void> {
    const previous = changes.find(
      (change) => change.path === "logoPath",
    )?.previous;
    if (previous === undefined) {
      return;
    }
    try {
      await this.storage.deleteObject(previous);
    } catch (error) {
      this.logger.warn(
        `舊商標 ${previous} 刪除失敗,bucket 會留下孤兒物件:${String(error)}`,
      );
    }
  }

  /**
   * 停用 / 啟用:**停用連動整棵子樹**;啟用只啟用自己這一節,下層各自處理
   * (docs/modules/org-manager.md「停用 / 啟用」)。根組織不可停用 — 停掉等於整個平台關門。
   */
  async setEnabled(
    operator: OperatorContext,
    input: SetOrgEnabledInput,
  ): Promise<Org> {
    const current = await this.requireManaged(operator, input.id);
    if (current.isSystem && !input.enabled) {
      throw orgError("VALIDATION_FAILED", "System org cannot be disabled");
    }
    // 租戶頂層只有根組織能停用 / 啟用(ADR-0009);租戶內的人只能動子組織
    await this.protection.assertTenantTopOperableBy(
      operator,
      current,
      "set-enabled",
    );
    const updated = await this.orgs.updateById(operator, current._id, {
      $set: { enabled: input.enabled },
    });
    const cascaded = input.enabled
      ? 0
      : await this.orgs.updateMany(
          subtreeContext(operator),
          { ancestors: current._id },
          { $set: { enabled: false } },
        );
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.toggleEnabled,
      targetType: AUDIT_TARGET_TYPE,
      targetId: current._id,
      before: { enabled: current.enabled },
      after: {
        enabled: input.enabled,
        ...(input.enabled ? {} : { cascadedDescendants: cascaded }),
      },
    });
    return toOrg(updated ?? current);
  }

  /**
   * 搬移:候選 = **管理範圍內、同租戶、不在自己這棵子樹裡**(docs/modules/org-manager.md)。
   * 範圍外 `NOT_FOUND`、跨租戶 `CROSS_TENANT`、搬進自己的子樹 `CYCLIC_MOVE`、
   * 租戶頂層本身 `FORBIDDEN`;成功後整棵子樹的 `ancestors` 重算(物化路徑,ADR-0005)。
   */
  async move(operator: OperatorContext, input: MoveOrgInput): Promise<Org> {
    const org = await this.requireManaged(operator, input.id);
    if (org.parentId === null || org.isSystem) {
      throw orgError("VALIDATION_FAILED", "System org cannot be moved");
    }
    // 租戶頂層只有根組織能搬(跨租戶的檢查在下面另外擋,ADR-0009)
    await this.protection.assertTenantTopOperableBy(operator, org, "move");
    // 新上層也必須在管理範圍內(治理類過濾自動套用:範圍外即 NOT_FOUND)
    const newParent = await this.requireManaged(operator, input.newParentId);
    if (
      newParent._id.equals(org._id) ||
      newParent.ancestors.some((ancestor) => ancestor.equals(org._id))
    ) {
      throw orgError(
        "CYCLIC_MOVE",
        `Org ${input.id} cannot be moved under itself or its own descendant`,
      );
    }
    if (!tenantTopIdOf(org).equals(tenantTopIdOf(newParent))) {
      throw orgError(
        "CROSS_TENANT",
        `Org ${input.id} and new parent ${input.newParentId} belong to different tenants`,
      );
    }
    if (org.parentId.equals(newParent._id)) {
      return toOrg(org);
    }

    const ancestors = [...newParent.ancestors, newParent._id];
    const updated = await this.orgs.updateById(operator, org._id, {
      $set: { parentId: newParent._id, ancestors },
    });
    const moved = await this.reparentDescendants(operator, org, ancestors);
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.move,
      targetType: AUDIT_TARGET_TYPE,
      targetId: org._id,
      before: { parentId: String(org.parentId) },
      after: { parentId: String(newParent._id), movedDescendants: moved },
    });
    return toOrg(updated ?? org);
  }

  /**
   * 刪除:前置四項(無子組織 / 無成員 / 非角色擁有組織 / 無業務資料引用)全過才可;
   * 任一不過回 `ORG_NOT_DELETABLE` 附 reasons,前端提示改用停用。刪除 = 軟刪除(ADR-0007)。
   * 「非角色擁有組織」**只算存活的角色**(#246 的 5,見 `ownsAliveRole`)。
   */
  async remove(
    operator: OperatorContext,
    input: DeleteOrgInput,
  ): Promise<DeletePayload> {
    const org = await this.requireManaged(operator, input.id);
    // 租戶頂層只有根組織能刪(ADR-0009);先於前置四項判斷,不透露租戶內部狀態
    await this.protection.assertTenantTopOperableBy(operator, org, "delete");
    const reasons = await this.notDeletableReasons(operator, org);
    if (reasons.length > 0) {
      throw orgNotDeletableError(reasons);
    }
    await this.orgs.softDeleteById(operator, org._id);
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.delete,
      targetType: AUDIT_TARGET_TYPE,
      targetId: org._id,
      before: {
        name: org.name,
        parentId: org.parentId === null ? null : String(org.parentId),
      },
    });
    return { success: true, deletedId: String(org._id) };
  }

  /**
   * 可見範圍開關(ADR-0005):只掛**租戶頂層**、套用整棵子樹,改的是租戶自己的資料政策
   * (下層使用者看不看得到下層組織的**業務資料**),**不影響治理頁、角色資格與管理範圍**。
   *
   * 2026-09-19 起不再是根組織專屬(#187):權限由 `system.org-manager.tenant-ops.set-visibility`
   * 搬到 `system.org-manager.set-visibility`,租戶管理員模板自動取得;
   * 能設哪些則由**管理範圍**決定 — 範圍外的租戶頂層查不到(`NOT_FOUND`),
   * 所以租戶管理員只設得了自己的租戶,根組織(範圍 = 全部)照樣設得了任何一個。
   */
  async setVisibility(
    operator: OperatorContext,
    input: SetOrgVisibilityInput,
  ): Promise<Org> {
    const org = await this.requireManaged(operator, input.orgId);
    if (!isTenantTop(org)) {
      const error = orgError(
        "VALIDATION_FAILED",
        `Org ${input.orgId} is not a tenant top-level org; the visibility switch only exists there`,
      );
      (error.extensions as Record<string, unknown>).fields = ["orgId"];
      throw error;
    }
    const previous = visibilityOf(org);
    if (previous === input.visibility) {
      return toOrg(org);
    }
    const updated = await this.orgs.updateById(operator, org._id, {
      $set: {
        [`settings.${VISIBILITY_SETTING}`]: visibilitySettingOf(
          input.visibility,
        ),
      },
    });
    await this.audit.record(operator, {
      action: AUDIT_ACTIONS.setVisibility,
      targetType: AUDIT_TARGET_TYPE,
      targetId: org._id,
      before: { visibility: previous },
      after: { visibility: input.visibility },
    });
    return toOrg(updated ?? org);
  }

  /**
   * 樹根 = **管理範圍的各個頂點**(#187):管理範圍是「各擁有組織的子樹」的聯集,
   * 頂點就是那些「祖先鏈上沒有別的管理範圍內組織」的節點 — 一個角色一個頂點,
   * 上下包含關係的角色自動收斂成一個。`"all"`(超級管理員 / 擁有組織是根組織)= 根組織一棵。
   */
  private async treeRootIds(
    operator: OperatorContext,
  ): Promise<Types.ObjectId[]> {
    if (operator.managedOrgIds === "all") {
      const root = await this.orgs.findOne(operator, { parentId: null });
      return root === null ? [] : [root._id];
    }
    if (operator.managedOrgIds.length === 0) {
      return [];
    }
    const managed = await this.orgs.findMany(operator, {
      _id: { $in: operator.managedOrgIds },
    });
    const managedKeys = new Set(managed.map((org) => String(org._id)));
    return managed
      .filter(
        (org) =>
          !org.ancestors.some((ancestor) => managedKeys.has(String(ancestor))),
      )
      .map((org) => org._id);
  }

  /** 管理範圍外(治理類過濾自動套用)視為不存在 — 不透露「存在但你動不了」。 */
  private async requireManaged(
    operator: OperatorContext,
    id: string,
  ): Promise<OrgRecord> {
    const org = Types.ObjectId.isValid(id)
      ? await this.orgs.findById(operator, id)
      : null;
    if (org === null) {
      throw orgError("NOT_FOUND", `Org ${id} not found`);
    }
    return org;
  }

  /** 搬移後重算子樹的 `ancestors`:把「到被搬組織為止」的前段換成它的新祖先鏈。 */
  private async reparentDescendants(
    operator: OperatorContext,
    org: OrgRecord,
    ancestors: Types.ObjectId[],
  ): Promise<number> {
    const subtree = subtreeContext(operator);
    const descendants = await this.orgs.findMany(subtree, {
      ancestors: org._id,
    });
    for (const descendant of descendants) {
      const index = descendant.ancestors.findIndex((ancestor) =>
        ancestor.equals(org._id),
      );
      const tail = index === -1 ? [org._id] : descendant.ancestors.slice(index);
      await this.orgs.updateById(subtree, descendant._id, {
        $set: { ancestors: [...ancestors, ...tail] },
      });
    }
    return descendants.length;
  }

  private async notDeletableReasons(
    operator: OperatorContext,
    org: OrgRecord,
  ): Promise<OrgNotDeletableReason[]> {
    const reasons: OrgNotDeletableReason[] = [];
    if (org.isSystem || org.parentId === null) {
      reasons.push("SYSTEM_ORG");
    }
    // 子組織以整棵子樹判定(可見範圍外也算),不然可見範圍 own 的人會誤判成沒有子組織
    const children = await this.orgs.count(subtreeContext(operator), {
      ancestors: org._id,
    });
    if (children > 0) {
      reasons.push("HAS_CHILDREN");
    }
    const memberIds = await this.relations.listUserIdsOfOrg(org._id);
    if (memberIds.length > 0) {
      reasons.push("HAS_MEMBERS");
    }
    if (await this.ownsAliveRole(operator, org._id)) {
      reasons.push("OWNS_ROLES");
    }
    if (await this.hasBusinessData(operator, org._id)) {
      reasons.push("HAS_BUSINESS_DATA");
    }
    return reasons;
  }

  /**
   * 「非角色擁有組織」前置:**只算存活的角色**(#246 的 5)。
   *
   * `org_role` 關聯在角色被軟刪除時刻意不動(ADR-0007 軟刪除、ADR-0001 關聯不連動),
   * 所以光看關聯會把「角色都刪光了」的組織永遠判成不可刪。角色文件經 `this.roles` 讀,
   * `deletedAt` 有值的預設就查不到(ADR-0007),過濾因此不必寫在這裡。
   * 上下文用 `subtreeContext`:`roles` 沒掛租戶過濾,但前置檢查問的是「有沒有」,
   * 不是「你看不看得到」— 與 `hasBusinessData` 同一條理由。
   */
  private async ownsAliveRole(
    operator: OperatorContext,
    orgId: Types.ObjectId,
  ): Promise<boolean> {
    const ownedRoleIds = await this.relations.listRoleIdsOfOrg(orgId);
    if (ownedRoleIds.length === 0) {
      return false;
    }
    const alive = await this.roles.count(subtreeContext(operator), {
      _id: { $in: ownedRoleIds },
    });
    return alive > 0;
  }

  /**
   * 「無業務資料引用」:掛在這個組織下的租戶資料(`orgId` 指向它)。
   * 清單 = 目前有 `orgId` 的業務 collection;第 5 段示範模組長出新 collection 時在此加一項。
   * `audit_logs` 刻意不算 — 那是只增不改的歷史紀錄(ADR-0004),不是被引用的業務資料。
   *
   * **以 `subtreeContext` 問**(查詢已釘死在這一個已驗過的組織上):業務 collection 吃的是
   * **可見範圍**,而刪除的資格吃**管理範圍**(ADR-0005 的分工)— 兩者不一定重疊。
   * 若用操作者自己的可見範圍去數,管得到但看不到那個組織的人會數到 0,
   * 把還掛著資料的組織誤判成可刪。前置檢查要問「有沒有」,不是「你看不看得到」。
   */
  private async hasBusinessData(
    operator: OperatorContext,
    orgId: Types.ObjectId,
  ): Promise<boolean> {
    const reader = subtreeContext(operator);
    const counts = await Promise.all([
      this.customers.count(reader, { orgId }),
      this.demoItemsOne.count(reader, { orgId }),
      this.demoItemsTwo.count(reader, { orgId }),
      this.fields.count(reader, { orgId }),
    ]);
    return counts.some((count) => count > 0);
  }
}
