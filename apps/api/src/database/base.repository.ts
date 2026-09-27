/* eslint-disable @repo/no-raw-model-query -- 此檔即過濾層本身:裸 Model 存取的唯一合法出口(ADR-0005);到期條件:無 */
import mongoose, {
  type Model,
  type QueryFilter,
  type Types,
  type UpdateQuery,
} from "mongoose";

import {
  OPERATOR_LOCAL_KEY,
  type OperatorContext,
  isOrgVisible,
  scopeQuery,
} from "./operator-context";
import type { BaseFields } from "./plugins/base-fields.plugin";
import {
  TenantScopeError,
  getTenantScope,
} from "./plugins/tenant-scope.plugin";
import { BUSINESS_RELATIONSHIPS_COLLECTION } from "./schemas/business-relationship.schema";
import { CORE_RELATIONSHIPS_COLLECTION } from "./schemas/core-relationship.schema";
import { ORGS_COLLECTION } from "./schemas/org.schema";
import { WORKFLOW_TASKS_COLLECTION } from "./schemas/workflow-task.schema";
import { WORKFLOWS_COLLECTION } from "./schemas/workflow.schema";
import { tenantIdOfOrg } from "./tenant-id";

/** Model 型別參數固定為預設值(無 query helpers / instance methods / virtuals),只讓 hydrated 文件型別可推導。 */
type NoExtras = Record<never, never>;

export type RepositoryModel<TSchema, TDocument> = Model<
  TSchema,
  NoExtras,
  NoExtras,
  NoExtras,
  TDocument
>;

/** hydrated 文件型別的最小需求(由傳入的 Model 推導,不需手動指定)。 */
export interface RepositoryDocument {
  $locals: Record<string, unknown>;
  save(): Promise<unknown>;
}

/** 經 BaseRepository 取回的文件:一定帶基礎欄位(由 baseFields plugin 保證)。 */
export type Persisted<TDocument> = TDocument & BaseFields;

export type RepositoryFilter<TSchema> = QueryFilter<TSchema & BaseFields>;

export type RepositoryUpdate<TSchema> = UpdateQuery<TSchema & BaseFields>;

export interface FindOptions {
  /** 連軟刪除的資料一起查(ADR-0007);預設排除。 */
  includeDeleted?: boolean;
  /** 投影;預設排除的欄位(如加密個資,ADR-0007)需在此明確以 `+欄位` 請求才回傳。 */
  select?: string;
  /** 排序(如 `{ createdAt: -1 }`);分頁清單要有穩定順序才不會漏筆 / 重複。 */
  sort?: Record<string, 1 | -1>;
  /** 跳過筆數(分頁:`(page - 1) * pageSize`)。 */
  skip?: number;
  /** 取回上限(分頁:`pageSize`)。 */
  limit?: number;
}

/**
 * 所有資料存取的共用層(ADR-0005 / ADR-0007 / ADR-0011):
 * 每個公開方法都以操作者上下文開頭 — 租戶過濾、軟刪除排除、基礎欄位填寫全由 plugin 依此自動完成,
 * 個別功能不自己寫、也繞不過(api 內裸 `Model.xxx()` 由 ESLint 規則 `@repo/no-raw-model-query` 擋下)。
 * 刪除一律走 `softDeleteById`(ADR-0007);唯一的硬刪除是 `hardDeleteById`,只給補償刪除用。
 */
export class BaseRepository<TSchema, TDocument extends RepositoryDocument> {
  constructor(protected readonly model: RepositoryModel<TSchema, TDocument>) {
    // 核心關聯只能經 RelationService 的具名包裝(ADR-0001);不讓 BaseRepository 成為第二個入口
    if (model.collection.collectionName === CORE_RELATIONSHIPS_COLLECTION) {
      throw new TenantScopeError(
        `${model.modelName}:核心關聯不經 BaseRepository,請改用 RelationService(ADR-0001)`,
      );
    }
    // 業務關聯以 tenantId 為邊界、不掛 tenantScope;只能經強制帶 tenantId 的專屬 repository
    if (model.collection.collectionName === BUSINESS_RELATIONSHIPS_COLLECTION) {
      throw new TenantScopeError(
        `${model.modelName}:業務關聯不經 BaseRepository,請改用 BusinessRelationshipsRepository`,
      );
    }
    // 流程與審核任務同樣以 tenantId 為邊界、不掛 tenantScope;只能經各自的專屬 repository
    const tenantBoundRepositories: Record<string, string> = {
      [WORKFLOWS_COLLECTION]: "WorkflowsRepository",
      [WORKFLOW_TASKS_COLLECTION]: "WorkflowTasksRepository",
    };
    const dedicated = tenantBoundRepositories[model.collection.collectionName];
    if (dedicated !== undefined) {
      throw new TenantScopeError(
        `${model.modelName}:以 tenantId 為邊界的表不經 BaseRepository,請改用 ${dedicated}`,
      );
    }
  }

