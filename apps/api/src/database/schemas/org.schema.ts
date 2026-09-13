import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

/** 組織(ADR-0005):物化路徑 ancestors;根組織以 key 供 seed 冪等。 */
@Schema({ collection: "orgs", timestamps: true })
export class Org {
  @Prop({ type: String, required: true })
  name!: string;

  /** 根組織為 null。 */
  @Prop({ type: Types.ObjectId, default: null })
  parentId!: Types.ObjectId | null;

  /** 物化路徑祖先 id 陣列(ADR-0005)。 */
  @Prop({ type: [Types.ObjectId], default: [] })
  ancestors!: Types.ObjectId[];

  /** 僅根組織需要,seed 冪等用。 */
  @Prop({ type: String })
  key?: string;

  /** 保護根組織。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /** 停用租戶。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  @Prop({ type: String })
  description?: string;

  /** 組織商標的 GCS 物件路徑(存路徑非 URL,ADR-0010)。 */
  @Prop({ type: String })
  logoPath?: string;

  /** 租戶擁有者(僅租戶頂層有值,ADR-0009)。 */
  @Prop({ type: Types.ObjectId })
  ownerUserId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings!: Record<string, unknown>;
}

export const OrgSchema = SchemaFactory.createForClass(Org);

OrgSchema.index({ key: 1 }, { unique: true, sparse: true });
OrgSchema.index({ parentId: 1 });
OrgSchema.index({ ancestors: 1 });
