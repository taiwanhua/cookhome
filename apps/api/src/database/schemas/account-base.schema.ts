import { Prop } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";

/**
 * users(使用者)與 customers(會員)欄位相同、完全分離(ADR-0003);
 * 共用欄位定義於此,兩張 collection 各自建模繼承。
 */
export abstract class AccountBase {
  @Prop({ type: String, required: true })
  name!: string;

  /** 選項來自欄位管理 gender 類別(存 value)。 */
  @Prop({ type: String })
  gender?: string;

  @Prop({ type: String })
  nickname?: string;

  /**
   * 身分證字號(高敏個資,ADR-0007):欄位級加密存放、API 預設投影不回傳;
   * 底座目前無功能使用 — 作為加密機制的驗證載體保留。
   */
  @Prop({ type: String })
  nationalId?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  address?: string;

  /** unique(全庫)— 僅信件流程定位帳號,不作登入識別(ADR-0003)。 */
  @Prop({ type: String, required: true })
  email!: string;

  /** 登入帳號,unique(全庫)(ADR-0003)。 */
  @Prop({ type: String, required: true })
  account!: string;

  /** argon2id,禁明文(ADR-0003)。 */
  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings!: Record<string, unknown>;
}

/** 帳號表(users/customers)欄位級加密的目標欄位(ADR-0007)。 */
export const ACCOUNT_ENCRYPTED_FIELDS = ["nationalId"];
