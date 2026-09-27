import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";

/** 列表欄位的種類:摘要槽(`title` / `date` / `amount`)或表單欄位。 */
export enum ModuleListColumnKind {
  SLOT = "slot",
  FIELD = "field",
}

registerEnumType(ModuleListColumnKind, {
  name: "ModuleListColumnKind",
  description: "列表欄位的種類:摘要槽 / 表單欄位",
});

/** 摘要槽 key(`form_submissions.summary` 的鍵)。 */
export const LIST_SLOT_KEYS = ["title", "date", "amount"] as const;

/** 欄寬上下限(px)。 */
export const MIN_COLUMN_WIDTH = 40;
export const MAX_COLUMN_WIDTH = 2000;

@ObjectType()
export class ModuleListColumn {
  @Field(() => ModuleListColumnKind)
  kind!: ModuleListColumnKind;

  /** 摘要槽 key 或欄位 key。 */
  @Field(() => String)
  key!: string;

  /** 只有表單欄位:限定哪張表單的欄位;null = 模組內任一張有這個欄位的表單。 */
  @Field(() => ID, { nullable: true })
  formKey!: string | null;

  /** 欄寬(px)。 */
  @Field(() => Int)
  width!: number;

  @Field(() => Int)
  order!: number;
}

/** 列表欄位配置(`modules.settings.list`)。 */
@ObjectType()
export class ModuleListColumnsPayload {
  @Field(() => String)
  moduleKey!: string;

  /** 依 `order` 排好;沒設定過為空陣列(前端用預設欄)。 */
  @Field(() => [ModuleListColumn])
  columns!: ModuleListColumn[];
}

@InputType()
export class ModuleListColumnInput {
  @Field(() => ModuleListColumnKind)
  kind!: ModuleListColumnKind;

  @Field(() => String)
  key!: string;

  /** 只有表單欄位用;缺席 / null = 不限定表單。 */
  @Field(() => ID, { nullable: true })
  formKey?: string | null;

  @Field(() => Int)
  width!: number;

  @Field(() => Int)
  order!: number;
}

/** 整份覆蓋某表單模組的列表欄位配置(root)。 */
@InputType()
export class SetModuleListColumnsInput {
  @Field(() => String)
  moduleKey!: string;

  /** 空陣列 = 清掉配置(回到前端預設欄)。 */
  @Field(() => [ModuleListColumnInput])
  columns!: ModuleListColumnInput[];
}
