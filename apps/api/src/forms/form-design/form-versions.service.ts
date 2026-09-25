import { Injectable } from "@nestjs/common";

import {
  type ExpressionContext,
  type FormDefinition,
  computeSummary,
} from "@repo/domain/form";

import { AuditService } from "../../audit/audit.service";
import {
  FormVersionsRepository,
  FormsRepository,
} from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import type { FieldGate } from "../field-permission-gate";
import {
  FormAccessService,
  type FormOperatorFacts,
  type FormRecord,
} from "../form-access.service";
import {
  FormUserNames,
  type FormVersionRecord,
  toFormVersionModel,
  toValidationReport,
} from "../form-mapper";
import { fieldStatesOf } from "../form-values/field-states";
import { SubmissionValuesService } from "../form-values/submission-values.service";
import {
  conflictError,
  definitionInvalidError,
  isDuplicateKeyError,
  notFoundError,
  validationError,
} from "../forms-error";
import type {
  FormValidationReport,
  FormVersionModel,
  FormVersionPayload,
} from "../models/form-common.model";
import type {
  CreateFormVersionDraftInput,
  FormKeyInput,
  PreviewFormVersionInput,
  SaveFormVersionDraftInput,
  ValidateFormVersionInput,
} from "./dto/form-design.input";
import { FormDefinitionChecker, definitionOf } from "./form-definition-checker";
import {
  FORM_VERSION_AUDIT,
  FORM_VERSION_TARGET,
  FormPublishService,
} from "./form-publish.service";
import type {
  FormPreviewPayload,
  FormVersionsPayload,
} from "./models/form.model";

/** 存草稿時就要擋的錯(Spec §5「正則」:存草稿與發布時驗過 ReDoS 才收);其餘錯誤草稿可以先存。 */
const DRAFT_BLOCKING_CODES = new Set(["PATTERN_INVALID", "PATTERN_UNSAFE"]);

const EMPTY_DEFINITION: FormDefinition = {
  fields: [],
  layout: { sections: [] },
  summaryMap: {},
  prefills: [],
};

/**
 * 表單版本(設計端):讀、開草稿、存草稿、檢查器、預覽、退役目前版本;發布在 `FormPublishService`。
 * 草稿一張表單同時只有一份(部分唯一索引);`draftRevision` 是存草稿與發布的樂觀鎖。
 */
@Injectable()
export class FormVersionsService {
  constructor(
    private readonly forms: FormsRepository,
    private readonly versions: FormVersionsRepository,
    private readonly access: FormAccessService,
    private readonly checker: FormDefinitionChecker,
    private readonly publisher: FormPublishService,
    private readonly values: SubmissionValuesService,
    private readonly userNames: FormUserNames,
    private readonly audit: AuditService,
  ) {}

  /** 某一版;`version` 省略 = 草稿(附檢查器結果)。 */
  async get(
    facts: FormOperatorFacts,
    formKey: string,
    version: number | null | undefined,
  ): Promise<FormVersionPayload> {
    const form = await this.access.requireReadableForm(facts, formKey);
    const record =
      version === null || version === undefined
        ? await this.versions.findOne(facts.operator, {
            formKey: form.key,
            status: "draft",
          })
        : await this.versions.findOne(facts.operator, {
            formKey: form.key,
            version,
          });
    if (!record) {
      throw notFoundError(
        `Form version not found: ${formKey}@${String(version ?? "draft")}`,
      );
    }
    return this.payloadOf(facts, form, record);
  }

  /** 版本面板:全部版本(草稿在最前,其餘新到舊)。 */
  async list(
    facts: FormOperatorFacts,
    formKey: string,
  ): Promise<FormVersionsPayload> {
    const form = await this.access.requireReadableForm(facts, formKey);
    const records = await this.versions.findMany(
      facts.operator,
      { formKey: form.key },
      { sort: { version: -1, _id: -1 } },
    );
    const ordered = [
      ...records.filter((record) => record.version === null),
      ...records.filter((record) => record.version !== null),
    ];
    const names = await this.userNames.load(
      facts.operator,
      ordered.map((record) => record.publishedBy),
    );
    return {
      items: ordered.map((record) => toFormVersionModel(record, names)),
      totalCount: ordered.length,
    };
  }