  async findMany(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema> = {},
    options: FindOptions = {},
  ): Promise<Persisted<TDocument>[]> {
    // sort / skip / limit 是同一個 Query 實例上的鏈式設定,不會換掉 scopeQuery 掛上的上下文
    const query = scopeQuery(this.model.find({ ...filter }, options.select), {
      operator,
      includeDeleted: options.includeDeleted,
    });
    if (options.sort) {
      query.sort(options.sort);
    }
    if (options.skip !== undefined) {
      query.skip(options.skip);
    }
    if (options.limit !== undefined) {
      query.limit(options.limit);
    }
    const documents = await query.exec();
    return documents as Persisted<TDocument>[];
  }

  async findOne(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema>,
    options: FindOptions = {},
  ): Promise<Persisted<TDocument> | null> {
    const document = await scopeQuery(
      this.model.findOne({ ...filter }, options.select),
      { operator, includeDeleted: options.includeDeleted },
    ).exec();
    return document as Persisted<TDocument> | null;
  }

  findById(
    operator: OperatorContext,
    id: Types.ObjectId | string,
    options: FindOptions = {},
  ): Promise<Persisted<TDocument> | null> {
    return this.findOne(operator, { _id: id }, options);
  }

  /**
   * 讀**操作者自己建立**的一筆:可見範圍照套,但不套資料範圍規則(ADR-0008),條件改成
   * `createdBy = 操作者`(由插件加上,呼叫端無法放寬)。只給「建立者一律讀得到自己的單」這種
   * 單筆讀取用(表單提交);列表不得使用。
   */
  findOwnById(
    operator: OperatorContext,
    id: Types.ObjectId | string,
  ): Promise<Persisted<TDocument> | null> {
    return this.findOwnOne(operator, { _id: id });
  }

  /** 同 `findOwnById`,以條件找(如 `(createdBy, clientRequestId)` 的冪等重試)。 */
  async findOwnOne(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema>,
    options: Pick<FindOptions, "includeDeleted"> = {},
  ): Promise<Persisted<TDocument> | null> {
    if (operator.actorId === null) {
      return null;
    }
    const document = await scopeQuery(
      this.model.findOne({ ...filter, createdBy: operator.actorId }),
      {
        operator,
        ownRecordsOnly: true,
        includeDeleted: options.includeDeleted,
      },
    ).exec();
    return document as Persisted<TDocument> | null;
  }

  /**
   * 條件更新**操作者自己建立**的一筆(範圍同 `findOwnById`:可見範圍照套、不套資料範圍規則)。
   * 用途:草稿只屬於建立者,資料範圍規則把草稿擋在列表外時,建立者仍要能存 / 送 / 刪自己的草稿。
   */
  async findOwnAndUpdate(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema>,
    update: RepositoryUpdate<TSchema>,
  ): Promise<Persisted<TDocument> | null> {
    if (operator.actorId === null) {
      return null;
    }
    assertUpdateLeavesProtectedPaths(
      this.model.modelName,
      update,
      this.protectedUpdatePaths(),
    );
    const document = await scopeQuery(
      this.model.findOneAndUpdate(
        { ...filter, createdBy: operator.actorId },
        update,
        { returnDocument: "after", runValidators: true },
      ),
      { operator, ownRecordsOnly: true },
    ).exec();
    return document as Persisted<TDocument> | null;
  }

  count(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema> = {},
    options: FindOptions = {},
  ): Promise<number> {
    return scopeQuery(this.model.countDocuments({ ...filter }), {
      operator,
      includeDeleted: options.includeDeleted,
    }).exec();
  }

  /**
   * 建立資料:租戶資料自動寫入當前組織(ADR-0005),且不可寫入可見範圍外的組織。
   * 模組資料表(`moduleData`)另由後端推導 `tenantId`,呼叫端給的值一律忽略。
   */
  async create(
    operator: OperatorContext,
    data: Partial<TSchema>,
  ): Promise<Persisted<TDocument>> {
    const document = new this.model(
      await this.withModuleTenant(this.withTenantOrg(operator, data)),
    );
    document.$locals[OPERATOR_LOCAL_KEY] = operator;
    await document.save();
    return document as Persisted<TDocument>;
  }

