import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import type { Persisted } from "../database/base.repository";
import {
  CustomersRepository,
  DemoItemsOneRepository,
  DemoItemsTwoRepository,
  FieldsRepository,
  type OrgDocument,
  OrgsRepository,
} from "../database/database.module";
import {
  type OperatorContext,
  isOrgVisible,
} from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { isOwnedUploadPath } from "../storage/storage.service";
import type { CreateChildOrgInput } from "./dto/create-child-org.input";
import type { DeleteOrgInput } from "./dto/delete-org.input";
import type { MoveOrgInput } from "./dto/move-org.input";
import type { SetOrgEnabledInput } from "./dto/set-org-enabled.input";
import type { UpdateOrgInput } from "./dto/update-org.input";
import { Org, OrgNode, OrgVisibility } from "./models/org.model";
import type { DeletePayload } from "./models/org-payloads.model";
import {
  type OrgNotDeletableReason,
  orgError,
  orgNotDeletableError,
} from "./org-error";

/** 一筆讀回來的組織(含基礎欄位,ADR-0007)。 */
type OrgRecord = Persisted<OrgDocument>;

/** `orgs.settings.visibility` 的值(ADR-0005;未設視為 "own")。 */
const VISIBILITY_SUBTREE = "subtree";

/** 審計動作名(docs/modules/org-manager.md「審計」;`targetType` 一律 org)。 */
const AUDIT_TARGET_TYPE = "org";
const AUDIT_ACTIONS = {
  createChild: "org.create-child",
  edit: "org.edit",
  toggleEnabled: "org.toggle-enabled",
  move: "org.move",
  delete: "org.delete",
} as const;

/** 編輯可動的欄位(擁有者與可見範圍開關屬租戶作業 #135,不在此)。 */
type EditablePath = "name" | "description" | "logoPath";

/** 一個欄位的變動;`value` / `previous` 為 undefined 代表「沒有值 / 清空」。 */
interface OrgFieldChange {
  path: EditablePath;
  value: string | undefined;
  previous: string | undefined;
}

/**
 * 讀 / 寫「操作者已確認可操作的組織」底下整棵子樹時用的上下文:可見範圍暫時提升為 `"all"`。
 *
 * **只准搭配把查詢釘在該子樹內的條件**(`ancestors: <已驗過的組織 id>`,或由那種查詢取回的 id)。
 * 理由:可見範圍決定「看得到誰的資料」(ADR-0005),但停用連動、搬移後的 `ancestors` 重算、
 * 刪除前置的「有沒有子組織」三件事的正確性以**整棵子樹**為準 —
 * 不能因為操作者的可見範圍是 own 就只改一半、或誤判成沒有子組織。
 */
function subtreeContext(operator: OperatorContext): OperatorContext {
  return { ...operator, visibleOrgIds: "all" };
}

/** 租戶頂層 id(`ancestors` = [根, 租戶頂層, …];自己就是租戶頂層 / 根組織時回自己)。 */
function tenantTopIdOf(org: OrgRecord): Types.ObjectId {
  return org.ancestors[1] ?? org._id;
}

/** 可見範圍開關只掛在租戶頂層(`ancestors` 只有根組織一層);其餘組織恆為 null。 */
function visibilityOf(org: OrgRecord): OrgVisibility | null {
  if (org.ancestors.length !== 1) {
    return null;
  }
  return org.settings.visibility === VISIBILITY_SUBTREE
    ? OrgVisibility.SUBTREE
    : OrgVisibility.OWN;
}

