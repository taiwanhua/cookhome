import { Injectable } from "@nestjs/common";

import type {
  FieldDef,
  LookupSourceDescriptor,
  Prefill,
} from "@repo/domain/form";

import { FormVersionsRepository } from "../../database/database.module";
import { fieldGateOf, requiredShowKeys } from "../field-permission-gate";
import {
  FormAccessService,
  type FormOperatorFacts,
} from "../form-access.service";
import { FORMS_PERMISSIONS } from "../form-permission-keys";
import { forbiddenError, notFoundError, validationError } from "../forms-error";
import {
  LookupProvidersService,
  type LookupRecord,
  lookupLabelOf,
  lookupValueOf,
} from "../lookup-providers";
import {
  DEFAULT_PAGE_SIZE,
  type FormLookupInput,
  type FormLookupRecordInput,
  type FormLookupTargetInput,
  MAX_PAGE_SIZE,
} from "./dto/form-runtime.input";
import type {
  FormLookupPayload,
  FormLookupRecord,
} from "./models/form-submission.model";

/** 從版本定義解析出來的查詢:來源描述、值欄、要回的來源欄位(帶入規則的 mapping)。 */
interface ResolvedTarget {
  source: LookupSourceDescriptor;
  valueField: string;
  /** 帶入規則要的來源欄位;選項 / 引用為空。 */
  mappedFields: string[];
}

function targetOf(
  fields: readonly FieldDef[],
  prefills: readonly Prefill[],
  target: FormLookupTargetInput,
): ResolvedTarget {
  const hasField = target.fieldKey !== undefined && target.fieldKey !== null;
  const hasPrefill =
    target.prefillIndex !== undefined && target.prefillIndex !== null;
  if (hasField === hasPrefill) {
    throw validationError(
      "target needs exactly one of fieldKey / prefillIndex",
      ["target"],
    );
  }
  if (hasField) {
    const field = fields.find((candidate) => candidate.key === target.fieldKey);
    if (field?.options?.kind === "lookup") {
      return {
        source: field.options.source,
        valueField: field.options.source.valueField ?? "id",
        mappedFields: [],
      };
    }
    if (field?.type === "reference" && field.source) {
      return { source: field.source, valueField: "id", mappedFields: [] };
    }
    throw validationError(
      `Field ${String(target.fieldKey)} has no lookup source`,
      ["target"],
    );
  }
  const prefill = prefills[target.prefillIndex ?? -1];
  if (!prefill) {
    throw validationError(
      `Prefill ${String(target.prefillIndex)} does not exist`,
      ["target"],
    );
  }
  return {
    source: prefill.source,
    valueField: prefill.source.valueField ?? "id",
    mappedFields: prefill.mapping.map((mapping) => mapping.sourceField),
  };
}

/**
 * `formLookup` / `formLookupRecord`(Spec 6a §5「lookup 來源」):前端只帶
 * `{ formKey, version, target }` + 關鍵字,**provider 與 `filter` 從版本定義取**,前端改不了;
 * 再套操作者的可見範圍與欄位權限(`lookup-providers.ts`)。
 */
@Injectable()
export class FormLookupService {
  constructor(
    private readonly versions: FormVersionsRepository,
    private readonly access: FormAccessService,
    private readonly providers: LookupProvidersService,
  ) {}

  async search(
    facts: FormOperatorFacts,
    input: FormLookupInput,
  ): Promise<FormLookupPayload> {
    const target = await this.resolve(facts, input);
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const result = await this.providers.search(
      facts,
      target.source,
      { keyword: input.keyword ?? null, page, pageSize },
      this.requestedFields(target),
    );
    return {
      items: result.items.map((record) => this.toRecord(record, target)),
      totalCount: result.totalCount,
      page,
      pageSize,
    };
  }

  async record(
    facts: FormOperatorFacts,
    input: FormLookupRecordInput,
  ): Promise<FormLookupRecord | null> {
    const target = await this.resolve(facts, input);
    const [record] = await this.providers.findByValues(
      facts,
      target.source,
      "id",
      [input.id],
      this.requestedFields(target),
    );
    return record ? this.toRecord(record, target) : null;
  }

  /**
   * 讀版本定義並解析目標。已發布 / 退役版:要有該模組的 `create` 或 `edit`(填寫中才會查),
   * 目標是欄位時還要讀得到那一欄(欄位級 `show`,含依賴鏈);
   * 草稿(`version` 省略):設計器預覽,要表單管理的檢視且讀得到這張表單。
   */
  private async resolve(
    facts: FormOperatorFacts,
    input: {
      formKey: string;
      version?: number | null;
      target: FormLookupTargetInput;
    },
  ): Promise<ResolvedTarget> {
    const isDraft = input.version === null || input.version === undefined;
    if (isDraft) {
      if (!this.access.has(facts, FORMS_PERMISSIONS.view)) {
        throw forbiddenError(`Missing permission ${FORMS_PERMISSIONS.view}`);
      }
      await this.access.requireReadableForm(facts, input.formKey);
    }
    const form = await this.access.findRuntimeForm(facts, input.formKey);
    if (!form) {
      throw notFoundError(`Form not found: ${input.formKey}`);
    }
    if (!isDraft) {
      const canFill =
        this.access.has(facts, `${form.moduleKey}.create`) ||
        this.access.has(facts, `${form.moduleKey}.edit`);
      if (!canFill) {
        throw forbiddenError(`Missing permission ${form.moduleKey}.create`);
      }
    }
    const version = await this.versions.findOne(
      facts.operator,
      isDraft
        ? { formKey: form.key, status: "draft" }
        : {
            formKey: form.key,
            version: input.version,
            status: { $in: ["published", "retired"] },
          },
    );
    if (!version) {
      throw notFoundError(
        `Form version not found: ${form.key}@${String(input.version ?? "draft")}`,
      );
    }
    const fieldKey = input.target.fieldKey;
    // 讀不到這一欄(受保護沒有 show)的人不給候選資料;先於「有沒有 lookup 來源」判,
    // 否則能從錯誤碼的差別推出這欄的定義(骨架省略了 `options` / `source`)
    if (
      !isDraft &&
      fieldKey !== undefined &&
      fieldKey !== null &&
      version.fields.some((candidate) => candidate.key === fieldKey) &&
      !fieldGateOf(facts, form.moduleKey, form.key).canShow(
        version.fields,
        fieldKey,
      )
    ) {
      throw forbiddenError(
        `Missing field permission: ${requiredShowKeys(version.fields, fieldKey).join(", ")}`,
      );
    }
    return targetOf(version.fields, version.prefills, input.target);
  }

  private requestedFields(target: ResolvedTarget): string[] {
    return [
      ...new Set([
        target.source.labelField,
        target.valueField,
        ...target.mappedFields,
      ]),
    ];
  }

  private toRecord(
    record: LookupRecord,
    target: ResolvedTarget,
  ): FormLookupRecord {
    const value = lookupValueOf(record, target.valueField);
    const values: Record<string, unknown> = {};
    for (const field of target.mappedFields) {
      if (field === "id") {
        values.id = record.id;
      } else if (field in record.values) {
        // 受保護且無權的欄位在 provider 就被省略了:這裡照樣省略(前端顯示「—」)
        values[field] = record.values[field];
      }
    }
    return {
      id: record.id,
      value:
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : null,
      label: lookupLabelOf(record, target.source.labelField),
      values,
    };
  }
}