  /**
   * 依 id 更新;可見範圍外或已軟刪除的資料視為不存在(回 null)。回傳更新後的文件。
   * update 不得觸及 orgId(否則可把資料搬進別的租戶)與建立資訊(createdBy / createdAt)。
   */
  async updateById(
    operator: OperatorContext,
    id: Types.ObjectId | string,
    update: RepositoryUpdate<TSchema>,
  ): Promise<Persisted<TDocument> | null> {
    assertUpdateLeavesProtectedPaths(
      this.model.modelName,
      update,
      this.protectedUpdatePaths(),
    );
    const document = await scopeQuery(
      this.model.findOneAndUpdate({ _id: id }, update, {
        returnDocument: "after",
        runValidators: true,
      }),
      { operator },
    ).exec();
    return document as Persisted<TDocument> | null;
  }

  /**
   * **條件更新**:更新第一筆符合 `filter` 的資料並回傳更新後的文件,沒有符合者回 null。
   * 用途是樂觀鎖與搶鎖(「`editVersion` 還是我讀到的那個才寫」「草稿還在 draft 才改成 publishing」):
   * 條件與更新在同一次寫入裡判斷,兩個請求同時來只有一個會命中。欄位保護與範圍與 `updateById` 相同。
   */
  async findOneAndUpdate(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema>,
    update: RepositoryUpdate<TSchema>,
  ): Promise<Persisted<TDocument> | null> {
    assertUpdateLeavesProtectedPaths(
      this.model.modelName,
      update,
      this.protectedUpdatePaths(),
    );
    const document = await scopeQuery(
      this.model.findOneAndUpdate({ ...filter }, update, {
        returnDocument: "after",
        runValidators: true,
      }),
      { operator },
    ).exec();
    return document as Persisted<TDocument> | null;
  }

  /**
   * 批次更新可見範圍內符合條件的資料,回傳實際更新筆數;欄位保護與 `updateById` 相同。
   * 用途如「作廢該帳號全部 refresh token」這類同時對多筆做同一變更的操作。
   */
  async updateMany(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema>,
    update: RepositoryUpdate<TSchema>,
  ): Promise<number> {
    assertUpdateLeavesProtectedPaths(
      this.model.modelName,
      update,
      this.protectedUpdatePaths(),
    );
    const { modifiedCount } = await scopeQuery(
      this.model.updateMany({ ...filter }, update, { runValidators: true }),
      { operator },
    ).exec();
    return modifiedCount;
  }

  /** 軟刪除(ADR-0007):寫入 deletedAt,之後預設查詢視為不存在;已刪除者再刪回 null。 */
  softDeleteById(
    operator: OperatorContext,
    id: Types.ObjectId | string,
  ): Promise<Persisted<TDocument> | null> {
    return this.updateById(operator, id, { $set: { deletedAt: new Date() } });
  }

  /**
   * **補償刪除**:把一筆文件從資料庫抹掉,回傳是否真的刪到(ADR-0007 軟刪除的唯一例外)。
   *
   * 為什麼需要它:Mongo 單節點沒有 transaction,多步驟寫入(開通租戶的四步,ADR-0009)失敗時
   * 只能以補償刪除回滾。這裡軟刪除幫不上忙 — `users` 的 account / email 唯一索引**含已軟刪除的文件**,
   * 留一筆殭屍會讓同一組帳號 / Email 永遠再也開不了,重試必然再失敗。
   *
   * **只准用在「本次請求剛建立、尚未對外可見」的文件**:使用者要刪的資料一律 `softDeleteById`。
   * 租戶過濾與 `deletedAt` 一樣由 plugin 套上(`includeDeleted` 讓半途已被標記刪除的也刪得掉)。
   */
  async hardDeleteById(
    operator: OperatorContext,
    id: Types.ObjectId | string,
  ): Promise<boolean> {
    const { deletedCount } = await scopeQuery(
      this.model.deleteOne({ _id: id }),
      { operator, includeDeleted: true },
    ).exec();
    return deletedCount > 0;
  }

  /** 模組資料表另外鎖住 `moduleKey` / `tenantId`:兩者建立後不可經一般更新改動。 */
  private protectedUpdatePaths(): readonly string[] {
    return getTenantScope(this.model.schema)?.moduleData === true
      ? [...PROTECTED_UPDATE_PATHS, ...MODULE_DATA_PROTECTED_PATHS]
      : PROTECTED_UPDATE_PATHS;
  }