  /** 以任一版(已發布 / 退役)為基底開草稿;已有草稿 / 發布中 → 409。 */
  async createDraft(
    facts: FormOperatorFacts,
    input: CreateFormVersionDraftInput,
  ): Promise<FormVersionPayload> {
    const operator = facts.operator;
    const form = await this.access.requireWritableForm(facts, input.formKey);
    await this.publisher.assertNotPublishing(operator, form);
    const existing = await this.versions.findOne(operator, {
      formKey: form.key,
      status: "draft",
    });
    if (existing) {
      throw conflictError(
        `Form ${form.key} already has a draft`,
        "DRAFT_EXISTS",
      );
    }
    const base = await this.baseDefinitionOf(operator, form, input.baseVersion);
    let created: FormVersionRecord;
    try {
      created = await this.versions.create(operator, {
        formKey: form.key,
        version: null,
        status: "draft",
        draftRevision: 0,
        baseVersion: input.baseVersion ?? null,
        ...base,
        changelog: null,
        publishedAt: null,
        publishedBy: null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflictError(
          `Form ${form.key} already has a draft`,
          "DRAFT_EXISTS",
        );
      }
      throw error;
    }
    await this.audit.record(operator, {
      action: FORM_VERSION_AUDIT.createDraft,
      targetType: FORM_VERSION_TARGET,
      targetId: created._id,
      after: { formKey: form.key, baseVersion: input.baseVersion ?? null },
    });
    return this.payloadOf(facts, form, created);
  }

  /** 基底版本的定義(複製欄位、版面、摘要槽、帶入規則);不給 = 空白。 */
  async baseDefinitionOf(
    operator: OperatorContext,
    form: FormRecord,
    baseVersion: number | null | undefined,
  ): Promise<FormDefinition> {
    if (baseVersion === null || baseVersion === undefined) {
      return { ...EMPTY_DEFINITION, layout: { sections: [] } };
    }
    const source = await this.versions.findOne(operator, {
      formKey: form.key,
      version: baseVersion,
      status: { $in: ["published", "retired"] },
    });
    if (!source) {
      throw validationError(
        `Version ${String(baseVersion)} of ${form.key} cannot be a base`,
        ["baseVersion"],
      );
    }
    return {
      fields: source.fields,
      layout: source.layout,
      summaryMap: source.summaryMap,
      prefills: source.prefills,
    };
  }

  /** 存草稿(`expectedDraftRevision` 樂觀鎖);檢查器的錯草稿可以先存,但正則不安全不收。 */
  async saveDraft(
    facts: FormOperatorFacts,
    input: SaveFormVersionDraftInput,
  ): Promise<FormVersionPayload> {
    const operator = facts.operator;
    const form = await this.access.requireWritableForm(facts, input.formKey);
    const definition = definitionOf(input);
    const report = await this.checker.check(facts, form, definition);
    const blocking = report.errors.filter((issue) =>
      DRAFT_BLOCKING_CODES.has(issue.code),
    );
    if (blocking.length > 0) {
      throw definitionInvalidError(
        "Draft has an invalid or unsafe regular expression",
        blocking,
      );
    }
    const updated = await this.versions.findOneAndUpdate(
      operator,
      {
        formKey: form.key,
        status: "draft",
        draftRevision: input.expectedDraftRevision,
      },
      {
        $set: {
          fields: definition.fields,
          layout: definition.layout,
          summaryMap: definition.summaryMap,
          prefills: definition.prefills,
        },
        $inc: { draftRevision: 1 },
      },
    );
    if (!updated) {
      const draft = await this.versions.findOne(operator, {
        formKey: form.key,
        status: "draft",
      });
      throw draft
        ? conflictError(
            `Draft revision mismatch: expected ${String(input.expectedDraftRevision)}, actual ${String(draft.draftRevision)}`,
            "DRAFT_REVISION_MISMATCH",
          )
        : conflictError(`Form ${form.key} has no draft`, "DRAFT_MISSING");
    }
    await this.audit.record(operator, {
      action: FORM_VERSION_AUDIT.saveDraft,
      targetType: FORM_VERSION_TARGET,
      targetId: updated._id,
      after: {
        formKey: form.key,
        draftRevision: updated.draftRevision,
        fieldCount: definition.fields.length,
      },
    });
    return {
      formVersion: await this.modelOf(operator, updated),
      validation: toValidationReport(report),
    };
  }

  /** 設計器即時檢查,不落庫。 */
  async validate(
    facts: FormOperatorFacts,
    input: ValidateFormVersionInput,
  ): Promise<FormValidationReport> {
    const form = await this.access.requireReadableForm(facts, input.formKey);
    return toValidationReport(
      await this.checker.check(facts, form, definitionOf(input)),
    );
  }

  /** 退役目前版本:`published → retired`,再 `currentVersion → null`;中斷後再呼叫一次會接著做完。 */
  async retireCurrent(
    facts: FormOperatorFacts,
    input: FormKeyInput,
  ): Promise<FormRecord> {
    const operator = facts.operator;
    const form = await this.access.requireWritableForm(facts, input.formKey);
    await this.publisher.assertNotPublishing(operator, form);
    if (form.currentVersion === null) {
      throw conflictError(
        `Form ${form.key} has no current version`,
        "NO_CURRENT_VERSION",
      );
    }
    const retired = await this.versions.findOneAndUpdate(
      operator,
      { formKey: form.key, version: form.currentVersion, status: "published" },
      { $set: { status: "retired" } },
    );
    // 條件更新:讀到之後 currentVersion 被別人動過(另一次退役 / 發布)→ 409,不蓋掉
    const updated = await this.forms.findOneAndUpdate(
      operator,
      { _id: form._id, currentVersion: form.currentVersion },
      { $set: { currentVersion: null } },
    );
    if (!updated) {
      throw conflictError(
        `Form ${form.key} current version changed while retiring`,
        "CURRENT_VERSION_CHANGED",
      );
    }
    await this.audit.record(operator, {
      action: FORM_VERSION_AUDIT.retire,
      targetType: FORM_VERSION_TARGET,
      ...(retired ? { targetId: retired._id } : {}),
      before: { formKey: form.key, currentVersion: form.currentVersion },
      after: { currentVersion: null },
    });
    return updated;
  }

  /**
   * 設計器「預覽」:對**草稿**跑計算與條件(以真正的現在與操作者本人為 `ctx`),不建提交。
   * 預覽不套欄位級權限(設計者看得到整張表單);「以某角色檢視」留給前端切換。
   */
  async preview(
    facts: FormOperatorFacts,
    input: PreviewFormVersionInput,
  ): Promise<FormPreviewPayload> {
    const form = await this.access.requireReadableForm(facts, input.formKey);
    const draft = await this.versions.findOne(facts.operator, {
      formKey: form.key,
      status: "draft",
    });
    if (!draft) {
      throw notFoundError(`Form ${form.key} has no draft`);
    }
    // 「不套欄位級權限」只指**本表單**的欄位:閘門只對本表單全開;lookup / 引用的來源
    // 照樣用操作者真實的權限(否則設計者可以用預覽讀出別張表單的受保護欄位)
    const designerGate: FieldGate = {
      canShow: () => true,
      canEdit: (_fields, field) => field.valueSource.kind === "input",
    };
    const ctx = contextOf(facts);
    const { values, issues } = await this.values.evaluate({
      facts,
      gate: designerGate,
      moduleKey: form.moduleKey,
      formKey: form.key,
      fields: draft.fields,
      base: {},
      sent: input.values ?? {},
      previous: null,
      ctx,
      mode: "complete",
    });
    const summary = computeSummary(draft, values, { submittedAt: ctx.now });
    return {
      values,
      fieldStates: fieldStatesOf(draft.fields, values, ctx, designerGate),
      summary: {
        title: summary.title,
        date: summary.date,
        amount: summary.amount ?? null,
      },
      fieldErrors: issues,
    };
  }

  private async payloadOf(
    facts: FormOperatorFacts,
    form: FormRecord,
    record: FormVersionRecord,
  ): Promise<FormVersionPayload> {
    const validation =
      record.status === "draft"
        ? toValidationReport(
            await this.checker.check(facts, form, {
              fields: record.fields,
              layout: record.layout,
              summaryMap: record.summaryMap,
              prefills: record.prefills,
            }),
          )
        : null;
    return {
      formVersion: await this.modelOf(facts.operator, record),
      validation,
    };
  }

  private async modelOf(
    operator: OperatorContext,
    record: FormVersionRecord,
  ): Promise<FormVersionModel> {
    const names = await this.userNames.load(operator, [record.publishedBy]);
    return toFormVersionModel(record, names);
  }
}

/** 草稿 / 預覽用真正的現在與操作者本人(Spec §5「歷史檢視的上下文」的草稿那一半)。 */
export function contextOf(facts: FormOperatorFacts): ExpressionContext {
  return {
    now: new Date().toISOString(),
    timezone: facts.timezone,
    user: {
      id: facts.operator.actorId ? String(facts.operator.actorId) : null,
      orgId: facts.operator.currentOrgId
        ? String(facts.operator.currentOrgId)
        : null,
    },
  };
}
