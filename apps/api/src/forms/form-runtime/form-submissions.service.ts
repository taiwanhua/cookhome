import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import {
  type ExpressionContext,
  type FieldDef,
  type FormDefinition,
  type StoredValues,
  type SubmissionSummary,
  computeSummary,
} from "@repo/domain/form";

import { AuditService } from "../../audit/audit.service";
import type { Persisted } from "../../database/base.repository";
import {
  type FormSubmissionDocument,
  FormSubmissionsRepository,
  FormVersionsRepository,
  FormsRepository,
} from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import type {
  FormRevision,
  FormSubmissionStatus,
} from "../../database/schemas/form-submission.schema";
import { StorageService } from "../../storage/storage.service";
import { InstanceWithdrawService } from "../../workflows/workflow-engine/instance-withdraw.service";
import { SubmissionReadAccess } from "../../workflows/workflow-engine/submission-read-access.service";
import { WorkflowSubmitService } from "../../workflows/workflow-engine/workflow-submit.service";
import { fieldGateOf } from "../field-permission-gate";
import {
  FormAccessService,
  type FormOperatorFacts,
  type FormRecord,
  escapeRegex,
  toObjectId,
} from "../form-access.service";
import {
  FormUserNames,
  type FormVersionRecord,
  toFormVersionModel,
  userRefOf,
} from "../form-mapper";
import { formModulePermission } from "../form-permission-keys";
import { fieldStatesOf, projectValues } from "../form-values/field-states";
import { SubmissionValuesService } from "../form-values/submission-values.service";
import {
  conflictError,
  forbiddenError,
  isDuplicateKeyError,
  notFoundError,
  validationError,
} from "../forms-error";
import { LookupProvidersService } from "../lookup-providers";
import type { FormVersionPayload } from "../models/form-common.model";
import { projectFieldsForReader } from "./definition-projection";
import { DisplayNamesService } from "./display-names.service";
import {
  type CopySubmissionToDraftInput,
  type CreateFormDraftInput,
  DEFAULT_PAGE_SIZE,
  type DeleteFormSubmissionInput,
  type FormSubmissionsInput,
  MAX_PAGE_SIZE,
  type SaveFormDraftInput,
  type SubmitFormSubmissionInput,
  type UpdateFormSubmissionInput,
  type VoidSubmissionInput,
  type WithdrawSubmissionInput,
} from "./dto/form-runtime.input";
import {
  type DeleteFormSubmissionPayload,
  type FormSubmissionModel,
  FormSubmissionSort,
  FormSubmissionStatusEnum,
  type FormSubmissionsPayload,
  type FormSummary,
} from "./models/form-submission.model";

type SubmissionRecord = Persisted<FormSubmissionDocument>;

/** 稽核動作名(`docs/modules/forms.md`「稽核」);值一律不進稽核(可能含受保護欄位)。 */
export const SUBMISSION_AUDIT = {
  createDraft: "submission.create-draft",
  saveDraft: "submission.save-draft",
  submit: "submission.submit",
  update: "submission.update",
  delete: "submission.delete",
  withdraw: "submission.withdraw",
  void: "submission.void",
  copy: "submission.copy",
} as const;

/** 申請人可以改內容(存草稿 / 再送出)的狀態:草稿、被退回、自己撤回(Spec 6b §6)。 */
const APPLICANT_EDITABLE: readonly FormSubmissionStatus[] = [
  "draft",
  "returned",
  "withdrawn",
];

/**
 * 只審過某些修訂的讀者(任務持有者)讀這筆提交時的限制:只列有權讀的修訂,
 * 摘要用該修訂實例上的快照(不讀提交最新的 `summary`)。
 */
interface RevisionRestriction {
  revisions: ReadonlySet<number>;
  summary: SubmissionSummary | null;
}

/** 可讀的一筆:原始文件、限制(全讀為 null)、實際要回的修訂號(null = 目前)。 */
interface ReadableSubmission {
  record: SubmissionRecord;
  restriction: RevisionRestriction | null;
  revision: number | null;
}

const SUBMISSION_TARGET = "form_submission";

const MAX_CLIENT_REQUEST_ID_LENGTH = 100;

const SORTS: Readonly<Record<FormSubmissionSort, Record<string, 1 | -1>>> = {
  [FormSubmissionSort.SUBMITTED_AT_DESC]: { submittedAt: -1, _id: -1 },
  [FormSubmissionSort.SUBMITTED_AT_ASC]: { submittedAt: 1, _id: 1 },
  [FormSubmissionSort.UPDATED_AT_DESC]: { updatedAt: -1, _id: -1 },
};

/** 一次送出 / 修改的上下文 → 表達式的 `ctx.*`(Spec §4 `revisions[].ctx`)。 */
function expressionContextOf(ctx: FormRevision["ctx"]): ExpressionContext {
  return {
    now: new Date(ctx.at).toISOString(),
    timezone: ctx.timezone,
    user: {
      id: ctx.userId ? String(ctx.userId) : null,
      orgId: ctx.orgId ? String(ctx.orgId) : null,
    },
  };
}

function definitionOf(version: FormVersionRecord): FormDefinition {
  return {
    fields: version.fields,
    layout: version.layout,
    summaryMap: version.summaryMap,
    prefills: version.prefills,
  };
}

/**
 * 表單提交(執行端,Spec 6a §6「提交」):草稿 → 送出(即完成)→ 已完成後修改(修訂 +1、完整快照)。
 *
 * - 範圍:`form_submissions` 掛 `tenantScopePlugin({ moduleData: true })`,可見範圍與資料範圍規則
 *   (依 moduleKey)自動套用;草稿只屬於建立者本人(列表不列別人的草稿)
 * - **建立者一律讀得到自己的單**(單筆 `formSubmission(id)`):資料範圍規則把它擋在列表外時,
 *   單筆讀取改用「自己建立的」路徑(可見範圍照套、不套規則);列表**不放寬**
 * - 每次寫入帶 `expectedEditVersion`(已完成修改另帶 `expectedRevision`),條件更新不符 → 409;
 *   `values` / `summary` / `revision` / 快照 / `editVersion` 在**同一次**更新裡寫
 * - 值的寫入規則(四種不能填的原因與順序)在 `form-values/submission-values.service.ts`
 */
