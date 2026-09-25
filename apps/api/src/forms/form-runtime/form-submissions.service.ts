import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import {
  type ExpressionContext,
  type FieldDef,
  type FormDefinition,
  type StoredValues,
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
import type { FormRevision } from "../../database/schemas/form-submission.schema";
import { StorageService } from "../../storage/storage.service";
import { fieldGateOf } from "../field-permission-gate";
import {
  FormAccessService,
  type FormOperatorFacts,
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
import type { FormVersionPayload } from "../models/form-common.model";
import { projectFieldsForReader } from "./definition-projection";
import { DisplayNamesService } from "./display-names.service";
import {
  type CreateFormDraftInput,
  DEFAULT_PAGE_SIZE,
  type DeleteFormSubmissionInput,
  type FormSubmissionsInput,
  MAX_PAGE_SIZE,
  type SaveFormDraftInput,
  type SubmitFormSubmissionInput,
  type UpdateFormSubmissionInput,
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
} as const;

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
    this.access.assertRuntimeAccess(facts, form.moduleKey);
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
      // 草稿只給建立者本人
      $or: [
        { status: "completed" },
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
    const record = await this.findReadable(facts, id);
    const [model] = await this.toModels(facts, [record], revision ?? null);
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
    const record = await this.findReadable(facts, id);
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
    const values = this.viewedRevision(record, revision ?? null).values;
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
    const values = await this.values.apply({
      facts,
      moduleKey: form.moduleKey,
      formKey: form.key,
      fields: version.fields,
      base: {},
      sent: input.values ?? {},
      previous: null,
      ctx: this.draftContext(facts),
      mode: "draft",
    });
    let created: SubmissionRecord;
    try {
      created = await this.submissions.create(operator, {
        moduleKey: form.moduleKey,
        formKey: form.key,
        version: boundVersion,
        values,
        summary: null,
        status: "draft",
        revision: 0,
        revisions: [],
        editVersion: 0,
        clientRequestId,
        submittedAt: null,
      });
    } catch (error) {
      // 同一次請求的重試同時到:另一個先建好了,回那一筆
      if (isDuplicateKeyError(error)) {
        const winner = await this.findRetried(
          facts,
          input.formKey,
          clientRequestId,
        );
        if (winner) {
          return this.single(facts, winner);
        }
      }
      throw error;
    }
    await this.audit.record(operator, {
      action: SUBMISSION_AUDIT.createDraft,
      targetType: SUBMISSION_TARGET,
      targetId: created._id,
      after: { formKey: form.key, version: version.version },
    });
    return this.single(facts, created);
  }

  /** 存草稿:放寬完成資料所需的驗證,寫入守門照常;`expectedEditVersion` 不符 → 409。 */
  async saveDraft(
    facts: FormOperatorFacts,
    input: SaveFormDraftInput,
  ): Promise<FormSubmissionModel> {
    const record = await this.requireOwnDraft(facts, input.id);
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
        status: "draft",
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
   * 送出草稿:以存的值全驗、後端重算 computed、重取選項 / 引用 label、寫摘要;`completed`、`revision = 1`、
   * `revisions[0]` = 快照 + ctx —— `values` / `summary` / `revision` / `revisions` / `editVersion` 同一次更新。
   * 版本已退役的既有草稿仍可送出(寬鬆)。
   */
  async submit(
    facts: FormOperatorFacts,
    input: SubmitFormSubmissionInput,
  ): Promise<FormSubmissionModel> {
    const record = await this.requireOwnDraft(facts, input.id);
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
      previous: null,
      ctx: expressionContextOf(ctx),
      mode: "complete",
    });
    const summary = computeSummary(definitionOf(version), values, {
      submittedAt: at.toISOString(),
    });
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
    if (record?.status !== "completed") {
      if (record) {
        throw conflictError(
          `Submission ${input.id} is not completed`,
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
    if (own?.status === "draft") {
      this.access.assertModulePermission(facts, own.moduleKey, "create");
      record = own;
      deleted = await this.submissions.findOwnAndUpdate(
        facts.operator,
        { _id: id, status: "draft" },
        { $set: { deletedAt: new Date() } },
      );
    } else {
      record = await this.submissions.findById(facts.operator, id);
      if (record?.status !== "completed") {
        throw notFoundError(`Form submission not found: ${input.id}`);
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

  // ---- 內部 ----

  /**
   * 單筆讀取的範圍:一般路徑(可見範圍 + 資料範圍規則)讀不到時,改用「自己建立的」路徑
   * (可見範圍照套、不套資料範圍規則)。別人的草稿一律不存在;已完成要模組 `view`,
   * 自己的草稿有 `view` 或 `create` 即可。
   */
  private async findReadable(
    facts: FormOperatorFacts,
    id: string,
  ): Promise<SubmissionRecord> {
    const objectId = toObjectId(id, "id");
    const record =
      (await this.submissions.findById(facts.operator, objectId)) ??
      (await this.submissions.findOwnById(facts.operator, objectId));
    const isOwner =
      record !== null &&
      facts.operator.actorId !== null &&
      record.createdBy?.equals(facts.operator.actorId) === true;
    if (!record || (record.status === "draft" && !isOwner)) {
      throw notFoundError(`Form submission not found: ${id}`);
    }
    const canView = this.access.has(
      facts,
      formModulePermission(record.moduleKey, "view"),
    );
    const canCreate = this.access.has(
      facts,
      formModulePermission(record.moduleKey, "create"),
    );
    if (!canView && !(record.status === "draft" && canCreate)) {
      throw forbiddenError(`Missing permission ${record.moduleKey}.view`);
    }
    return record;
  }

  /** 草稿只屬於建立者;不是草稿 → 409,不是自己的 → 不存在。 */
  private async requireOwnDraft(
    facts: FormOperatorFacts,
    id: string,
  ): Promise<SubmissionRecord> {
    const record = await this.submissions.findOwnById(
      facts.operator,
      toObjectId(id, "id"),
    );
    if (!record) {
      throw notFoundError(`Form submission not found: ${id}`);
    }
    if (record.status !== "draft") {
      throw conflictError(`Submission ${id} is not a draft`, "STATUS_MISMATCH");
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
      const isDraft = record.status === "draft";
      const canEdit = isDraft
        ? isOwner &&
          this.access.has(
            facts,
            formModulePermission(record.moduleKey, "create"),
          )
        : this.access.has(
            facts,
            formModulePermission(record.moduleKey, "edit"),
          );
      const canDelete = isDraft
        ? canEdit
        : this.access.has(
            facts,
            formModulePermission(record.moduleKey, "delete"),
          );
      return {
        id: String(record._id),
        moduleKey: record.moduleKey,
        formKey: record.formKey,
        formName: formNames.get(record.formKey) ?? null,
        version: record.version,
        status: isDraft
          ? FormSubmissionStatusEnum.DRAFT
          : FormSubmissionStatusEnum.COMPLETED,
        revision: record.revision,
        viewedRevision: viewed.revision,
        values: entry.projected,
        fieldStates: entry.fieldStates,
        displayValues: displays[index] ?? [],
        summary: record.summary
          ? {
              title: record.summary.title,
              date: record.summary.date,
              amount: record.summary.amount ?? null,
            }
          : null,
        ctx: viewed.ctx
          ? {
              at: viewed.ctx.at,
              timezone: viewed.ctx.timezone,
              userId: viewed.ctx.userId ? String(viewed.ctx.userId) : null,
              orgId: viewed.ctx.orgId ? String(viewed.ctx.orgId) : null,
            }
          : null,
        revisions: record.revisions.map((item) => ({
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
        abilities: {
          canEdit,
          canDelete,
          canEditField: canEdit
            ? fields
                .filter((field) => gate.canEdit(fields, field))
                .map((field) => field.key)
            : [],
        },
      };
    });
  }
}
