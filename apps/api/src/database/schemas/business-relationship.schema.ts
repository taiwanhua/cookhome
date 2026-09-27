import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";

/**
 * 業務關聯的種類(封閉 enum;命名照 ADR-0001 的 `<第一方 collection 單數>_<第二方 collection 單數>`,
 * 三方關聯接第三方)。
 *
 * | type                | tenantId        | firstId       | secondId    | thirdId     | meta          |
 * | ------------------- | --------------- | ------------- | ----------- | ----------- | ------------- |
 * | `org_form`          | 租戶頂層 `orgs` | 同 `tenantId` | `forms`     | null        | `{ enabled }` |
 * | `org_workflow`      | 租戶頂層 `orgs` | 同 `tenantId` | `workflows` | null        | `{}`          |
 * | `org_form_workflow` | 租戶頂層 `orgs` | 同 `tenantId` | `forms`     | `workflows` | `{}`          |
 *
 * `org_form` = 表單分派 / 啟用;`org_workflow` = 流程分派;`org_form_workflow` = 流程綁定
 * (租戶 × 表單 → 流程)。唯一性一律沿用 `(tenantId, type, firstId, secondId)`:同租戶同表單最多綁
 * 一個流程,`thirdId` 不在鍵裡 → 多張表單可以綁同一個流程(`docs/data-model.md`「business_relationships」)。
 */
export const BUSINESS_RELATIONSHIP_TYPES = [
  "org_form",
  "org_workflow",
  "org_form_workflow",
] as const;

export type BusinessRelationshipType =
  (typeof BUSINESS_RELATIONSHIP_TYPES)[number];

/** collection 名;存取只經 `BusinessRelationshipsRepository`(每個方法強制帶 `tenantId`)。 */
export const BUSINESS_RELATIONSHIPS_COLLECTION = "business_relationships";

/**
 * 業務關聯(與核心關聯同形狀 + 必填 `tenantId`)。
 *
 * **不掛 `tenantScopePlugin`**:可見範圍插件以操作者的可見組織過濾,而部門使用者的可見範圍
 * 不含租戶頂層 —— 掛了,部門使用者就查不到自己租戶的 `org_form`,也就看不到任何表單。
 * 改以 `tenantId` 為邊界:repository 每個讀寫方法都強制帶 `tenantId` 條件,沒帶就拋錯(fail-closed)。
 */
@Schema({ collection: BUSINESS_RELATIONSHIPS_COLLECTION })
export class BusinessRelationship {
  /** 租戶邊界(租戶頂層 `orgs` id);每一條查詢都以它為條件。 */
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  /** 關聯種類(決定 first / second 各是誰)。 */
  @Prop({ type: String, required: true, enum: BUSINESS_RELATIONSHIP_TYPES })
  type!: BusinessRelationshipType;

  /** 命名順序在前者的 id(三種 type 都是租戶頂層 org)。 */
  @Prop({ type: Types.ObjectId, required: true })
  firstId!: Types.ObjectId;

  /** 命名順序在後者的 id(`org_form` / `org_form_workflow` 的 form、`org_workflow` 的 workflow)。 */
  @Prop({ type: Types.ObjectId, required: true })
  secondId!: Types.ObjectId;

  /** 三方關聯的第三方(`org_form_workflow` 的 workflow);其他 type 為 null。 */
  @Prop({ type: Types.ObjectId, default: null })
  thirdId!: Types.ObjectId | null;

  /** 關聯自身資訊(`org_form`:`{ enabled }`)。 */
  @Prop({ type: MongooseSchema.Types.Mixed })
  meta?: Record<string, unknown>;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const BusinessRelationshipSchema =
  SchemaFactory.createForClass(BusinessRelationship);

// 防重唯一索引:同一租戶、同一種類、同一對 id 只有一筆
BusinessRelationshipSchema.index(
  { tenantId: 1, type: 1, firstId: 1, secondId: 1 },
  { unique: true },
);
// 基礎欄位(ADR-0007);不掛 tenantScope(理由見 class 註解)
BusinessRelationshipSchema.plugin(baseFieldsPlugin);