/** 落庫狀態 → GraphQL enum(窮舉:新增狀態時編譯器會指到這裡)。 */
function submissionStatusOf(
  status: FormSubmissionStatus,
): FormSubmissionStatusEnum {
  switch (status) {
    case "draft": {
      return FormSubmissionStatusEnum.DRAFT;
    }
    case "reviewing": {
      return FormSubmissionStatusEnum.REVIEWING;
    }
    case "returned": {
      return FormSubmissionStatusEnum.RETURNED;
    }
    case "withdrawn": {
      return FormSubmissionStatusEnum.WITHDRAWN;
    }
    case "completed": {
      return FormSubmissionStatusEnum.COMPLETED;
    }
    case "rejected": {
      return FormSubmissionStatusEnum.REJECTED;
    }
    case "voided": {
      return FormSubmissionStatusEnum.VOIDED;
    }
  }
}

/** 可刪的已送出提交:不綁流程的已完成、已駁回(草稿另判)。 */
function isDeletableRecord(record: {
  status: FormSubmissionStatus;
  currentInstanceId: Types.ObjectId | null;
}): boolean {
  return (
    (record.status === "completed" && record.currentInstanceId === null) ||
    record.status === "rejected"
  );
}

function summaryModelOf(summary: SubmissionSummary | null): {
  title: string | null;
  date: string | null;
  amount: string | null;
} | null {
  return summary
    ? {
        title: summary.title,
        date: summary.date,
        amount: summary.amount ?? null,
      }
    : null;
}

/**
 * 提交層的審核狀態欄位。只審過某修訂的讀者只給那個修訂快照 + 歷程:
 * 提交層的現況(目前實例、阻擋、作廢、複製)一律不給。
 */
function workflowFieldsOf(
  record: {
    currentInstanceId: Types.ObjectId | null;
    blocked: boolean;
    voidedAt: Date | null;
    voidReason: string | null;
    replacedById: Types.ObjectId | null;
    copiedFrom: Types.ObjectId | null;
  },
  isRestricted: boolean,
): Pick<
  FormSubmissionModel,
  | "currentInstanceId"
  | "blocked"
  | "voidedAt"
  | "voidReason"
  | "replacedById"
  | "copiedFrom"
> {
  if (isRestricted) {
    return {
      currentInstanceId: null,
      blocked: false,
      voidedAt: null,
      voidReason: null,
      replacedById: null,
      copiedFrom: null,
    };
  }
  return {
    currentInstanceId: record.currentInstanceId
      ? String(record.currentInstanceId)
      : null,
    blocked: record.blocked,
    voidedAt: record.voidedAt,
    voidReason: record.voidReason,
    replacedById: record.replacedById ? String(record.replacedById) : null,
    copiedFrom: record.copiedFrom ? String(record.copiedFrom) : null,
  };
}

@Injectable()
export class FormSubmissionsService {
  constructor(
    private readonly submissions: FormSubmissionsRepository,
    private readonly versions: FormVersionsRepository,
    private readonly forms: FormsRepository,
    private readonly access: FormAccessService,
    private readonly values: SubmissionValuesService,
    private readonly displayNames: DisplayNamesService,
    private readonly userNames: FormUserNames,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly lookups: LookupProvidersService,
    private readonly workflowSubmit: WorkflowSubmitService,
    private readonly readAccess: SubmissionReadAccess,
    private readonly withdrawal: InstanceWithdrawService,
  ) {}

  // ---- 讀 ----

  /** 新增選單(Spec §3 的交集):一張直接進、多張先選。 */
  async moduleForms(
    facts: FormOperatorFacts,
    moduleKey: string,
  ): Promise<FormSummary[]> {
    await this.access.requireFormModule(facts.operator, moduleKey);
    this.access.assertRuntimeAccess(facts, moduleKey);
    const forms = await this.access.availableForms(facts, moduleKey);
    return forms.map((form) => ({
      key: form.key,
      name: form.name,
      moduleKey: form.moduleKey,
      currentVersion: form.currentVersion ?? 0,
      tabLabelTemplate: form.tabLabelTemplate,
    }));
  }

  /**
   * 填寫端讀某一版的定義(已發布或已退役;草稿不給)。依讀者權限投影:讀不到的欄位只回骨架
   * (`definition-projection.ts`),受保護欄位的固定值、選項、說明不經網路層外流。
   */
  async runtimeVersion(
    facts: FormOperatorFacts,
    formKey: string,
    version: number,
  ): Promise<FormVersionPayload> {
    const form = await this.access.findRuntimeForm(facts, formKey);
    if (!form) {
      throw notFoundError(`Form not found: ${formKey}`);
    }
    // 沒有業務模組權限的審核者(申請中心詳情頁)也要拿得到定義來渲染他審的那筆
    if (!(await this.readAccess.holdsTaskOnForm(facts, formKey))) {
      this.access.assertRuntimeAccess(facts, form.moduleKey);
    }
    const record = await this.versions.findOne(facts.operator, {
      formKey,
      version,
      status: { $in: ["published", "retired"] },
    });
    if (!record) {
      throw notFoundError(
        `Form version not found: ${formKey}@${String(version)}`,
      );
    }
    const names = await this.userNames.load(facts.operator, [
      record.publishedBy,
    ]);
    const gate = fieldGateOf(facts, form.moduleKey, form.key);
    const formVersion = toFormVersionModel(record, names);
    formVersion.fields = projectFieldsForReader(
      record.fields,
      gate,
    ) as unknown as Record<string, unknown>[];
    return { formVersion, validation: null };
  }

