/* eslint-disable @repo/no-raw-model-query -- 此檔即 workflows 的唯一合法出口:不掛 tenantScope,改由本檔每個方法強制帶 tenantId 邊界(fail-closed);到期條件:無 */
import type { Model, Types } from "mongoose";

import { OPERATOR_LOCAL_KEY, type OperatorContext } from "./operator-context";
import type { BaseFields } from "./plugins/base-fields.plugin";
import {
  WORKFLOWS_COLLECTION,
  type Workflow,
  type WorkflowForkSource,
} from "./schemas/workflow.schema";
import { assertTenantBoundary, assertTenantOrShared } from "./tenant-boundary";

/** 已落庫的一個流程(含基礎欄位,ADR-0007)。 */
export type WorkflowRecord = Workflow & BaseFields & { _id: Types.ObjectId };

/** 查詢條件(邊界 `tenantId` 由方法參數給,不在這裡)。 */
export interface WorkflowFilter {
  key?: string | { $in: string[] };
  _id?: Types.ObjectId | { $in: Types.ObjectId[] };
}

/** 新建一個流程的內容(`ownerOrgId` 一律等於邊界 `tenantId`)。 */
export interface NewWorkflow {
  key: string;
  name: string;
  forkedFrom?: WorkflowForkSource | null;
  /** 預先配好的 id(受管定義的安裝紀錄先記下 id 再建立);一般呼叫端不給。 */
  _id?: Types.ObjectId;
}

/** 可改的欄位(`key` / `ownerOrgId` / `tenantId` 建立後不可改)。 */
export interface WorkflowChanges {
  name?: string;
  currentVersion?: number | null;
}

/** 條件更新的預期值(CAS):列出的欄位都還是這個值才寫。 */
export interface WorkflowExpectation {
  name?: string;
  currentVersion?: number | null;
}

/** 某個 key 目前被誰占用(只有身分與歸屬,不含內容)。 */
export interface WorkflowKeyOwner {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId | null;
}

/**
 * `workflows` 的存取層(`docs/data-model.md`「workflows」)。
 *
 * 流程沒有 `orgId`,不掛可見範圍插件;邊界是 `tenantId`:
 * - 租戶的客製流程:`tenantId = 租戶頂層 id`
 * - 共用流程:`tenantId = null`(root 管;**要明給 `null`**,`undefined` 會拋錯)
 *
 * 租戶「看得到的流程」= 自己的客製 + 分派給自己的共用(`org_workflow`),用 `findVisibleToTenant`。
 */
export class WorkflowsRepository {
  constructor(private readonly model: Model<Workflow>) {}

  async findMany(
    tenantId: Types.ObjectId | null | undefined,
    filter: WorkflowFilter = {},
  ): Promise<WorkflowRecord[]> {
    return this.model
      .find(
        conditionOf(
          assertTenantOrShared(tenantId, WORKFLOWS_COLLECTION),
          filter,
        ),
      )
      .sort({ createdAt: 1, _id: 1 })
      .lean<WorkflowRecord[]>()
      .exec();
  }

  async findOne(
    tenantId: Types.ObjectId | null | undefined,
    filter: WorkflowFilter,
  ): Promise<WorkflowRecord | null> {
    return this.model
      .findOne(
        conditionOf(
          assertTenantOrShared(tenantId, WORKFLOWS_COLLECTION),
          filter,
        ),
      )
      .lean<WorkflowRecord>()
      .exec();
  }

  /**
   * 某個 key 目前被誰占用(`key` 全域唯一,共用與各租戶的客製都算)。**只回身分與歸屬**,不回名稱、
   * 版本等內容 —— 給「建立前先知道會不會撞到別的租戶的流程」這種前置檢查用,不能拿來讀別租戶的流程。
   */
  async findKeyOwner(key: string): Promise<WorkflowKeyOwner | null> {
    return this.model
      .findOne({ key, deletedAt: null }, { _id: 1, tenantId: 1 })
      .lean<WorkflowKeyOwner>()
      .exec();
  }

  /**
   * 租戶看得到的流程:自己的客製(`tenantId` = 本租戶)+ 分派來的共用(`tenantId = null` 且 id 在
   * `assignedSharedIds` 內,由呼叫端從本租戶的 `org_workflow` 取)。
   */
  async findVisibleToTenant(
    tenantId: Types.ObjectId | null | undefined,
    assignedSharedIds: readonly Types.ObjectId[],
    filter: WorkflowFilter = {},
  ): Promise<WorkflowRecord[]> {
    const tenant = assertTenantBoundary(tenantId, WORKFLOWS_COLLECTION);
    return this.model
      .find({
        ...filterOf(filter),
        deletedAt: null,
        $or: [
          { tenantId: tenant },
          { tenantId: null, _id: { $in: [...assignedSharedIds] } },
        ],
      })
      .sort({ createdAt: 1, _id: 1 })
      .lean<WorkflowRecord[]>()
      .exec();
  }

  /** 新增;`ownerOrgId = tenantId`。`key` 全域唯一,撞到由唯一索引拒絕(duplicate key)。 */
  async create(
    operator: OperatorContext,
    tenantId: Types.ObjectId | null | undefined,
    workflow: NewWorkflow,
  ): Promise<WorkflowRecord> {
    const boundary = assertTenantOrShared(tenantId, WORKFLOWS_COLLECTION);
    const document = new this.model({
      ...(workflow._id === undefined ? {} : { _id: workflow._id }),
      key: workflow.key,
      name: workflow.name,
      ownerOrgId: boundary,
      tenantId: boundary,
      forkedFrom: workflow.forkedFrom ?? null,
      currentVersion: null,
    });
    // baseFields 的 save 中介層從這裡取操作者,填 createdBy / updatedBy(ADR-0007)
    document.$locals[OPERATOR_LOCAL_KEY] = operator;
    await document.save();
    return document.toObject<WorkflowRecord>();
  }

  /**
   * 條件更新(邊界內、符合 `filter` 的第一筆);回更新後的列,沒有符合者回 null。
   * `expected` 讓發布流程做 CAS(例:`currentVersion` 還是讀到的那個才寫)。
   */
  async update(
    operator: OperatorContext,
    tenantId: Types.ObjectId | null | undefined,
    filter: WorkflowFilter,
    changes: WorkflowChanges,
    expected: WorkflowExpectation = {},
  ): Promise<WorkflowRecord | null> {
    const condition = conditionOf(
      assertTenantOrShared(tenantId, WORKFLOWS_COLLECTION),
      filter,
    );
    if ("currentVersion" in expected) {
      condition.currentVersion = expected.currentVersion;
    }
    if (expected.name !== undefined) {
      condition.name = expected.name;
    }
    return this.model
      .findOneAndUpdate(
        condition,
        { $set: { ...changes, updatedBy: operator.actorId } },
        { returnDocument: "after" },
      )
      .lean<WorkflowRecord>()
      .exec();
  }
}

function filterOf(filter: WorkflowFilter): Record<string, unknown> {
  return {
    ...(filter.key === undefined ? {} : { key: filter.key }),
    ...(filter._id === undefined ? {} : { _id: filter._id }),
  };
}

function conditionOf(
  tenantId: Types.ObjectId | null,
  filter: WorkflowFilter,
): Record<string, unknown> {
  return { ...filterOf(filter), tenantId, deletedAt: null };
}