  /**
   * 模組資料表的 `tenantId`:依 `orgId` 的祖先推導租戶頂層(`tenantIdOfOrg`),
   * 覆蓋呼叫端給的任何值(GraphQL input 本來就不收,這裡再防一次內部呼叫端)。
   *
   * 組織以原生 collection 讀:`orgs` 掛的是治理類過濾(吃管理範圍),而建立業務資料的人
   * 不一定管得到自己寫入的組織;可寫入與否已由 `withTenantOrg` 以可見範圍判過,這裡只取祖先。
   * 讀不到組織 → 拋錯(fail-closed):那是資料損毀,不該靜默寫出一筆沒有租戶邊界的資料。
   */
  private async withModuleTenant(
    data: Partial<TSchema>,
  ): Promise<Partial<TSchema>> {
    if (getTenantScope(this.model.schema)?.moduleData !== true) {
      return data;
    }
    const orgId = (data as { orgId?: Types.ObjectId | string | null }).orgId;
    if (orgId === undefined || orgId === null) {
      throw new TenantScopeError(
        `${this.model.modelName} 是模組資料,建立時需要所屬組織才能推導 tenantId`,
      );
    }
    const org = await this.model.db
      .collection<{ ancestors?: Types.ObjectId[] }>(ORGS_COLLECTION)
      .findOne(
        { _id: new mongoose.Types.ObjectId(String(orgId)) },
        { projection: { ancestors: 1 } },
      );
    if (!org) {
      throw new TenantScopeError(
        `${this.model.modelName}:所屬組織 ${String(orgId)} 不存在,無法推導 tenantId`,
      );
    }
    return {
      ...data,
      tenantId: tenantIdOfOrg({ _id: org._id, ancestors: org.ancestors ?? [] }),
    };
  }

  private withTenantOrg(
    operator: OperatorContext,
    data: Partial<TSchema>,
  ): Partial<TSchema> {
    const scope = getTenantScope(this.model.schema);
    // 非租戶資料,或以 _id 判定可見的資料(orgs):沒有 orgId 可填
    if (scope?.path !== "orgId") {
      return data;
    }
    const given = (data as { orgId?: unknown }).orgId;
    const orgId = given === undefined ? operator.currentOrgId : given;
    if (orgId === null) {
      // 全域資料(orgId null)只有根組織可建立
      if (scope.allowGlobal && operator.visibleOrgIds === "all") {
        return { ...data, orgId: null };
      }
      throw new TenantScopeError(
        `${this.model.modelName} 是租戶資料,建立時需要當前組織`,
      );
    }
    if (!isOrgVisible(operator, orgId as string)) {
      throw new TenantScopeError(
        `${this.model.modelName}:不可寫入可見範圍外的組織`,
      );
    }
    return { ...data, orgId };
  }
}

/** 更新內容不得觸及的欄位:所屬組織(租戶隔離)與建立資訊(稽核)。 */
const PROTECTED_UPDATE_PATHS: readonly string[] = [
  "orgId",
  "createdBy",
  "createdAt",
];

/** 模組資料表另外不得經一般更新改動的欄位(`tenantScopePlugin` 的 `moduleData`)。 */
const MODULE_DATA_PROTECTED_PATHS: readonly string[] = [
  "moduleKey",
  "tenantId",
];

/**
 * 檢查 update 的頂層與各運算子(`$set` / `$unset` / `$setOnInsert` / `$rename`…)內
 * 是否觸及受保護欄位(含 `orgId.x` 這類子路徑);觸及即拋 TenantScopeError。
 * 搬移資料到別的組織若有需求,應是獨立且明確的操作,不經一般更新。
 */
function assertUpdateLeavesProtectedPaths(
  modelName: string,
  update: unknown,
  protectedPaths: readonly string[],
): void {
  if (!update || typeof update !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(update)) {
    const paths = key.startsWith("$")
      ? Object.keys((value ?? {}) as Record<string, unknown>)
      : [key];
    const touched = paths.find((path) =>
      protectedPaths.some(
        (protectedPath) =>
          path === protectedPath || path.startsWith(`${protectedPath}.`),
      ),
    );
    if (touched) {
      throw new TenantScopeError(
        `${modelName}:更新不得變更 ${touched}(所屬組織與建立資訊不可經一般更新修改)`,
      );
    }
  }
}