  async list(
    facts: FormOperatorFacts,
    input: FormSubmissionsInput,
  ): Promise<FormSubmissionsPayload> {
    this.access.assertModulePermission(facts, input.moduleKey, "view");
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const keyword = input.keyword?.trim();
    const filter: Record<string, unknown> = {
      moduleKey: input.moduleKey,
      ...(input.formKey ? { formKey: input.formKey } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(keyword
        ? { "summary.title": { $regex: escapeRegex(keyword), $options: "i" } }
        : {}),
      // 草稿只給建立者本人;其餘狀態(審核中 / 退回 / 撤回 / 完成 / 駁回 / 作廢)照可見範圍與資料範圍
      $or: [
        { status: { $ne: "draft" } },
        { status: "draft", createdBy: facts.operator.actorId },
      ],
    };
    const [totalCount, records] = await Promise.all([
      this.submissions.count(facts.operator, filter),
      this.submissions.findMany(facts.operator, filter, {
        sort: SORTS[input.sort ?? FormSubmissionSort.SUBMITTED_AT_DESC],
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    ]);
    return {
      items: await this.toModels(facts, records, null),
      totalCount,
      page,
      pageSize,
    };
  }

  /** 單筆;`revision` 省略 = 目前。建立者一律讀得到自己的單(不受資料範圍規則限縮)。 */
  async get(
    facts: FormOperatorFacts,
    id: string,
    revision: number | null | undefined,
  ): Promise<FormSubmissionModel> {
    const readable = await this.findReadable(facts, id, revision ?? null);
    const [model] = await this.toModels(
      facts,
      [readable.record],
      readable.revision,
      readable.restriction,
    );
    if (!model) {
      throw notFoundError(`Form submission not found: ${id}`);
    }
    return model;
  }

  /** 私有附件的短效下載網址:看得到這筆、看得到這一欄(欄位級權限)才簽。 */
  async attachmentUrl(
    facts: FormOperatorFacts,
    id: string,
    fieldKey: string,
    revision: number | null | undefined,
  ): Promise<string> {
    const readable = await this.findReadable(facts, id, revision ?? null);
    const record = readable.record;
    const version = await this.versionOf(facts.operator, record);
    const field = version.fields.find(
      (candidate) => candidate.key === fieldKey,
    );
    if (field?.type !== "upload") {
      throw validationError(`Field ${fieldKey} is not an upload field`, [
        "fieldKey",
      ]);
    }
    const gate = fieldGateOf(facts, record.moduleKey, record.formKey);
    if (!gate.canShow(version.fields, fieldKey)) {
      throw forbiddenError(
        `Field ${fieldKey} is not readable by the operator`,
        "FIELD_FORBIDDEN",
      );
    }
    const values = this.viewedRevision(record, readable.revision).values;
    const stored = values[fieldKey] as { path?: unknown } | null | undefined;
    const url = await this.storage.readUrlOf(
      typeof stored?.path === "string" ? stored.path : null,
    );
    if (url === null) {
      throw notFoundError(`Submission ${id} has no file in ${fieldKey}`);
    }
    return url;
  }

  // ---- 寫 ----

  /** 新增 = 建草稿;同 `(建立者, clientRequestId)` 重試回同一筆(「新增後直接送出」不會建兩筆)。 */
  async createDraft(
    facts: FormOperatorFacts,
    input: CreateFormDraftInput,
  ): Promise<FormSubmissionModel> {
    const operator = facts.operator;
    const clientRequestId = input.clientRequestId.trim();
    if (
      clientRequestId === "" ||
      clientRequestId.length > MAX_CLIENT_REQUEST_ID_LENGTH
    ) {
      throw validationError("clientRequestId must be 1-100 characters", [
        "clientRequestId",
      ]);
    }
    const retried = await this.findRetried(
      facts,
      input.formKey,
      clientRequestId,
    );
    if (retried) {
      return this.single(facts, retried);
    }
    const form = await this.access.requireAvailableForm(facts, input.formKey);
    this.access.assertModulePermission(facts, form.moduleKey, "create");
    const version = await this.versions.findOne(operator, {
      formKey: form.key,
      version: form.currentVersion,
      status: "published",
    });
    const boundVersion = version?.version ?? null;
    if (version === null || boundVersion === null) {
      throw forbiddenError(
        `Form ${form.key} has no published version`,
        "FORM_NOT_AVAILABLE",
      );
    }
    const created = await this.insertDraft(
      facts,
      form,
      version,
      clientRequestId,
      input.values ?? {},
      null,
    );
    return this.single(facts, created);
  }

  /**
   * 建一筆草稿(新增 / 複製為新單共用):值照 6a 的寫入規則(草稿放寬完成資料所需的驗證);
   * 同一次請求的重試同時到、另一個先建好了 → 回那一筆。
   */
  private async insertDraft(
    facts: FormOperatorFacts,
    form: FormRecord,
    version: FormVersionRecord,
    clientRequestId: string,
    sent: StoredValues,
    copiedFrom: Types.ObjectId | null,
  ): Promise<SubmissionRecord> {
    const operator = facts.operator;
    const values = await this.values.apply({
      facts,
      moduleKey: form.moduleKey,
      formKey: form.key,
      fields: version.fields,
      base: {},
      sent,
      previous: null,
      ctx: this.draftContext(facts),
      mode: "draft",
    });
    let created: SubmissionRecord;
    try {
      created = await this.submissions.create(operator, {
        moduleKey: form.moduleKey,
        formKey: form.key,
        version: version.version ?? 0,
        values,
        summary: null,
        status: "draft",
        revision: 0,
        revisions: [],
        editVersion: 0,
        clientRequestId,
        submittedAt: null,
        copiedFrom,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const winner = await this.findRetried(facts, form.key, clientRequestId);
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
    await this.audit.record(operator, {
      action: SUBMISSION_AUDIT.createDraft,
      targetType: SUBMISSION_TARGET,
      targetId: created._id,
      after: {
        formKey: form.key,
        version: version.version,
        ...(copiedFrom === null ? {} : { copiedFrom: String(copiedFrom) }),
      },
    });
    return created;
  }

  /**
   * 存草稿:放寬完成資料所需的驗證,寫入守門照常;`expectedEditVersion` 不符 → 409。
   * 被退回 / 撤回的單也由申請人以此改內容(狀態不變,再送出才進下一個修訂)。
   */
  async saveDraft(
    facts: FormOperatorFacts,
    input: SaveFormDraftInput,
  ): Promise<FormSubmissionModel> {
    const record = await this.requireOwnEditable(facts, input.id);
    this.assertEditVersion(record, input.expectedEditVersion);
    const version = await this.versionOf(facts.operator, record);
    const values = await this.values.apply({
      facts,
      moduleKey: record.moduleKey,
      formKey: record.formKey,
      fields: version.fields,
      base: record.values,
      sent: input.values,
      previous: null,
      ctx: this.draftContext(facts),
      mode: "draft",
    });
    const updated = await this.submissions.findOwnAndUpdate(
      facts.operator,
      {
        _id: record._id,
        status: record.status,
        editVersion: input.expectedEditVersion,
      },
      { $set: { values }, $inc: { editVersion: 1 } },
    );
    if (!updated) {
      throw conflictError(
        `Submission ${input.id} was updated by someone else`,
        "EDIT_VERSION_MISMATCH",
      );
    }
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.saveDraft,
      targetType: SUBMISSION_TARGET,
      targetId: record._id,
      after: { editVersion: updated.editVersion },
    });
    return this.single(facts, updated);
  }

  /**
   * 送出:以存的值全驗、後端重算 computed、重取選項 / 引用 label、寫摘要,再依送出時檢查分兩條路
   * (Spec 6b §3、§6):
   *
   * - **不走流程**(沒綁、也沒進過審核):6a 行為 —— `completed`、`revision = 1`、`revisions[0]` = 快照 + ctx,
   *   `values` / `summary` / `revision` / `revisions` / `editVersion` 同一次更新
   * - **走流程**:`WorkflowSubmitService` 的寫入順序(建 `linking` 實例 → 提交連上並進 `reviewing` →
   *   實例 `running` → 推進);送審不經過 `completed`。被退回 / 撤回後再送出 = 修訂 +1、新實例
   * - 提交已是 `reviewing`(同一次送出的重試):直接接續原實例,不驗、不看綁定、不增加修訂
   *
   * 版本已退役的既有草稿仍可送出(寬鬆)。
   */
  async submit(
    facts: FormOperatorFacts,
    input: SubmitFormSubmissionInput,
  ): Promise<FormSubmissionModel> {
    const record = await this.requireOwnSubmittable(facts, input.id);
    if (record.status === "reviewing") {
      await this.workflowSubmit.resume(record);
      await this.audit.record(facts.operator, {
        action: SUBMISSION_AUDIT.submit,
        targetType: SUBMISSION_TARGET,
        targetId: record._id,
        after: {
          revision: record.revision,
          formKey: record.formKey,
          version: record.version,
          resumed: true,
        },
      });
      return this.single(facts, await this.reloadOwn(facts, record));
    }
    this.assertEditVersion(record, input.expectedEditVersion);
    const version = await this.versionOf(facts.operator, record);
    const at = new Date();
    const ctx = this.revisionContext(facts, at);
    const values = await this.values.apply({
      facts,
      moduleKey: record.moduleKey,
      formKey: record.formKey,
      fields: version.fields,
      base: record.values,
      sent: null,
      previous: record.revisions.at(-1)?.values ?? null,
      ctx: expressionContextOf(ctx),
      mode: "complete",
    });
    const summary = computeSummary(definitionOf(version), values, {
      submittedAt: (record.submittedAt ?? at).toISOString(),
    });
    const route = await this.workflowSubmit.route(record);
    if (route.kind === "workflow") {
      await this.workflowSubmit.submit(
        facts.operator,
        record,
        input.expectedEditVersion,
        { values, summary, ctx, at },
        route,
      );
      await this.audit.record(facts.operator, {
        action: SUBMISSION_AUDIT.submit,
        targetType: SUBMISSION_TARGET,
        targetId: record._id,
        after: {
          revision: record.revision + 1,
          formKey: record.formKey,
          version: record.version,
          workflowKey: route.workflowKey,
          workflowVersion: route.workflowVersion,
        },
      });
      return this.single(facts, await this.reloadOwn(facts, record));
    }
    const updated = await this.submissions.findOwnAndUpdate(
      facts.operator,
      {
        _id: record._id,
        status: "draft",
        editVersion: input.expectedEditVersion,
      },
      {
        $set: {
          values,
          summary,
          status: "completed",
          revision: 1,
          revisions: [{ revision: 1, values, ctx }],
          submittedAt: at,
        },
        $inc: { editVersion: 1 },
      },
    );
    if (!updated) {
      throw conflictError(
        `Submission ${input.id} was updated by someone else`,
        "EDIT_VERSION_MISMATCH",
      );
    }
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.submit,
      targetType: SUBMISSION_TARGET,
      targetId: record._id,
      after: { revision: 1, formKey: record.formKey, version: record.version },
    });
    return this.single(facts, updated);
  }

  /** 已完成後修改:修訂 +1 並存完整快照(需模組 `edit`);兩個預期值任一不符 → 409。 */
  async update(
    facts: FormOperatorFacts,
    input: UpdateFormSubmissionInput,
  ): Promise<FormSubmissionModel> {
    const record = await this.submissions.findById(
      facts.operator,
      toObjectId(input.id, "id"),
    );
    if (record?.status !== "completed" || record.currentInstanceId !== null) {
      if (record) {
        // 綁流程的已完成(走過流程)鎖定、只能作廢(Spec 6b §6)
        throw conflictError(
          `Submission ${input.id} is not an editable completed submission`,
          "STATUS_MISMATCH",
        );
      }
      throw notFoundError(`Form submission not found: ${input.id}`);
    }
    this.access.assertModulePermission(facts, record.moduleKey, "edit");
    this.assertEditVersion(record, input.expectedEditVersion);
    if (record.revision !== input.expectedRevision) {
      throw conflictError(
        `Revision mismatch: expected ${String(input.expectedRevision)}, actual ${String(record.revision)}`,
        "REVISION_MISMATCH",
      );
    }
    const version = await this.versionOf(facts.operator, record);
    const at = new Date();
    const ctx = this.revisionContext(facts, at);
    const values = await this.values.apply({
      facts,
      moduleKey: record.moduleKey,
      formKey: record.formKey,
      fields: version.fields,
      base: record.values,
      sent: input.values,
      previous: record.values,
      ctx: expressionContextOf(ctx),
      mode: "complete",
    });
    const summary = computeSummary(definitionOf(version), values, {
      submittedAt: (record.submittedAt ?? at).toISOString(),
    });
    const revision = record.revision + 1;
    const updated = await this.submissions.findOneAndUpdate(
      facts.operator,
      {
        _id: record._id,
        status: "completed",
        currentInstanceId: null,
        editVersion: input.expectedEditVersion,
        revision: input.expectedRevision,
      },
      {
        $set: { values, summary, revision },
        $push: { revisions: { revision, values, ctx } },
        $inc: { editVersion: 1 },
      },
    );
    if (!updated) {
      throw conflictError(
        `Submission ${input.id} was updated by someone else`,
        "EDIT_VERSION_MISMATCH",
      );
    }
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.update,
      targetType: SUBMISSION_TARGET,
      targetId: record._id,
      before: { revision: record.revision },
      after: { revision },
    });
    return this.single(facts, updated);
  }

