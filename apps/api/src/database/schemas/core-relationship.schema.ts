import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";

/** 封閉 enum,完整清單正本:ADR-0001(命名順序 Org > User > Role > Module > Permission)。 */
export const CORE_RELATIONSHIP_TYPES = [
  "org_user",
  "org_role",
  "user_role",
  "role_module",
  "role_permission",
] as const;

export type CoreRelationshipType = (typeof CORE_RELATIONSHIP_TYPES)[number];

/** collection 名;BaseRepository 以此拒絕成為核心關聯的第二個入口(存取僅經 RelationService,ADR-0001)。 */
export const CORE_RELATIONSHIPS_COLLECTION = "core_relationships";

/** 核心關聯單一 collection(ADR-0001):命名順序 Org > User > Role > Module > Permission。 */
@Schema({ collection: CORE_RELATIONSHIPS_COLLECTION })
export class CoreRelationship {
  /** 關聯種類(決定 first/second 各是誰)。 */
  @Prop({ type: String, required: true, enum: CORE_RELATIONSHIP_TYPES })
  type!: CoreRelationshipType;

  /** 命名順序在前者的 id(如 org_user 的 org)。 */
  @Prop({ type: Types.ObjectId, required: true })
  firstId!: Types.ObjectId;

  /** 命名順序在後者的 id(如 org_user 的 user)。 */
  @Prop({ type: Types.ObjectId, required: true })
  secondId!: Types.ObjectId;

  /** 保留欄位,暫不使用(ADR-0001)。 */
  @Prop({ type: Types.ObjectId, default: null })
  thirdId!: Types.ObjectId | null;

  /** 關聯自身資訊(授權人、時間等)。 */
  @Prop({ type: MongooseSchema.Types.Mixed })
  meta?: Record<string, unknown>;

  /** 描述說明(選填)。 */
  @Prop({ type: String })
  description?: string;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const CoreRelationshipSchema =
  SchemaFactory.createForClass(CoreRelationship);

// 防重唯一索引(ADR-0001);thirdId 保留欄位一併入鍵
CoreRelationshipSchema.index(
  { type: 1, firstId: 1, secondId: 1, thirdId: 1 },
  { unique: true },
);
// org_role 於 second(role)側唯一:一個角色僅一個擁有組織(ADR-0001)
CoreRelationshipSchema.index(
  { secondId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "org_role" },
    name: "org_role_second_unique",
  },
);
// 各 type 查詢用索引(base-schema 索引總表)
CoreRelationshipSchema.index({ type: 1, firstId: 1 });
CoreRelationshipSchema.index({ type: 1, secondId: 1 });
// 基礎欄位(ADR-0007);關聯的租戶歸屬由兩端實體決定,不掛 tenantScope(存取經 RelationService,ADR-0001)
CoreRelationshipSchema.plugin(baseFieldsPlugin);
