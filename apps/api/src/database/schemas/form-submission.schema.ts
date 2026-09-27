import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

import type { StoredValues, SubmissionSummary } from "@repo/domain/form";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";
import { tenantScopePlugin } from "../plugins/tenant-scope.plugin";

/** collection 名(資料範圍目標、退役權限清理的跨租戶計數共用)。 */
export const FORM_SUBMISSIONS_COLLECTION = "form_submissions";

/**
 * 提交狀態(Spec 6a §6「提交」):`draft` 存了沒送出、可改可刪;`completed` 送出過(6a 送出即完成)。
 * 6b 會在中間插入審核狀態。與購物清單 seed 的資料範圍目標 `status` 選項一一對應。
 */
export const FORM_SUBMISSION_STATUSES = ["draft", "completed"] as const;

export type FormSubmissionStatus = (typeof FORM_SUBMISSION_STATUSES)[number];

/**
 * 一次送出 / 修改的上下文(歷史檢視重算條件時轉成表達式的 `ctx.*`,不拿讀者現在的身分補值)。
 * `orgId` = 操作者當時的當前組織。
 */
export interface FormRevisionContext {
  at: Date;
  timezone: string;
  userId: Types.ObjectId | null;
  orgId: Types.ObjectId | null;
}

/** 一個修訂號的**完整值快照**(不是 diff;受保護欄位原值照存,讀取時投影遮蔽)。 */
export interface FormRevision {
  revision: number;
  values: StoredValues;
  ctx: FormRevisionContext;
}

/**
 * 表單提交(所有表單模組共用一張;`docs/data-model.md`「form_submissions」)。
 * 模組資料表:`tenantScopePlugin({ moduleData: true })` 宣告 `moduleKey`(= 綁的表單所屬模組)與
 * `tenantId`(後端依 `orgId` 推導);可見範圍與資料範圍規則照固定欄位模組一樣自動套用。
 */
@Schema({
  collection: FORM_SUBMISSIONS_COLLECTION,
  timestamps: true,
  minimize: false,
})
export class FormSubmission {
  /** 資料歸屬組織(租戶隔離,ADR-0005)= 建立者當時的當前組織。 */
  @Prop({ type: Types.ObjectId, required: true })
  orgId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  formKey!: string;

  /** 綁的版本(建草稿時的 `forms.currentVersion`);之後不隨表單改版而變。 */
  @Prop({ type: Number, required: true })
  version!: number;

  /** 欄位 key → 存值(Spec §5「值的存法」);受保護欄位原值照存,讀取時投影為 `"[redacted]"`。 */
  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  values!: StoredValues;

  /** 依版本 `summaryMap` 算的快照;列表只讀它(關鍵字也只比對 `summary.title`)。 */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  summary!: SubmissionSummary | null;

  @Prop({ type: String, required: true, enum: FORM_SUBMISSION_STATUSES })
  status!: FormSubmissionStatus;

  /** 目前修訂號:草稿為 0、送出時 = 1、已完成後每改一次 +1。 */
  @Prop({ type: Number, default: 0 })
  revision!: number;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  revisions!: FormRevision[];

  /** 每次寫入(存草稿 / 送出 / 已完成修改)+1;寫入都要帶預期值,不符 → 409。 */
  @Prop({ type: Number, default: 0 })
  editVersion!: number;

  /** `createFormDraft` 的一次性 id;`(createdBy, clientRequestId)` 唯一,重試回同一筆。 */
  @Prop({ type: String, required: true })
  clientRequestId!: string;

  /** 第一次送出時間(= `revisions[0].ctx.at`);索引與列表排序用。 */
  @Prop({ type: Date, default: null })
  submittedAt!: Date | null;

  /** 模組 key(`tenantScopePlugin` 的 `moduleData` 宣告;= 綁的表單的 `moduleKey`)。 */
  moduleKey!: string;

  /** 租戶頂層 id(同上;`BaseRepository.create` 推導,根組織資料為 null)。 */
  tenantId!: Types.ObjectId | null;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const FormSubmissionSchema =
  SchemaFactory.createForClass(FormSubmission);

// 列表(依模組 / 表單,送出時間排序)與「我的提交」(6b 申請中心)
FormSubmissionSchema.index({
  tenantId: 1,
  moduleKey: 1,
  formKey: 1,
  submittedAt: 1,
});
FormSubmissionSchema.index({ tenantId: 1, createdBy: 1, submittedAt: 1 });
// 新增的冪等:同一人同一次頁面開啟只會建一筆(含已軟刪除的,重用 id 一律拒絕)
FormSubmissionSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true },
);
// 基礎欄位(ADR-0007)+ 模組資料表(可見範圍 + 資料範圍規則依 moduleKey,ADR-0005 / ADR-0008)
FormSubmissionSchema.plugin(baseFieldsPlugin);
FormSubmissionSchema.plugin(tenantScopePlugin, { moduleData: true });
