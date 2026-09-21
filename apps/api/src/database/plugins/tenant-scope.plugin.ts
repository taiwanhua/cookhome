/* eslint-disable unicorn/no-this-outside-of-class -- Mongoose 中介層以 this 接收 Query,無參數式替代;到期條件:Mongoose 提供以參數傳入 query 的中介層 API */
import type {
  MongooseQueryMiddleware,
  Query,
  QueryFilter,
  Schema,
} from "mongoose";

import type { OperatorOrgScope } from "../operator-context";
import { getQueryScope } from "../operator-context";
import { getDataScopeRuleProvider } from "./data-scope-provider";

/**
 * 這個 collection 屬哪一類(ADR-0005「管理範圍與可見範圍的分工」),決定過濾吃哪個集合:
 * - `business`(預設):業務資料,吃**可見範圍** `visibleOrgIds`
 * - `governance`:治理資料(組織本身),吃**管理範圍** `managedOrgIds`
 *
 * 判準寫在 schema 上、不寫在呼叫端:同一張表在不同功能裡不該換範圍,
 * 否則「治理頁看得到、業務頁看不到」這種差異會散落在各 service 裡(CONTEXT.md「租戶過濾」)。
 * 沒有 `orgId`、走核心關聯歸屬的 users / roles 不掛本 plugin,由模組先查關聯再查本表 —
 * 它們查關聯時用的組織清單也一律來自 orgs(已是治理類),範圍自然跟著對。
 */
export type TenantScopeKind = "business" | "governance";

export interface TenantScopeOptions {
  /** 承載組織 id 的欄位:一般租戶資料為 `orgId`;orgs 自身以 `_id` 判定可見(ADR-0005)。 */
  path?: "orgId" | "_id";
  /** 該欄位為 null 的資料視為全域(如 fields 的全域種子,ADR-0005 `$or`),對所有操作者可見。 */
  allowGlobal?: boolean;
  /** 治理類 / 業務類(見 `TenantScopeKind`);預設 `business`。 */
  kind?: TenantScopeKind;
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
    kind: options.kind ?? "business",
  };
  tenantScopes.set(schema, scope);
  // collection 名在 schema 定義時就確定(每張 schema 都以 `@Schema({ collection })` 明寫),
  // 在此取一次:資料範圍規則以 collection 為識別鍵(ADR-0008),中介層裡不必再碰原生驅動程式
  const collectionName: string | undefined = schema.get("collection");
  schema.pre([...SCOPED_QUERY_MIDDLEWARE], async function () {
    applyTenantScope(this, scope);
    await applyDataScope(this, scope, collectionName);
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
  const orgIds = scopeOrgIdsOf(queryScope.operator, scope.kind);
  if (orgIds === "all") {
    return;
  }
  const inScopeOrgs: QueryFilter<Record<string, unknown>> = {
    [scope.path]: { $in: orgIds },
  };
  const condition: QueryFilter<Record<string, unknown>> = scope.allowGlobal
    ? { $or: [inScopeOrgs, { [scope.path]: null }] }
    : inScopeOrgs;
  query.and([condition]);
}

/**
 * 資料範圍規則(ADR-0008):在租戶保底**之內**再收窄 —
 * 條件同樣以 `$and` 追加,所以規則永遠只會讓看到的變少,保底不可被關掉。
 *
 * 只套**業務類**(`kind: "business"`):治理類 collection(組織 / 使用者 / 角色)吃的是管理範圍,
 * 由角色決定,不是資料範圍要管的事(`docs/modules/data-scope.md`「執行面」)。
 * 未宣告 `dataScopeTarget` 的業務 collection(如 `demo_items_two`)也不會有規則 → provider 回 null。
 */
async function applyDataScope(
  query: AnyQuery,
  scope: TenantScope,
  collectionName: string | undefined,
): Promise<void> {
  if (scope.kind !== "business" || collectionName === undefined) {
    return;
  }
  const provider = getDataScopeRuleProvider();
  if (!provider) {
    // 跑起來的 app 走不到這裡:`DatabaseModule.onApplicationBootstrap` 已斷言 provider
    // 必定註冊(#246 的 6);剩下的呼叫端只有不起 Nest 的單元測試
    return;
  }
  // applyTenantScope 已在同一個中介層先跑過,沒有上下文的查詢在那裡就 fail-closed 了
  const queryScope = getQueryScope(query);
  if (!queryScope) {
    return;
  }
  const condition = await provider.conditionFor(
    collectionName,
    queryScope.operator,
  );
  if (condition) {
    query.and([condition]);
  }
}

/** 治理類吃管理範圍、業務類吃可見範圍(ADR-0005 的分工表;此處是唯一的選擇點)。 */
export function scopeOrgIdsOf(
  operator: {
    visibleOrgIds: OperatorOrgScope;
    managedOrgIds: OperatorOrgScope;
  },
  kind: TenantScopeKind,
): OperatorOrgScope {
  return kind === "governance"
    ? operator.managedOrgIds
    : operator.visibleOrgIds;
}