function toOrg(org: OrgRecord): Org {
  return {
    id: String(org._id),
    name: org.name,
    ...(org.description === undefined ? {} : { description: org.description }),
    parentId: org.parentId === null ? null : String(org.parentId),
    enabled: org.enabled,
    isSystem: org.isSystem,
    ownerUserId: org.ownerUserId === undefined ? null : String(org.ownerUserId),
    visibility: visibilityOf(org),
    ...(org.logoPath === undefined ? {} : { logoPath: org.logoPath }),
  };
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

/** 由平坦的組織清單組回樹;`rootIds` 是本樹的根(對外 `parentId` 回 null)。 */
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
    // 可見範圍外:樹上照樣顯示(不然樹會斷),但前端不讓選、不讓操作(ADR-0005)
    disabled: !isOrgVisible(operator, document._id),
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
  ) {}

  /**
   * 可見範圍內的組織樹(ADR-0005):根組織視角以根組織為根、看得到全部租戶;
   * 租戶視角以**租戶頂層**為根。可見範圍外的節點照樣回,標 `disabled`。
   */
  async tree(operator: OperatorContext): Promise<OrgNode[]> {
    const rootIds = await this.treeRootIds(operator);
    if (rootIds.length === 0) {
      return [];
    }
    // 讀取範圍由 rootIds 釘死在「操作者的租戶(們)」內,再以 disabled 標出範圍外的節點
    const documents = await this.orgs.findMany(subtreeContext(operator), {
      $or: [{ _id: { $in: rootIds } }, { ancestors: { $in: rootIds } }],
    });
    return buildForest(operator, documents, rootIds);
  }

  /** 單一組織:可見範圍外視為不存在(不透露差別)。 */
  async one(operator: OperatorContext, id: string): Promise<Org> {
    return toOrg(await this.requireVisible(operator, id));
  }

  async createChild(
    operator: OperatorContext,
    input: CreateChildOrgInput,
  ): Promise<Org> {
    const name = requireName(input.name);
    const description = optionalText(input.description);
    const parent = await this.requireVisible(operator, input.parentId);
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
    const current = await this.requireVisible(operator, input.id);
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
    return toOrg(updated ?? current);
  }

  /**
   * 停用 / 啟用:**停用連動整棵子樹**;啟用只啟用自己這一節,下層各自處理
   * (docs/modules/org-manager.md「停用 / 啟用」)。根組織不可停用 — 停掉等於整個平台關門。
   */
  async setEnabled(
    operator: OperatorContext,
    input: SetOrgEnabledInput,
  ): Promise<Org> {
    const current = await this.requireVisible(operator, input.id);
    if (current.isSystem && !input.enabled) {
      throw orgError("VALIDATION_FAILED", "System org cannot be disabled");
    }
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
   * 搬移:限同租戶(`CROSS_TENANT`)、不可搬進自己的子樹(`CYCLIC_MOVE`);
   * 成功後整棵子樹的 `ancestors` 重算(物化路徑,ADR-0005)。
   */
  async move(operator: OperatorContext, input: MoveOrgInput): Promise<Org> {
    const org = await this.requireVisible(operator, input.id);
    if (org.parentId === null || org.isSystem) {
      throw orgError("VALIDATION_FAILED", "System org cannot be moved");
    }
    const newParent = await this.requireVisible(operator, input.newParentId);
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
   */
  async remove(
    operator: OperatorContext,
    input: DeleteOrgInput,
  ): Promise<DeletePayload> {
    const org = await this.requireVisible(operator, input.id);
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

  /** 本樹的根:根組織視角 = 根組織;租戶視角 = 可見組織們各自的租戶頂層。 */
  private async treeRootIds(
    operator: OperatorContext,
  ): Promise<Types.ObjectId[]> {
    if (operator.visibleOrgIds === "all") {
      const root = await this.orgs.findOne(operator, { parentId: null });
      return root === null ? [] : [root._id];
    }
    const visible = await this.orgs.findMany(operator, {
      _id: { $in: operator.visibleOrgIds },
    });
    const tops = new Map<string, Types.ObjectId>();
    for (const org of visible) {
      const topId = tenantTopIdOf(org);
      tops.set(String(topId), topId);
    }
    return [...tops.values()];
  }

  private async requireVisible(
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
    const ownedRoleIds = await this.relations.listRoleIdsOfOrg(org._id);
    if (ownedRoleIds.length > 0) {
      reasons.push("OWNS_ROLES");
    }
    if (await this.hasBusinessData(operator, org._id)) {
      reasons.push("HAS_BUSINESS_DATA");
    }
    return reasons;
  }

  /**
   * 「無業務資料引用」:掛在這個組織下的租戶資料(`orgId` 指向它)。
   * 清單 = 目前有 `orgId` 的業務 collection;第 5 段示範模組長出新 collection 時在此加一項。
   * `audit_logs` 刻意不算 — 那是只增不改的歷史紀錄(ADR-0004),不是被引用的業務資料。
   */
  private async hasBusinessData(
    operator: OperatorContext,
    orgId: Types.ObjectId,
  ): Promise<boolean> {
    const counts = await Promise.all([
      this.customers.count(operator, { orgId }),
      this.demoItemsOne.count(operator, { orgId }),
      this.demoItemsTwo.count(operator, { orgId }),
      this.fields.count(operator, { orgId }),
    ]);
    return counts.some((count) => count > 0);
  }
}
