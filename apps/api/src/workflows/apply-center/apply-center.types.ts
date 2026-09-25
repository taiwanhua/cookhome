import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
} from "@nestjs/graphql";

import {
  FormSubmissionStatusEnum,
  FormSummary,
} from "../../forms/form-runtime/models/form-submission.model";
import { FormSubmissionSummary } from "../../forms/models/form-common.model";

/** 清單分頁預設值(與其他清單同一組)。 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** 我的申請:我送的、走過流程或表單綁了流程的提交(跨模組,以租戶為邊界)。 */
@InputType()
export class MyApplicationsInput {
  @Field(() => String, { nullable: true })
  moduleKey?: string | null;

  @Field(() => ID, { nullable: true })
  formKey?: string | null;

  @Field(() => FormSubmissionStatusEnum, { nullable: true })
  status?: FormSubmissionStatusEnum | null;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `每頁筆數,上限 ${String(MAX_PAGE_SIZE)}`,
  })
  pageSize?: number;
}

/** 待我審核:派給我的任務(跨模組)。`done` = false 待處理(`pending`)/ true 已處理。 */
@InputType()
export class MyTasksInput {
  @Field(() => String, { nullable: true })
  moduleKey?: string | null;

  @Field(() => ID, { nullable: true })
  formKey?: string | null;

  /** false = 待處理(`pending`);true = 已處理(`approved` / `rejected` / `returned` / `late`)。 */
  @Field(() => Boolean, { nullable: true, defaultValue: false })
  done?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `每頁筆數,上限 ${String(MAX_PAGE_SIZE)}`,
  })
  pageSize?: number;
}

/** 目前進行中的一關(平行時多個)。 */
@ObjectType()
export class ApplicationActiveStep {
  @Field(() => String)
  stepKey!: string;

  @Field(() => String)
  name!: string;
}

/** 我的申請的一列(申請人讀自己的提交,摘要用提交自己的)。 */
@ObjectType()
export class ApplicationItem {
  /** 提交 id。 */
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  moduleKey!: string;

  @Field(() => String, { nullable: true })
  moduleName!: string | null;

  @Field(() => ID)
  formKey!: string;

  @Field(() => String, { nullable: true })
  formName!: string | null;

  @Field(() => FormSubmissionStatusEnum)
  status!: FormSubmissionStatusEnum;

  /** 審核中但被阻擋(chip 顯示「審核中(待處理)」)。 */
  @Field(() => Boolean)
  blocked!: boolean;

  @Field(() => Int)
  revision!: number;

  @Field(() => FormSubmissionSummary, { nullable: true })
  summary!: FormSubmissionSummary | null;

  /** 進行中或最後一個實例(申請中心詳情頁的 id);沒走過流程為 null。 */
  @Field(() => ID, { nullable: true })
  currentInstanceId!: string | null;

  @Field(() => [ApplicationActiveStep])
  activeSteps!: ApplicationActiveStep[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  submittedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class MyApplicationsPayload {
  @Field(() => [ApplicationItem])
  items!: ApplicationItem[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}

/** 「新申請」:依模組分組、我能新增且綁了流程的表單。 */
@ObjectType()
export class ApplicableModuleForms {
  @Field(() => String)
  moduleKey!: string;

  @Field(() => String, { nullable: true })
  moduleName!: string | null;

  @Field(() => [FormSummary])
  forms!: FormSummary[];
}
