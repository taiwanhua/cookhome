import { Injectable } from "@nestjs/common";

import {
  FORM_SUBMISSION_PROVIDER,
  type FieldDef,
  type FormDefinition,
  type LookupSourceDescriptor,
  type ValidationReport,
  validateDefinition,
} from "@repo/domain/form";

import {
  FormVersionsRepository,
  ModulesRepository,
} from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import { FieldCategoryOptionsService } from "../field-category-options.service";
import type { FormRecord } from "../form-access.service";
import { validationError } from "../forms-error";
import { LookupProvidersService } from "../lookup-providers";
import type { FormDefinitionInput } from "./dto/form-design.input";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * input 的四塊 → `FormDefinition`。只驗**最外層形狀**(GraphQL 已保證是物件 / 物件陣列;
 * `layout.sections` 要是陣列),細節全交給檢查器 —— 形狀不對的欄位由它報錯並定位。
 */
export function definitionOf(input: FormDefinitionInput): FormDefinition {
  if (!Array.isArray(input.layout.sections)) {
    throw validationError("layout.sections must be an array", ["layout"]);
  }
  return {
    fields: input.fields as unknown as FieldDef[],
    layout: input.layout as unknown as FormDefinition["layout"],
    summaryMap: input.summaryMap,
    prefills: input.prefills as unknown as FormDefinition["prefills"],
  };
}

/** 定義裡用到的所有 lookup 來源描述(選項、引用、帶入),附定位。 */
function sourcesOf(
  definition: FormDefinition,
): { source: LookupSourceDescriptor; location: Record<string, unknown> }[] {
  const found: {
    source: LookupSourceDescriptor;
    location: Record<string, unknown>;
  }[] = [];
  for (const field of definition.fields) {
    if (!isRecord(field)) {
      continue;
    }
    if (field.options?.kind === "lookup") {
      found.push({
        source: field.options.source,
        location: { fieldKey: field.key, property: "options.source" },
      });
    }
    if (field.type === "reference" && field.source) {
      found.push({
        source: field.source,
        location: { fieldKey: field.key, property: "source" },
      });
    }
  }
  for (const [prefillIndex, prefill] of definition.prefills.entries()) {
    if (isRecord(prefill) && isRecord(prefill.source)) {
      found.push({
        source: prefill.source,
        location: { prefillIndex, property: "source" },
      });
    }
  }
  return found;
}

/**
 * 定義檢查器的 api 端(`@repo/domain/form` 的 `validateDefinition` + 只有 api 知道的登錄表):
 * 已發布過的欄位型別、欄位管理類別、lookup 登錄表、列表欄位配置;另外把 `form_submission`
 * 來源的欄位精確到「那張表單目前版本有沒有這欄」(登錄表只給得出各來源表單的聯集)。
 */
@Injectable()
export class FormDefinitionChecker {
  constructor(
    private readonly versions: FormVersionsRepository,
    private readonly modules: ModulesRepository,
    private readonly categories: FieldCategoryOptionsService,
    private readonly lookups: LookupProvidersService,
  ) {}

  async check(
    operator: OperatorContext,
    form: FormRecord,
    definition: FormDefinition,
  ): Promise<ValidationReport> {
    const sources = sourcesOf(definition);
    const submissionFormKeys = sources
      .map(({ source }) => source)
      .filter(
        (source) =>
          source.provider === FORM_SUBMISSION_PROVIDER && source.formKey,
      )
      .map((source) => source.formKey ?? "");
    const [previousFields, fieldCategoryKeys, lookupProviders, listColumns] =
      await Promise.all([
        this.previousFieldsOf(operator, form.key),
        this.categories.categoryKeys(operator),
        this.lookups.registryFor(operator, submissionFormKeys),
        this.listColumnFieldKeys(operator, form),
      ]);
    const report = validateDefinition(definition, {
      previousFields,
      fieldCategoryKeys,
      lookupProviders,
      listColumnFieldKeys: listColumns,
    });
    await this.checkSubmissionSources(operator, definition, sources, report);
    return report;
  }

  /** 已發布 / 退役過的每個欄位 key 最後一次的定義(同 key 改型別 → `KEY_TYPE_CHANGED`)。 */
  private async previousFieldsOf(
    operator: OperatorContext,
    formKey: string,
  ): Promise<FieldDef[]> {
    const published = await this.versions.findMany(
      operator,
      { formKey, status: { $in: ["published", "retired"] } },
      { sort: { version: 1 } },
    );
    const byKey = new Map<string, FieldDef>();
    for (const version of published) {
      for (const field of version.fields) {
        byKey.set(field.key, field);
      }
    }
    return [...byKey.values()];
  }

  /** `modules.settings.list.columns` 裡指到這張表單(或沒指定表單)的欄位 key。 */
  private async listColumnFieldKeys(
    operator: OperatorContext,
    form: FormRecord,
  ): Promise<string[]> {
    const module = await this.modules.findOne(operator, {
      key: form.moduleKey,
    });
    const list = module?.settings.list;
    const columns =
      isRecord(list) && Array.isArray(list.columns) ? list.columns : [];
    return columns
      .filter(
        (column): column is Record<string, unknown> =>
          isRecord(column) &&
          column.kind === "field" &&
          typeof column.key === "string" &&
          [undefined, null, form.key].includes(
            column.formKey as string | null | undefined,
          ),
      )
      .map((column) => String(column.key));
  }

  private async checkSubmissionSources(
    operator: OperatorContext,
    definition: FormDefinition,
    sources: ReturnType<typeof sourcesOf>,
    report: ValidationReport,
  ): Promise<void> {
    for (const { source, location } of sources) {
      if (source.provider !== FORM_SUBMISSION_PROVIDER || !source.formKey) {
        continue;
      }
      const catalog = await this.lookups.formSubmissionCatalog(
        operator,
        source.formKey,
      );
      const wanted = [source.labelField, source.valueField ?? "id"];
      const prefill =
        typeof location.prefillIndex === "number"
          ? definition.prefills[location.prefillIndex]
          : undefined;
      for (const mapping of prefill?.mapping ?? []) {
        wanted.push(mapping.sourceField);
      }
      for (const name of new Set(wanted)) {
        const duplicated = report.errors.some(
          (issue) =>
            issue.message.includes(` ${name}`) &&
            issue.location.fieldKey === location.fieldKey &&
            issue.location.prefillIndex === location.prefillIndex,
        );
        if (name !== "id" && !(name in catalog) && !duplicated) {
          report.errors.push({
            code: "LOOKUP_UNKNOWN_FIELD",
            message: `表單 ${source.formKey} 目前的版本沒有可用的欄位 ${name}(受保護欄位不能當來源)`,
            location,
          });
        }
      }
    }
  }
}
