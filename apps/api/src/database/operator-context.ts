import type { Query, Types } from "mongoose";

/**
 * 操作者上下文(詞彙見 CONTEXT.md:操作者 / 當前組織 / 可見範圍)。
 * 資料層只**消費**這份上下文;其計算(org_user 聯集、可見性開關)屬登入線(#23 第 2 段)。
 */
export interface OperatorContext {
  /** 操作者(此刻登入、執行動作的使用者)id;無登入主體的流程(如會員註冊)為 null。 */
  actorId: Types.ObjectId | null;
  /** 當前組織:新資料寫入哪個組織(ADR-0005);不參與可見範圍計算。 */
  currentOrgId: Types.ObjectId | null;
  /**
   * 可見組織集合 = 所有所屬組織的聯集(開關 ON 時含其下層,ADR-0005)。
   * 根組織「預設可見全部」以 `"all"` 表示(ADR-0005),避免每次請求載入全部組織 id。
   */
  visibleOrgIds: Types.ObjectId[] | "all";
}

/** 掛在單一 Query 上的範圍資訊,供 plugin 的查詢中介層讀取。 */
export interface QueryScope {
  operator: OperatorContext;
  /** 是否連軟刪除(deletedAt 有值)的資料一起查(ADR-0007);預設不查。 */
  includeDeleted?: boolean;
}

/** Document `$locals` 上存放操作者上下文的鍵(save 中介層讀取)。 */
export const OPERATOR_LOCAL_KEY = "operatorContext";

const queryScopes = new WeakMap<object, QueryScope>();

/**
 * 把操作者上下文掛到 Query 上(以 WeakMap 掛載,不汙染送往驅動程式的 query options)。
 * 唯一應呼叫此函式的地方是 BaseRepository;plugin 以 `getQueryScope` 讀回。
 */
export function scopeQuery<TQuery extends Query<unknown, unknown>>(
  query: TQuery,
  scope: QueryScope,
): TQuery {
  queryScopes.set(query, scope);
  return query;
}

export function getQueryScope(query: object): QueryScope | undefined {
  return queryScopes.get(query);
}

/** 判斷某組織是否落在操作者可見範圍內。 */
export function isOrgVisible(
  operator: OperatorContext,
  orgId: Types.ObjectId | string,
): boolean {
  if (operator.visibleOrgIds === "all") {
    return true;
  }
  const target = String(orgId);
  return operator.visibleOrgIds.some((id) => String(id) === target);
}
