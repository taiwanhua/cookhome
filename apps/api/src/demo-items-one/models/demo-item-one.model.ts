import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";

/**
 * 狀態(GQL-01:enum 值 SCREAMING_SNAKE_CASE)。
 * 成員值即落庫的字串,與 `database/schemas/demo-item-one.schema.ts` 的
 * `DEMO_ITEM_ONE_STATUSES` 以及 seed 宣告的資料範圍選項一一對應(ADR-0008 的 enum 欄位)。
 */
export enum DemoItemOneStatusEnum {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

registerEnumType(DemoItemOneStatusEnum, {
  name: "DemoItemOneStatus",
  description:
    "示範項目狀態(草稿 / 已發布 / 已封存);資料範圍規則的 enum 欄位,選項正本在模組 seed",
});

/** 使用者的最小參照(建立者、歷程的執行者)。 */
@ObjectType()
export class DemoItemOneUserRef {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}

/**
 * 附件(私有 bucket,ADR-0010)。
 * `path` 是物件路徑(編輯時原樣送回即「不換檔」);**下載網址不在這裡** —— 要另外呼叫
 * `attachmentDownloadUrl(id)` 現簽,才守得住「私有檔案的可取範圍 = 該筆資料的可查範圍」。
 */
@ObjectType()
export class DemoItemOneAttachment {
  @Field(() => ID)
  path!: string;

  /**
   * 顯示用檔名 = 物件路徑的最後一段(`<uuid>.<副檔名>`)。
   * 底座的上傳票不保留原始檔名(路徑帶 uuid,ADR-0010),所以這裡沒有「使用者當初選的檔名」。
   */
  @Field(() => String)
  name!: string;
}

/**
 * 這筆資料**對這位操作者**允許的動作,由 api 依有效權限集算好(GQL-07;寫法同角色頁的
 * `RoleAbilities`)。前端只讀、不重算:顯示按鈕的條件是「頁面權限 && 這裡的旗標」。
 */
@ObjectType()
export class DemoItemOneAbilities {
  /** 持有 `demo.sub.sample-one.edit`。 */
  @Field(() => Boolean)
  canEdit!: boolean;

  /** 持有 `demo.sub.sample-one.delete`。 */
  @Field(() => Boolean)
  canDelete!: boolean;

  /**
   * 持有 `demo.sub.sample-one.edit-internal-note`(欄位級權限,綁父模組,ADR-0004)。
   * false 但 `internalNote` 有值 = 看得到、改不動(唯讀);硬送寫入回 `FORBIDDEN`
   * (reason `FIELD_FORBIDDEN`)。
   */
  @Field(() => Boolean)
  canEditInternalNote!: boolean;
}

/**
 * 示範項目(`demo.sub.sample-one` 的主要型別;技術文件 `docs/modules/demo.sub.sample-one.md`)。
 *
 * api 介面(GQL-07:欄位語意的正本在模組文件的「api 介面」節,此處與之對齊):
 * - `internalNote`:**欄位級權限**。沒有 `demo.sub.sample-one.show-internal-note` 時
 *   api 根本不把這個欄位放進回傳物件(GraphQL 序列化成 `null`),所以「沒權限」與「沒填」
 *   在線上看起來一樣 —— 前端依**自己的權限集**決定要不要渲染這個欄位,不靠值去猜
 * - `coverUrl`:公開 bucket 的**穩定** URL(不過期,可直接放 `<img src>`);沒有封面時 null
 * - `attachment`:私有 bucket,**只給路徑與檔名**,下載網址另呼叫 `attachmentDownloadUrl(id)`
 * - `categoryLabel`:`category`(存 value)在欄位管理「示範分類」**操作者合併範圍**內對應的
 *   顯示名稱;分類已被停用 / 屬於看不到的組織時為 null(值仍原樣回在 `category`)
 * - `createdBy`:建立者;無登入主體建立的資料(理論上不存在)或使用者已被刪除時為 null
 */
@ObjectType("DemoItemOne")
export class DemoItemOneModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  category!: string | null;

  @Field(() => String, { nullable: true })
  categoryLabel!: string | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => String, { nullable: true })
  internalNote?: string | null;

  /** 封面的物件路徑(公開 bucket);編輯時原樣送回即「不換圖」。 */
  @Field(() => ID, { nullable: true })
  coverPath!: string | null;

  @Field(() => String, { nullable: true })
  coverUrl!: string | null;

  @Field(() => DemoItemOneAttachment, { nullable: true })
  attachment!: DemoItemOneAttachment | null;

  @Field(() => DemoItemOneStatusEnum)
  status!: DemoItemOneStatusEnum;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => DemoItemOneUserRef, { nullable: true })
  createdBy!: DemoItemOneUserRef | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => DemoItemOneAbilities)
  abilities!: DemoItemOneAbilities;
}
