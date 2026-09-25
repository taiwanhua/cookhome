/* eslint-disable @repo/no-raw-model-query -- 審核流程對 form_submissions 的系統讀寫:審核者 / 背景推進不在申請人組織的可見範圍內、也不該被資料範圍規則(含「全部操作者」對象的規則)擋掉,改以 tenantId 為邊界(fail-closed);只給引擎、授權判斷與申請中心用;到期條件:無 */
import type { Model, Types, mongo } from "mongoose";

import type { BaseFields } from "./plugins/base-fields.plugin";
import type { FormSubmission } from "./schemas/form-submission.schema";
import { assertTenantBoundary } from "./tenant-boundary";

/** 已落庫的一筆提交(原生驅動讀出的形狀;含基礎欄位)。 */
export type SubmissionSnapshotRecord = FormSubmission &
  BaseFields & { _id: Types.ObjectId };

type SubmissionCollection = mongo.Collection<SubmissionSnapshotRecord>;

/** 查詢條件(`tenantId` 與軟刪除排除由方法補上)。 */
export type SubmissionFilter = mongo.Filter<SubmissionSnapshotRecord>;

type SubmissionUpdate = mongo.UpdateFilter<SubmissionSnapshotRecord>;

/** 列表的排序 / 分頁。 */
export interface SubmissionPage {
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
}

/**
 * 審核流程要的 `form_submissions` 存取(Spec 6b §3「誰能看那筆提交」、§6 列 2 / 5 / 8 的提交同步)。
 *
 * **為什麼不經 `FormSubmissionsRepository`**:那一層一定套可見範圍與資料範圍規則(ADR-0005 / ADR-0008),
 * 但審核流程的讀寫者不一定看得到那筆提交 —— 上層主管、別部門的審核者、沒有操作者的背景推進;
 * 而資料範圍規則可以對「全部操作者」生效,系統上下文也會被收窄。所以這裡直接用原生 collection,
 * **每個方法第一個參數就是 `tenantId`**(沒給拋錯),並一律排除軟刪除。
 *
 * 呼叫端負責「這個人可不可以讀 / 寫這筆」:讀取授權是 `canReadSubmissionRevision`,
 * 寫入只有引擎的條件同步(提交仍指向本實例、修訂號相符、審核中)與作廢。
 */
export class WorkflowSubmissionStore {
  constructor(private readonly model: Model<FormSubmission>) {}

  private get collection(): SubmissionCollection {
    return this.model.collection as unknown as SubmissionCollection;
  }

  async findById(
    tenantId: Types.ObjectId | null | undefined,
    id: Types.ObjectId,
  ): Promise<SubmissionSnapshotRecord | null> {
    return this.collection.findOne(conditionOf(tenantId, { _id: id }));
  }

  async findMany(
    tenantId: Types.ObjectId | null | undefined,
    filter: SubmissionFilter,
    page?: SubmissionPage,
  ): Promise<SubmissionSnapshotRecord[]> {
    return this.collection
      .find(
        conditionOf(tenantId, filter),
        page ? { sort: page.sort, skip: page.skip, limit: page.limit } : {},
      )
      .toArray();
  }

  count(
    tenantId: Types.ObjectId | null | undefined,
    filter: SubmissionFilter,
  ): Promise<number> {
    return this.collection.countDocuments(conditionOf(tenantId, filter));
  }

  /**
   * 條件更新一筆(引擎的提交同步:條件含 `currentInstanceId` / `revision` / `status`);
   * 回是否真的命中。`updatedAt` / `updatedBy` 在這裡補(原生驅動不經 timestamps 中介層)。
   */
  async updateOne(
    tenantId: Types.ObjectId | null | undefined,
    filter: SubmissionFilter,
    set: Record<string, unknown>,
    actorId: Types.ObjectId | null,
  ): Promise<boolean> {
    const update: SubmissionUpdate = {
      $set: { ...set, updatedAt: new Date(), updatedBy: actorId },
    };
    const result = await this.collection.updateOne(
      conditionOf(tenantId, filter),
      update,
    );
    return result.matchedCount > 0;
  }
}

function conditionOf(
  tenantId: Types.ObjectId | null | undefined,
  filter: SubmissionFilter,
): SubmissionFilter {
  return {
    ...filter,
    tenantId: assertTenantBoundary(tenantId, "form_submissions"),
    deletedAt: null,
  };
}
