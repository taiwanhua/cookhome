/* eslint-disable unicorn/no-this-outside-of-class -- Mongoose 中介層以 this 接收 Query,無參數式替代;到期條件:Mongoose 提供以參數傳入 query 的中介層 API */
import type {
  MongooseQueryMiddleware,
  Query,
  QueryFilter,
  Schema,
} from "mongoose";

import { getQueryScope } from "../operator-context";

export interface TenantScopeOptions {
  /** 承載組織 id 的欄位:一般租戶資料為 `orgId`;orgs 自身以 `_id` 判定可見(ADR-0005)。 */
  path?: "orgId" | "_id";
  /** 該欄位為 null 的資料視為全域(如 fields 的全域種子,ADR-0005 `$or`),對所有操作者可見。 */
  allowGlobal?: boolean;
}

export type TenantScope = Required<TenantScopeOptions>;

/**
 * 會被套上租戶過濾的查詢中介層:凡吃過濾條件的讀/寫/刪都列入。
 * `estimatedDocumentCount` 不吃條件,刻意不列 — 對租戶資料不該使用。
 */
export const SCOPED_QUERY_MIDDLEWARE = [
  "find",
  "findOne",
  "countDocuments",
  "distinct",
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
] as const satisfies readonly MongooseQueryMiddleware[];

const tenantScopes = new WeakMap<Schema, TenantScope>();

/** 租戶隔離被違反或缺少上下文時拋出;屬程式錯誤(該經 BaseRepository 卻沒有),不是使用者錯誤。 */
export class TenantScopeError extends Error {
  override name = "TenantScopeError";
}

/**
 * Mongoose plugin(ADR-0005):把「組織 ∈ 操作者可見組織」自動加進每一條查詢。
 * - 條件以 `$and` 追加,呼叫端自己的 orgId 條件只會再收窄、無法放寬。
 * - 查詢未攜帶操作者上下文(沒經 BaseRepository)→ 直接拋錯(fail-closed),不會靜默回傳全部。
 * - 未掛此 plugin 的 schema(種子表、平台級帳號表)完全不受影響 — 這就是「非租戶資料」的判定機制。
 */
export function tenantScopePlugin(
  schema: Schema,
  options: TenantScopeOptions = {},
): void {
  const scope: TenantScope = {
    path: options.path ?? "orgId",
    allowGlobal: options.allowGlobal ?? false,
  };
  tenantScopes.set(schema, scope);
  schema.pre([...SCOPED_QUERY_MIDDLEWARE], function () {
    applyTenantScope(this, scope);
  });
}

/** 讀取 schema 的租戶範圍設定;未掛 plugin 回 undefined(= 非租戶資料)。 */
export function getTenantScope(schema: Schema): TenantScope | undefined {
  return tenantScopes.get(schema);
}

type AnyQuery = Query<unknown, unknown, unknown, Record<string, unknown>>;

function applyTenantScope(query: AnyQuery, scope: TenantScope): void {
  const queryScope = getQueryScope(query);
  if (!queryScope) {
    throw new TenantScopeError(
      `${query.model.modelName} 是租戶資料,查詢必須攜帶操作者上下文(請經 BaseRepository)`,
    );
  }
  const { visibleOrgIds } = queryScope.operator;
  if (visibleOrgIds === "all") {
    return;
  }
  const inVisibleOrgs: QueryFilter<Record<string, unknown>> = {
    [scope.path]: { $in: visibleOrgIds },
  };
  const condition: QueryFilter<Record<string, unknown>> = scope.allowGlobal
    ? { $or: [inVisibleOrgs, { [scope.path]: null }] }
    : inVisibleOrgs;
  query.and([condition]);
}