  /** 刪除(軟刪除):草稿 = 建立者本人 + `create`;已完成 = 模組 `delete`。 */
  async remove(
    facts: FormOperatorFacts,
    input: DeleteFormSubmissionInput,
  ): Promise<DeleteFormSubmissionPayload> {
    const id = toObjectId(input.id, "id");
    const own = await this.submissions.findOwnById(facts.operator, id);
    let deleted: SubmissionRecord | null;
    let record: SubmissionRecord | null;
    if (own !== null && APPLICANT_EDITABLE.includes(own.status)) {
      // 草稿 / 被退回 / 已撤回:申請人本人可刪(實例已終局,推進只收尾它自己的任務與歷程)
      this.access.assertModulePermission(facts, own.moduleKey, "create");
      record = own;
      deleted = await this.submissions.findOwnAndUpdate(
        facts.operator,
        { _id: id, status: own.status },
        { $set: { deletedAt: new Date() } },
      );
    } else {
      record = await this.submissions.findById(facts.operator, id);
      // 別人的草稿一律不存在(草稿只屬於建立者)
      if (!record || record.status === "draft") {
        throw notFoundError(`Form submission not found: ${input.id}`);
      }
      // 可刪:不綁流程的已完成、已駁回(Spec 6b §6);審核中 / 綁流程的已完成 / 作廢不可刪,
      // 退回 / 撤回只有申請人本人可刪(上一段)
      if (!isDeletableRecord(record)) {
        throw conflictError(
          `Submission ${input.id} cannot be deleted in status ${record.status}`,
          "STATUS_MISMATCH",
        );
      }
      this.access.assertModulePermission(facts, record.moduleKey, "delete");
      deleted = await this.submissions.softDeleteById(facts.operator, id);
    }
    if (!deleted) {
      throw notFoundError(`Form submission not found: ${input.id}`);
    }
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.delete,
      targetType: SUBMISSION_TARGET,
      targetId: record._id,
      before: { status: record.status, revision: record.revision },
    });
    return { success: true, deletedId: String(record._id) };
  }

  // ---- 審核流程的提交動作(Spec 6b §6)----

  /**
   * 撤回(申請人本人;審核中、還沒有任何被接受的審核意見):實例 CAS → `withdrawn`,
   * 推進收尾把提交同步成 `withdrawn`(可改後再送)。已有審核意見 → `CONFLICT`(`HAS_DECISIONS`)。
   */
  async withdraw(
    facts: FormOperatorFacts,
    input: WithdrawSubmissionInput,
  ): Promise<FormSubmissionModel> {
    const record = await this.submissions.findOwnById(
      facts.operator,
      toObjectId(input.id, "id"),
    );
    if (!record) {
      throw notFoundError(`Form submission not found: ${input.id}`);
    }
    if (record.status !== "reviewing" || record.currentInstanceId === null) {
      throw conflictError(
        `Submission ${input.id} is not under review`,
        "STATUS_MISMATCH",
      );
    }
    this.assertEditVersion(record, input.expectedEditVersion);
    await this.withdrawal.withdraw(
      record.currentInstanceId,
      facts.operator.actorId ?? record._id,
    );
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.withdraw,
      targetType: SUBMISSION_TARGET,
      targetId: record._id,
      before: { revision: record.revision },
    });
    return this.single(facts, await this.reloadOwn(facts, record));
  }

  /**
   * 作廢(綁流程且已核准;申請人本人或有該模組 `edit` 者;理由必填;不需審核):提交 → `voided`,內容凍結。
   */
  async voidSubmission(
    facts: FormOperatorFacts,
    input: VoidSubmissionInput,
  ): Promise<FormSubmissionModel> {
    const reason = input.reason.trim();
    if (reason === "") {
      throw validationError("reason is required", ["reason"]);
    }
    const id = toObjectId(input.id, "id");
    const own = await this.submissions.findOwnById(facts.operator, id);
    const record = own ?? (await this.submissions.findById(facts.operator, id));
    if (!record) {
      throw notFoundError(`Form submission not found: ${input.id}`);
    }
    if (own === null) {
      this.access.assertModulePermission(facts, record.moduleKey, "edit");
    }
    if (record.status !== "completed" || record.currentInstanceId === null) {
      throw conflictError(
        `Submission ${input.id} is not an approved workflow submission`,
        "STATUS_MISMATCH",
      );
    }
    this.assertEditVersion(record, input.expectedEditVersion);
    const filter = {
      _id: id,
      status: "completed" as const,
      currentInstanceId: { $ne: null },
      editVersion: input.expectedEditVersion,
    };
    const update = {
      $set: {
        status: "voided",
        voidedAt: new Date(),
        voidedBy: facts.operator.actorId,
        voidReason: reason,
      },
      $inc: { editVersion: 1 },
    };
    const updated =
      own === null
        ? await this.submissions.findOneAndUpdate(
            facts.operator,
            filter,
            update,
          )
        : await this.submissions.findOwnAndUpdate(
            facts.operator,
            filter,
            update,
          );
    if (!updated) {
      throw conflictError(
        `Submission ${input.id} was updated by someone else`,
        "EDIT_VERSION_MISMATCH",
      );
    }
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.void,
      targetType: SUBMISSION_TARGET,
      targetId: record._id,
      before: { status: record.status, revision: record.revision },
      after: { status: "voided", reason },
    });
    return this.single(facts, updated);
  }

  /**
   * 複製為新單(`copySubmissionToDraft`,專用操作,不走一般帶入 / lookup):來源 = 已作廢、讀者讀得到全部內容;
   * 目標 = 同表單**目前可新增的版本**。只複製「讀者對來源有 `show`、目標版本有同 key 同型別的使用者填欄位、
   * 讀者對目標有 `edit`」的欄位;`computed` / `constant` 由目標版本重算;引用重驗來源可讀,失效 → 清空並列在
   * `clearedFields`;附件複製一份儲存路徑歸新單(沿用 6a 的上傳驗證)。`clientRequestId` 去重;
   * 新草稿記 `copiedFrom`,來源記 `replacedById`。
   */
  async copyToDraft(
    facts: FormOperatorFacts,
    input: CopySubmissionToDraftInput,
  ): Promise<FormSubmissionModel> {
    const clientRequestId = this.requireClientRequestId(input.clientRequestId);
    const readable = await this.findReadable(facts, input.id, null);
    const source = readable.record;
    if (readable.restriction !== null) {
      throw forbiddenError(
        `Submission ${input.id} cannot be copied by a reviewer`,
      );
    }
    if (source.status !== "voided") {
      throw conflictError(
        `Only voided submissions can be copied (status ${source.status})`,
        "STATUS_MISMATCH",
      );
    }
    const retried = await this.findRetried(
      facts,
      source.formKey,
      clientRequestId,
    );
    if (retried) {
      return this.single(facts, retried);
    }
    if (source.replacedById !== null) {
      throw conflictError(
        `Submission ${input.id} was already copied to ${String(source.replacedById)}`,
        "ALREADY_COPIED",
      );
    }
    const form = await this.access.requireAvailableForm(facts, source.formKey);
    this.access.assertModulePermission(facts, form.moduleKey, "create");
    const target = await this.versions.findOne(facts.operator, {
      formKey: form.key,
      version: form.currentVersion,
      status: "published",
    });
    if (target?.version === null || target === null) {
      throw forbiddenError(
        `Form ${form.key} has no published version`,
        "FORM_NOT_AVAILABLE",
      );
    }
    const sourceVersion = await this.versionOf(facts.operator, source);
    const { values, cleared } = await this.copiedValues(
      facts,
      source,
      sourceVersion.fields,
      target.fields,
    );
    const created = await this.insertDraft(
      facts,
      form,
      target,
      clientRequestId,
      values,
      source._id,
    );
    const isOwner =
      facts.operator.actorId !== null &&
      source.createdBy?.equals(facts.operator.actorId) === true;
    const link = { $set: { replacedById: created._id } };
    const linkFilter = { _id: source._id, replacedById: null };
    await (isOwner
      ? this.submissions.findOwnAndUpdate(facts.operator, linkFilter, link)
      : this.submissions.findOneAndUpdate(facts.operator, linkFilter, link));
    await this.audit.record(facts.operator, {
      action: SUBMISSION_AUDIT.copy,
      targetType: SUBMISSION_TARGET,
      targetId: created._id,
      before: { sourceId: String(source._id) },
      after: {
        sourceId: String(source._id),
        newId: String(created._id),
        clearedFields: cleared,
      },
    });
    const model = await this.single(facts, created);
    model.clearedFields = cleared;
    return model;
  }

  // ---- 內部 ----

  private requireClientRequestId(raw: string): string {
    const clientRequestId = raw.trim();
    if (
      clientRequestId === "" ||
      clientRequestId.length > MAX_CLIENT_REQUEST_ID_LENGTH
    ) {
      throw validationError("clientRequestId must be 1-100 characters", [
        "clientRequestId",
      ]);
    }
    return clientRequestId;
  }

  /** 複製為新單要帶過去的值(見 `copyToDraft`);回值與被清空的引用欄位。 */
  private async copiedValues(
    facts: FormOperatorFacts,
    source: SubmissionRecord,
    sourceFields: readonly FieldDef[],
    targetFields: readonly FieldDef[],
  ): Promise<{ values: StoredValues; cleared: string[] }> {
    const gate = fieldGateOf(facts, source.moduleKey, source.formKey);
    const values: StoredValues = {};
    const cleared: string[] = [];
    for (const field of targetFields) {
      const from = sourceFields.find(
        (candidate) => candidate.key === field.key,
      );
      const value = source.values[field.key];
      if (
        from?.type !== field.type ||
        field.valueSource.kind !== "input" ||
        value === null ||
        value === undefined ||
        !gate.canShow(sourceFields, field.key) ||
        !gate.canEdit(targetFields, field)
      ) {
        continue;
      }
      const copied = await this.copiedValueOf(facts, field, value);
      if (copied === undefined) {
        cleared.push(field.key);
      } else {
        values[field.key] = copied;
      }
    }
    return { values, cleared };
  }

  /** 一欄的複製值:引用失效、附件複製不成 → undefined(清空並列在 `clearedFields`)。 */
  private async copiedValueOf(
    facts: FormOperatorFacts,
    field: FieldDef,
    value: unknown,
  ): Promise<unknown> {
    if (field.type === "reference") {
      const id = (value as { id?: unknown }).id;
      const source = field.source;
      if (typeof id !== "string" || !source) {
        return undefined;
      }
      const [record] = await this.lookups.findByValues(
        facts,
        source,
        "id",
        [id],
        [source.labelField],
        { publicOnly: true },
      );
      return record ? value : undefined;
    }
    if (field.type === "upload") {
      const upload = value as Record<string, unknown>;
      try {
        const path = await this.storage.copyPrivateObject(
          typeof upload.path === "string" ? upload.path : null,
        );
        return path === null ? undefined : { ...upload, path };
      } catch {
        // 供應商端複製失敗:不擋整張新單,清空該欄並提示使用者重傳
        return undefined;
      }
    }
    return value;
  }

  /**
   * 這筆對操作者允許的動作(含權限,業務模組那一種 `abilities`):
   * - 改:申請人改草稿 / 退回 / 撤回(`create`);不綁流程的已完成(`edit`);綁流程的已完成鎖定
   * - 刪:草稿 / 被退回 / 撤回 = 申請人本人(`create`);不綁流程的已完成 / 已駁回(`delete`)
   * - 撤回:申請人、審核中;作廢:綁流程的已完成、申請人或 `edit`;複製為新單:已作廢 + `create`
   */
  private abilitiesOf(
    facts: FormOperatorFacts,
    record: SubmissionRecord,
    isOwner: boolean,
  ): {
    canEdit: boolean;
    canDelete: boolean;
    canWithdraw: boolean;
    canVoid: boolean;
    canCopy: boolean;
  } {
    const can = (action: "view" | "create" | "edit" | "delete"): boolean =>
      this.access.has(facts, formModulePermission(record.moduleKey, action));
    const isBound = record.currentInstanceId !== null;
    const isApplicantEditable =
      isOwner && APPLICANT_EDITABLE.includes(record.status) && can("create");
    const canEdit =
      isApplicantEditable ||
      (record.status === "completed" && !isBound && can("edit"));
    const canDelete =
      APPLICANT_EDITABLE.includes(record.status) && isOwner
        ? isApplicantEditable
        : isDeletableRecord(record) && can("delete");
    return {
      canEdit,
      canDelete,
      canWithdraw: isOwner && record.status === "reviewing",
      canVoid:
        record.status === "completed" && isBound && (isOwner || can("edit")),
      canCopy: record.status === "voided" && can("create"),
    };
  }

  /** 重讀自己的一筆(寫入後回傳最新狀態)。 */
  private async reloadOwn(
    facts: FormOperatorFacts,
    record: SubmissionRecord,
  ): Promise<SubmissionRecord> {
    return (
      (await this.submissions.findOwnById(facts.operator, record._id)) ?? record
    );
  }

  /**
   * 單筆讀取的範圍(`canReadSubmissionRevision`,Spec 6b §3):
   *
   * 1. 一般路徑(可見範圍 + 資料範圍規則)或「自己建立的」路徑讀得到:建立者一律可讀(含所有修訂);
   *    別人的草稿一律不存在;其他人要模組 `view`
   * 2. 讀不到或沒有 `view`:以讀者的租戶為邊界找提交,任務持有者(現在或曾經)**只**讀他審過的那幾個修訂
   *    (`revision` 省略 = 其中最新的一個),摘要改用該修訂實例上的快照
   */
  private async findReadable(
    facts: FormOperatorFacts,
    id: string,
    revision: number | null,
  ): Promise<ReadableSubmission> {
    const objectId = toObjectId(id, "id");
    const record =
      (await this.submissions.findById(facts.operator, objectId)) ??
      (await this.submissions.findOwnById(facts.operator, objectId));
    const isOwner =
      record !== null &&
      facts.operator.actorId !== null &&
      record.createdBy?.equals(facts.operator.actorId) === true;
    if (record && (isOwner || this.canViewModule(facts, record))) {
      if (record.status === "draft" && !isOwner) {
        throw notFoundError(`Form submission not found: ${id}`);
      }
      return { record, restriction: null, revision };
    }
    const stored = await this.readAccess.findInTenant(facts, objectId);
    const readable = stored
      ? await this.readAccess.readableRevisions(facts, stored)
      : ({ kind: "none" } as const);
    if (stored === null || readable.kind === "none") {
      if (record && record.status !== "draft") {
        throw forbiddenError(`Missing permission ${record.moduleKey}.view`);
      }
      throw notFoundError(`Form submission not found: ${id}`);
    }
    const asRecord = stored as unknown as SubmissionRecord;
    if (readable.kind === "all") {
      return { record: asRecord, restriction: null, revision };
    }
    const target = revision ?? Math.max(...readable.revisions);
    if (!readable.revisions.has(target)) {
      throw forbiddenError(
        `Revision ${String(target)} of submission ${id} is not readable by the operator`,
      );
    }
    return {
      record: asRecord,
      restriction: {
        revisions: readable.revisions,
        summary: await this.readAccess.revisionSummaryOf(stored._id, target),
      },
      revision: target,
    };
  }

  private canViewModule(
    facts: FormOperatorFacts,
    record: SubmissionRecord,
  ): boolean {
    return this.access.has(
      facts,
      formModulePermission(record.moduleKey, "view"),
    );
  }

  /** 申請人改內容(存草稿):草稿 / 被退回 / 撤回;其他狀態 → 409,不是自己的 → 不存在。 */
  private async requireOwnEditable(
    facts: FormOperatorFacts,
    id: string,
  ): Promise<SubmissionRecord> {
    return this.requireOwnIn(facts, id, APPLICANT_EDITABLE);
  }

  /** 送出:可改內容的三種 + 審核中(同一次送出的重試,第 0 步接續)。 */
  private async requireOwnSubmittable(
    facts: FormOperatorFacts,
    id: string,
  ): Promise<SubmissionRecord> {
    return this.requireOwnIn(facts, id, [...APPLICANT_EDITABLE, "reviewing"]);
  }

  private async requireOwnIn(
    facts: FormOperatorFacts,
    id: string,
    statuses: readonly FormSubmissionStatus[],
  ): Promise<SubmissionRecord> {
    const record = await this.submissions.findOwnById(
      facts.operator,
      toObjectId(id, "id"),
    );
    if (!record) {
      throw notFoundError(`Form submission not found: ${id}`);
    }
    if (!statuses.includes(record.status)) {
      throw conflictError(
        `Submission ${id} cannot be changed in status ${record.status}`,
        "STATUS_MISMATCH",
      );
    }
    this.access.assertModulePermission(facts, record.moduleKey, "create");
    return record;
  }

  private assertEditVersion(record: SubmissionRecord, expected: number): void {
    if (record.editVersion !== expected) {
      throw conflictError(
        `Edit version mismatch: expected ${String(expected)}, actual ${String(record.editVersion)}`,
        "EDIT_VERSION_MISMATCH",
      );
    }
  }

  /** `clientRequestId` 的重試:同一人同一個 id 已建過 → 回那一筆(不同表單或已刪 → 409)。 */
  private async findRetried(
    facts: FormOperatorFacts,
    formKey: string,
    clientRequestId: string,
  ): Promise<SubmissionRecord | null> {
    const existing = await this.submissions.findOwnOne(
      facts.operator,
      { clientRequestId },
      { includeDeleted: true },
    );
    if (!existing) {
      return null;
    }
    if (existing.formKey !== formKey || existing.deletedAt !== null) {
      throw conflictError(
        `clientRequestId ${clientRequestId} was already used`,
        "CLIENT_REQUEST_REUSED",
      );
    }
    return existing;
  }

  private async versionOf(
    operator: OperatorContext,
    record: SubmissionRecord,
  ): Promise<FormVersionRecord> {
    const version = await this.versions.findOne(operator, {
      formKey: record.formKey,
      version: record.version,
    });
    if (!version) {
      throw new Error(
        `提交 ${String(record._id)} 綁的版本 ${record.formKey}@${String(record.version)} 不存在`,
      );
    }
    return version;
  }

  /** 草稿的條件上下文:真正的現在與填寫者本人。 */
  private draftContext(facts: FormOperatorFacts): ExpressionContext {
    return expressionContextOf(this.revisionContext(facts, new Date()));
  }

  private revisionContext(
    facts: FormOperatorFacts,
    at: Date,
  ): FormRevision["ctx"] {
    return {
      at,
      timezone: facts.timezone,
      userId: facts.operator.actorId,
      orgId: facts.operator.currentOrgId,
    };
  }

  /** 讀哪一個修訂的值與 ctx;`revision` 不存在 → `NOT_FOUND`。草稿回目前值、ctx 為 null。 */
  private viewedRevision(
    record: SubmissionRecord,
    revision: number | null,
  ): {
    revision: number;
    values: StoredValues;
    ctx: FormRevision["ctx"] | null;
  } {
    if (revision === null) {
      const latest = record.revisions.at(-1);
      return {
        revision: record.revision,
        values: record.values,
        ctx: latest?.ctx ?? null,
      };
    }
    const found = record.revisions.find((entry) => entry.revision === revision);
    if (!found) {
      throw notFoundError(
        `Revision ${String(revision)} of submission ${String(record._id)} not found`,
      );
    }
    return { revision, values: found.values, ctx: found.ctx };
  }

  private async single(
    facts: FormOperatorFacts,
    record: SubmissionRecord,
  ): Promise<FormSubmissionModel> {
    const [model] = await this.toModels(facts, [record], null);
    if (!model) {
      throw notFoundError(`Form submission not found: ${String(record._id)}`);
    }
    return model;
  }

  /**
   * 對外形狀(整頁一次組):讀者沒有 `show` 的欄位投影成 `"[redacted]"`(看**現在的讀者**);
   * 條件用該修訂的 `ctx` 重算(草稿用現在與建立者);不重算、不清空存值;顯示名批次解析。
   */
  private async toModels(
    facts: FormOperatorFacts,
    records: readonly SubmissionRecord[],
    revision: number | null,
    restriction: RevisionRestriction | null = null,
  ): Promise<FormSubmissionModel[]> {
    const operator = facts.operator;
    const versionCache = new Map<string, FormVersionRecord>();
    const formNames = new Map<string, string | null>();
    for (const record of records) {
      const cacheKey = `${record.formKey}@${String(record.version)}`;
      if (!versionCache.has(cacheKey)) {
        versionCache.set(cacheKey, await this.versionOf(operator, record));
      }
      if (!formNames.has(record.formKey)) {
        const form = await this.forms.findOne(operator, {
          key: record.formKey,
        });
        formNames.set(record.formKey, form?.name ?? null);
      }
    }
    const userIds: (Types.ObjectId | null)[] = [];
    for (const record of records) {
      userIds.push(record.createdBy);
      for (const entry of record.revisions) {
        userIds.push(entry.ctx.userId);
      }
    }
    const names = await this.userNames.load(operator, userIds);

    const prepared = records.map((record) => {
      const version = versionCache.get(
        `${record.formKey}@${String(record.version)}`,
      );
      const fields: readonly FieldDef[] = version?.fields ?? [];
      const viewed = this.viewedRevision(record, revision);
      const gate = fieldGateOf(facts, record.moduleKey, record.formKey);
      const conditionCtx = viewed.ctx
        ? expressionContextOf(viewed.ctx)
        : expressionContextOf({
            at: new Date(),
            timezone: facts.timezone,
            userId: record.createdBy,
            orgId: record.orgId,
          });
      return {
        record,
        fields,
        viewed,
        gate,
        projected: projectValues(fields, viewed.values, gate),
        fieldStates: fieldStatesOf(fields, viewed.values, conditionCtx, gate),
      };
    });
    const displays = await this.displayNames.resolve(
      facts,
      prepared.map((entry) => ({
        fields: entry.fields,
        values: entry.projected,
      })),
    );

    return prepared.map((entry, index): FormSubmissionModel => {
      const { record, fields, viewed, gate } = entry;
      const isOwner =
        facts.operator.actorId !== null &&
        record.createdBy?.equals(facts.operator.actorId) === true;
      const abilities =
        restriction === null
          ? this.abilitiesOf(facts, record, isOwner)
          : {
              canEdit: false,
              canDelete: false,
              canWithdraw: false,
              canVoid: false,
              canCopy: false,
            };
      return {
        id: String(record._id),
        moduleKey: record.moduleKey,
        formKey: record.formKey,
        formName: formNames.get(record.formKey) ?? null,
        version: record.version,
        status: submissionStatusOf(record.status),
        revision: record.revision,
        viewedRevision: viewed.revision,
        values: entry.projected,
        fieldStates: entry.fieldStates,
        displayValues: displays[index] ?? [],
        summary: summaryModelOf(
          restriction === null ? record.summary : restriction.summary,
        ),
        ctx: viewed.ctx
          ? {
              at: viewed.ctx.at,
              timezone: viewed.ctx.timezone,
              userId: viewed.ctx.userId ? String(viewed.ctx.userId) : null,
              orgId: viewed.ctx.orgId ? String(viewed.ctx.orgId) : null,
            }
          : null,
        revisions: record.revisions
          .filter(
            (item) =>
              restriction === null || restriction.revisions.has(item.revision),
          )
          .map((item) => ({
            revision: item.revision,
            at: item.ctx.at,
            user: userRefOf(item.ctx.userId, names),
          })),
        editVersion: record.editVersion,
        orgId: String(record.orgId),
        createdBy: userRefOf(record.createdBy, names),
        submittedAt: record.submittedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...workflowFieldsOf(record, restriction !== null),
        clearedFields: [],
        abilities: {
          ...abilities,
          canEditField: abilities.canEdit
            ? fields
                .filter((field) => gate.canEdit(fields, field))
                .map((field) => field.key)
            : [],
        },
      };
    });
  }
}
