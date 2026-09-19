/* eslint-disable @repo/no-raw-model-query -- 此檔即過濾層本身:裸 Model 存取的唯一合法出口(ADR-0005);到期條件:無 */
import type { Model, QueryFilter, Types, UpdateQuery } from "mongoose";

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
import { CORE_RELATIONSHIPS_COLLECTION } from "./schemas/core-relationship.schema";

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
 * 不提供硬刪除:刪除一律走 `softDeleteById`(ADR-0007)。
 */
export class BaseRepository<TSchema, TDocument extends RepositoryDocument> {
  constructor(protected readonly model: RepositoryModel<TSchema, TDocument>) {
    // 核心關聯只能經 RelationService 的具名包裝(ADR-0001);不讓 BaseRepository 成為第二個入口
    if (model.collection.collectionName === CORE_RELATIONSHIPS_COLLECTION) {
      throw new TenantScopeError(
        `${model.modelName}:核心關聯不經 BaseRepository,請改用 RelationService(ADR-0001)`,
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

  /** 建立資料:租戶資料自動寫入當前組織(ADR-0005),且不可寫入可見範圍外的組織。 */
  async create(
    operator: OperatorContext,
    data: Partial<TSchema>,
  ): Promise<Persisted<TDocument>> {
    const document = new this.model(this.withTenantOrg(operator, data));
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
    assertUpdateLeavesProtectedPaths(this.model.modelName, update);
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
   * 批次更新可見範圍內符合條件的資料,回傳實際更新筆數;欄位保護與 `updateById` 相同。
   * 用途如「作廢該帳號全部 refresh token」這類同時對多筆做同一變更的操作。
   */
  async updateMany(
    operator: OperatorContext,
    filter: RepositoryFilter<TSchema>,
    update: RepositoryUpdate<TSchema>,
  ): Promise<number> {
    assertUpdateLeavesProtectedPaths(this.model.modelName, update);
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
const PROTECTED_UPDATE_PATHS = ["orgId", "createdBy", "createdAt"] as const;

/**
 * 檢查 update 的頂層與各運算子(`$set` / `$unset` / `$setOnInsert` / `$rename`…)內
 * 是否觸及受保護欄位(含 `orgId.x` 這類子路徑);觸及即拋 TenantScopeError。
 * 搬移資料到別的組織若有需求,應是獨立且明確的操作,不經一般更新。
 */
function assertUpdateLeavesProtectedPaths(
  modelName: string,
  update: unknown,
): void {
  if (!update || typeof update !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(update)) {
    const paths = key.startsWith("$")
      ? Object.keys((value ?? {}) as Record<string, unknown>)
      : [key];
    const touched = paths.find((path) =>
      PROTECTED_UPDATE_PATHS.some(
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
