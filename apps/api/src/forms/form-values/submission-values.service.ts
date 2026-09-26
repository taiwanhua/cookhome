import { Injectable } from "@nestjs/common";

import {
  ComputedCycleError,
  type ExpressionContext,
  type FieldDef,
  type LookupSourceDescriptor,
  type StoredValues,
  type ValueIssue,
  computeAll,
  evaluateCondition,
  normalizeFieldValue,
  uploadLimitIssue,
  validateFieldRules,
} from "@repo/domain/form";

import {
  UPLOAD_RULES,
  UploadPurpose,
  isOwnedUploadPath,
} from "../../storage/upload-rules";
import {
  type CategoryOptions,
  FieldCategoryOptionsService,
} from "../field-category-options.service";
import { type FieldGate, fieldGateOf } from "../field-permission-gate";
import type { FormOperatorFacts } from "../form-access.service";
import { forbiddenError, valuesInvalidError } from "../forms-error";
import { LookupProvidersService, lookupLabelOf } from "../lookup-providers";
import { REDACTED, isSameStoredValue, semanticOf } from "./stored-values";

/**
 * 寫入的模式:
 * - `draft`:存草稿 —— **放寬的只有完成資料所需的驗證**(必填 / 範圍 / 格式 / custom / 選項是否還在),
 *   寫入守門照常(無 `edit` 送不同值 403、computed / constant 由後端算、隱藏清空),另驗型別與表達式可算
 * - `complete`:送出、已完成修改 —— 全驗,並重取類別 / lookup 選項與引用的 label 寫快照
 */
export type SubmissionWriteMode = "draft" | "complete";

export interface SubmissionWriteInput {
  facts: FormOperatorFacts;
  moduleKey: string;
  formKey: string;
  fields: readonly FieldDef[];
  /** 目前存的值(新草稿為 `{}`)。 */
  base: StoredValues;
  /** 這次送來的值;`null` = 沒有新輸入(送出草稿:以存的值為準重算重驗)。缺席的欄位 = 清空。 */
  sent: StoredValues | null;
  /**
   * 上一個**已完成**修訂的值(已完成修改時 = 目前值;送出草稿時為 null)。
   * 選項 / 引用與它相同時保留原快照、不因來源已停用或已刪而擋下整筆修改。
   */
  previous: StoredValues | null;
  ctx: ExpressionContext;
  mode: SubmissionWriteMode;
  /**
   * **本表單**欄位的權限閘門;不給 = 依操作者的欄位級權限(`fieldGateOf`)。
   * 只有設計器預覽會給(「不套欄位級權限」只指本表單的欄位);lookup / 引用的來源一律用操作者真實的權限。
   */
  gate?: FieldGate;
}

/** 重取選項 label 時共用的東西(類別選項一次請求只查一次)。 */
interface OptionContext {
  facts: FormOperatorFacts;
  categories: Map<string, Promise<CategoryOptions>>;
  issues: ValueIssue[];
}

/** 一欄落在 Spec §5「不能填的四種原因」的哪一列。 */
type FieldClass = "hidden" | "computed" | "kept" | "readonly" | "input";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 提交寫入的後端規則(Spec 6a §5「不能填的四種原因,後端怎麼處理送來的值」),每欄**依序**判定、
 * 命中第一個就照那列處理:
 *
 * 1. `visibleWhen` 算出 false → 清空(null),不算、不驗 —— 同一欄同時隱藏 + 受保護也是清空
 * 2. `computed` / `constant` → 後端算 / 用定義值,送來的忽略;**驗算出的結果**(必填算成 null 擋下)
 * 3. 沒有欄位級 `edit`(或看不到) → 保留既有值;送來的值與既有不同 → 403 整筆拒絕;對此人不驗
 * 4. `readonlyWhen` 算出 true → 保留既有值,送來的忽略;驗既有值
 * 5. 一般可填 → 存送來的值,全驗
 *
 * 條件都以**後端算出的**為準;算條件用的值 = 既有值套上操作者「改得動」的那些欄位送來的值
 * (改不動的欄位送什麼都不影響條件)。
 */
@Injectable()
export class SubmissionValuesService {
  constructor(
    private readonly categories: FieldCategoryOptionsService,
    private readonly lookups: LookupProvidersService,
  ) {}

  /** 跑完整條規則;有任何值錯誤 → `VALIDATION_FAILED`(`fieldErrors`),無 edit 送不同值 → 403。 */
  async apply(input: SubmissionWriteInput): Promise<StoredValues> {
    const { values, issues } = await this.evaluate(input);
    if (issues.length > 0) {
      throw valuesInvalidError(issues);
    }
    return values;
  }

  /**
   * 同 `apply`,但值錯誤不丟、連同算好的值一起回(設計器預覽:「若此刻送出會出現的錯誤」)。
   * 型別錯誤與 403 守門照樣丟。
   */
  async evaluate(
    input: SubmissionWriteInput,
  ): Promise<{ values: StoredValues; issues: ValueIssue[] }> {
    const gate =
      input.gate ?? fieldGateOf(input.facts, input.moduleKey, input.formKey);
    const issues: ValueIssue[] = [];
    const normalizedSent = this.normalizeSent(input, gate, issues);
    if (issues.length > 0) {
      throw valuesInvalidError(issues);
    }

    const { classes, final } = this.settle(input, gate, normalizedSent);
    for (const field of input.fields) {
      if (classes.get(field.key) === "kept") {
        this.assertUnchanged(field, gate, input, normalizedSent);
      }
    }
    await this.checkUploads(input, classes, final, issues);
    if (input.mode === "complete") {
      await this.resolveSnapshots(input, classes, final, issues);
      // label 重取後再算一次:`optionLabel` 這類公式要看到的是新快照,不是前端送來的 label
      recompute(input, classes, final);
      this.validateRules(input, classes, final, issues);
    }
    return { values: final, issues };
  }

  /**
   * 分類與最終值**一起收斂**:條件一律用「最終會存下的值」重算(被忽略的送入值、被清空的隱藏欄
   * 都不能影響別欄的條件),分類變了就再算一次,直到不變(上限 = 欄位數 + 1)。
   * 這樣寫入時的判定與讀取時(以存值重算 `fieldStates`)一致,也擋掉「送一個會被忽略的值
   * 去把別欄判成隱藏、清掉它的既有值」這種繞過。
   */
  private settle(
    input: SubmissionWriteInput,
    gate: FieldGate,
    normalizedSent: ReadonlyMap<string, unknown>,
  ): { classes: Map<string, FieldClass>; final: StoredValues } {
    // 第一輪的猜測:既有值 + 改得動的欄位送來的值
    let conditionInput = this.conditionInputOf(input, gate, normalizedSent);
    let classes = new Map<string, FieldClass>();
    let final: StoredValues = {};
    for (let round = 0; round <= input.fields.length; round += 1) {
      const next = new Map<string, FieldClass>();
      for (const field of input.fields) {
        next.set(field.key, this.classify(field, gate, input, conditionInput));
      }
      const stable = round > 0 && sameClasses(classes, next);
      classes = next;
      if (stable) {
        break;
      }
      final = {};
      for (const field of input.fields) {
        final[field.key] = initialValueOf(
          classes.get(field.key) ?? "input",
          field,
          input,
          normalizedSent,
        );
      }
      // 以最終的值重算計算欄位;隱藏的計算欄位維持 null
      recompute(input, classes, final);
      conditionInput = conditionInputFromValues(input, final);
    }
    return { classes, final };
  }

  /**
   * 第一輪算條件用的值:既有值 + 操作者**改得動**的欄位送來的值 + 計算欄位
   * (改不動的欄位送什麼都不影響條件)。之後各輪改用最終值(`settle`)。
   */
  private conditionInputOf(
    input: SubmissionWriteInput,
    gate: FieldGate,
    normalizedSent: ReadonlyMap<string, unknown>,
  ): Parameters<typeof evaluateCondition>[1] {
    const candidate: StoredValues = { ...input.base };
    for (const field of input.fields) {
      if (
        field.valueSource.kind === "input" &&
        gate.canEdit(input.fields, field)
      ) {
        candidate[field.key] = sentOrBase(field, input, normalizedSent);
      }
    }
    Object.assign(
      candidate,
      computeOrThrow(input.fields, candidate, input.ctx),
    );
    return {
      values: semanticOf(input.fields, candidate),
      ctx: input.ctx,
      fields: input.fields,
      stored: candidate,
    };
  }

  /** 型別層:送來的每個值收成存值形狀;形狀不對 → `TYPE_INVALID`(草稿也驗)。 */
  private normalizeSent(
    input: SubmissionWriteInput,
    gate: FieldGate,
    issues: ValueIssue[],
  ): Map<string, unknown> {
    const normalized = new Map<string, unknown>();
    if (input.sent === null) {
      return normalized;
    }
    for (const field of input.fields) {
      if (!(field.key in input.sent) || field.valueSource.kind !== "input") {
        continue;
      }
      const raw = input.sent[field.key];
      if (raw === REDACTED && !gate.canShow(input.fields, field.key)) {
        // 讀者**真的**看不到的欄位,前端原樣送回遮蔽字串:當成「沒動」(由原因 3 守門);
        // 看得到的人送 "[redacted]" 就是一般的值,照型別正規化(不合法就 VALIDATION_FAILED)
        normalized.set(field.key, REDACTED);
        continue;
      }
      const result = normalizeFieldValue(field, raw);
      if (result.ok) {
        normalized.set(field.key, result.value);
      } else {
        issues.push(result.issue);
      }
    }
    return normalized;
  }

  private classify(
    field: FieldDef,
    gate: FieldGate,
    input: SubmissionWriteInput,
    conditionInput: Parameters<typeof evaluateCondition>[1],
  ): FieldClass {
    if (isConditionFalse(field.visibleWhen, conditionInput)) {
      return "hidden";
    }
    if (field.valueSource.kind !== "input") {
      return "computed";
    }
    if (!gate.canEdit(input.fields, field)) {
      return "kept";
    }
    if (isConditionTrue(field.readonlyWhen, conditionInput)) {
      return "readonly";
    }
    return "input";
  }

  /** 原因 3:送來的值與既有不同 → 403;沒送、送遮蔽字串(且真的看不到)、同值都算沒動。 */
  private assertUnchanged(
    field: FieldDef,
    gate: FieldGate,
    input: SubmissionWriteInput,
    normalizedSent: ReadonlyMap<string, unknown>,
  ): void {
    if (input.sent === null || !(field.key in input.sent)) {
      return;
    }
    const sent = normalizedSent.get(field.key);
    const existing = input.base[field.key] ?? null;
    if (sent === REDACTED && !gate.canShow(input.fields, field.key)) {
      return;
    }
    if (!isSameStoredValue(field, sent, existing)) {
      throw forbiddenError(
        `Field ${field.key} is not writable by the operator`,
        "FIELD_FORBIDDEN",
        { fieldKey: field.key },
      );
    }
  }

  /**
   * 上傳欄:只收本 API 簽出來的路徑,檔型 / 大小照 `FORM_ATTACHMENT` 的規則,再套**欄位自己的**
   * 檔型 / 大小上限(`widget.accept` / `widget.maxSizeMb`,只能收窄)。
   *
   * - 草稿(上傳完成後存草稿):驗這次換上的新檔(與存的值相同的不重驗)
   * - 送出 / 已完成修改:驗「與上一個已完成修訂不同」的檔 —— 草稿時存下、送出前版本改窄了上限的也擋得到;
   *   已完成修改時沒換的舊檔不因上限改窄而擋下整筆修改
   */
  private checkUploads(
    input: SubmissionWriteInput,
    classes: ReadonlyMap<string, FieldClass>,
    final: StoredValues,
    issues: ValueIssue[],
  ): Promise<void> {
    const rule = UPLOAD_RULES[UploadPurpose.FORM_ATTACHMENT];
    const compareWith =
      input.mode === "complete" ? (input.previous ?? {}) : input.base;
    for (const field of input.fields) {
      const value = final[field.key];
      if (
        field.type !== "upload" ||
        classes.get(field.key) !== "input" ||
        !isRecord(value) ||
        isSameStoredValue(field, value, compareWith[field.key])
      ) {
        continue;
      }
      const path = typeof value.path === "string" ? value.path : "";
      const contentType =
        typeof value.contentType === "string"
          ? value.contentType.toLowerCase()
          : "";
      const size = typeof value.size === "number" ? value.size : -1;
      if (
        !isOwnedUploadPath(path) ||
        !path.startsWith(`${FORM_UPLOAD_PREFIX}/`) ||
        !(contentType in rule.extensions) ||
        size < 0 ||
        size > rule.maxBytes ||
        (typeof value.name === "string" &&
          (value.name.trim() === "" || value.name.length > 255))
      ) {
        issues.push({
          fieldKey: field.key,
          code: "UPLOAD_INVALID",
          message: `「${field.label}」的檔案不是有效的上傳結果`,
        });
        continue;
      }
      const limitIssue = uploadLimitIssue(field, value);
      if (limitIssue) {
        issues.push(limitIssue);
      }
    }
    return Promise.resolve();
  }

  /**
   * 送出 / 已完成修改:選項與引用**重取 label 寫快照**(Spec §7「提交時後端重驗 reference 的來源可讀、
   * 重取 label;類別 / lookup 選項同樣」)。只處理這次會存下的「一般可填」欄位;
   * 值與上一個已完成修訂相同的保留原快照(來源停用或刪除不擋整筆修改)。
   */
  private async resolveSnapshots(
    input: SubmissionWriteInput,
    classes: ReadonlyMap<string, FieldClass>,
    final: StoredValues,
    issues: ValueIssue[],
  ): Promise<void> {
    const context: OptionContext = {
      facts: input.facts,
      categories: new Map(),
      issues,
    };
    for (const field of input.fields) {
      const value = final[field.key];
      if (
        classes.get(field.key) !== "input" ||
        value === null ||
        value === undefined
      ) {
        continue;
      }
      const previous = input.previous?.[field.key];
      final[field.key] =
        previous !== undefined && isSameStoredValue(field, value, previous)
          ? previous
          : await this.snapshotOf(field, value, context);
    }
  }

  /** 一欄的新快照:引用重驗來源、選項重取 label(multiSelect 逐項)。 */
  private async snapshotOf(
    field: FieldDef,
    value: unknown,
    context: OptionContext,
  ): Promise<unknown> {
    if (field.type === "reference") {
      return this.resolveReference(context.facts, field, value, context.issues);
    }
    if (field.type === "select") {
      return this.resolveOption(field, value, context);
    }
    if (field.type === "multiSelect" && Array.isArray(value)) {
      const items: unknown[] = [];
      for (const item of value) {
        items.push(await this.resolveOption(field, item, context));
      }
      return items;
    }
    return value;
  }

  private async resolveReference(
    facts: FormOperatorFacts,
    field: FieldDef,
    value: unknown,
    issues: ValueIssue[],
  ): Promise<unknown> {
    const id =
      isRecord(value) && typeof value.id === "string" ? value.id : null;
    const source = field.source;
    const [record] =
      id === null || !source
        ? []
        : await this.lookups.findByValues(
            facts,
            source,
            "id",
            [id],
            [source.labelField],
            { publicOnly: true },
          );
    if (!record || !source) {
      issues.push({
        fieldKey: field.key,
        code: "SOURCE_UNAVAILABLE",
        message: `「${field.label}」引用的資料不存在或無權讀取`,
      });
      return value;
    }
    return { id: record.id, label: lookupLabelOf(record, source.labelField) };
  }

  /**
   * 選項的一個值:靜態清單比對啟用中的項目;類別 / lookup 查現況並寫 `{ value, label }`;
   * 不在清單內時 `allowCustom` 的存成自訂值,否則 `OPTION_INVALID`。
   */
  private async resolveOption(
    field: FieldDef,
    item: unknown,
    context: OptionContext,
  ): Promise<unknown> {
    const value = isRecord(item) ? item.value : item;
    const isCustom = isRecord(item) && item.custom === true;
    const fallback = (): unknown => {
      if (field.rules?.allowCustom === true && typeof value === "string") {
        return { value, label: value, custom: true };
      }
      context.issues.push({
        fieldKey: field.key,
        code: "OPTION_INVALID",
        message: `「${field.label}」的選項不在可選清單內`,
      });
      return item;
    };
    if (typeof value !== "string" || isCustom) {
      return fallback();
    }
    const label = await this.currentLabelOf(field, value, context);
    if (label === undefined) {
      return fallback();
    }
    return field.options?.kind === "static" ? value : { value, label };
  }

  /** 選項此刻的顯示名;不在可選清單內(不存在 / 已停用 / 讀不到)回 undefined。 */
  private async currentLabelOf(
    field: FieldDef,
    value: string,
    context: OptionContext,
  ): Promise<string | null | undefined> {
    const options = field.options;
    if (options?.kind === "static") {
      return options.items.find(
        (option) => option.value === value && option.enabled,
      )?.label;
    }
    if (options?.kind === "fieldCategory") {
      let pending = context.categories.get(options.key);
      if (!pending) {
        pending = this.categories.options(context.facts.operator, options.key);
        context.categories.set(options.key, pending);
      }
      const categoryOptions = await pending;
      const found = categoryOptions.get(value);
      return found?.enabled ? found.label : undefined;
    }
    if (options?.kind === "lookup") {
      const source: LookupSourceDescriptor = options.source;
      const valueField = source.valueField ?? "id";
      const [record] = await this.lookups.findByValues(
        context.facts,
        source,
        valueField,
        [value],
        [source.labelField, valueField],
        { publicOnly: true },
      );
      return record ? lookupLabelOf(record, source.labelField) : undefined;
    }
    return undefined;
  }

  /** 完成資料所需的驗證:一般可填、唯讀(驗既有值)、計算欄位(驗算出的結果);隱藏與無 edit 不驗。 */
  private validateRules(
    input: SubmissionWriteInput,
    classes: ReadonlyMap<string, FieldClass>,
    final: StoredValues,
    issues: ValueIssue[],
  ): void {
    const reported = new Set(issues.map((issue) => issue.fieldKey));
    const semantic = semanticOf(input.fields, final);
    for (const field of input.fields) {
      const fieldClass = classes.get(field.key);
      if (
        fieldClass === "hidden" ||
        fieldClass === "kept" ||
        reported.has(field.key)
      ) {
        continue;
      }
      const issue = validateFieldRules(field, final[field.key], {
        semantic,
        ctx: input.ctx,
        fields: input.fields,
        stored: final,
      });
      if (issue) {
        issues.push(issue);
      }
    }
  }
}

function sameClasses(
  left: ReadonlyMap<string, FieldClass>,
  right: ReadonlyMap<string, FieldClass>,
): boolean {
  return [...right].every(([key, value]) => left.get(key) === value);
}

/** 以一組存值當條件的輸入(語意值 + ctx + 定義與存值給 `optionLabel`)。 */
function conditionInputFromValues(
  input: SubmissionWriteInput,
  values: StoredValues,
): Parameters<typeof evaluateCondition>[1] {
  return {
    values: semanticOf(input.fields, values),
    ctx: input.ctx,
    fields: input.fields,
    stored: values,
  };
}

/** 以目前的值重算計算 / 固定值欄位(隱藏的維持 null)。 */
function recompute(
  input: SubmissionWriteInput,
  classes: ReadonlyMap<string, FieldClass>,
  final: StoredValues,
): void {
  const computed = computeOrThrow(input.fields, final, input.ctx);
  for (const field of input.fields) {
    if (classes.get(field.key) === "computed") {
      final[field.key] = computed[field.key] ?? null;
    }
  }
}

/** 這次要存的值:沒有新輸入(送出草稿)用存的,否則用送來的(缺席 = 清空)。 */
function sentOrBase(
  field: FieldDef,
  input: SubmissionWriteInput,
  normalizedSent: ReadonlyMap<string, unknown>,
): unknown {
  return input.sent === null
    ? (input.base[field.key] ?? null)
    : (normalizedSent.get(field.key) ?? null);
}

/** 依「不能填的原因」決定這一欄先放什麼(計算欄位稍後以最終值重算)。 */
function initialValueOf(
  fieldClass: FieldClass,
  field: FieldDef,
  input: SubmissionWriteInput,
  normalizedSent: ReadonlyMap<string, unknown>,
): unknown {
  switch (fieldClass) {
    case "hidden":
    case "computed": {
      return null;
    }
    case "kept":
    case "readonly": {
      return input.base[field.key] ?? null;
    }
    case "input": {
      return sentOrBase(field, input, normalizedSent);
    }
  }
}

/** 表單附件的路徑前綴(`storage/upload-rules.ts` 的 `FORM_ATTACHMENT`)。 */
const FORM_UPLOAD_PREFIX = "form";

function isConditionFalse(
  expr: FieldDef["visibleWhen"],
  input: Parameters<typeof evaluateCondition>[1],
): boolean {
  if (expr === undefined || expr === null) {
    return false;
  }
  try {
    return !evaluateCondition(expr, input);
  } catch {
    // 形狀錯誤在發布前就被檢查器擋下;執行期的意外視為「條件不成立」(顯示)
    return false;
  }
}

function isConditionTrue(
  expr: FieldDef["readonlyWhen"],
  input: Parameters<typeof evaluateCondition>[1],
): boolean {
  if (expr === undefined || expr === null) {
    return false;
  }
  try {
    return evaluateCondition(expr, input);
  } catch {
    return false;
  }
}

/** 計算欄位求值;公式成圈(檢查器應已擋下)→ 整筆 `NOT_COMPUTABLE`。 */
function computeOrThrow(
  fields: readonly FieldDef[],
  values: StoredValues,
  ctx: ExpressionContext,
): Record<string, unknown> {
  try {
    return computeAll(fields, { values, ctx });
  } catch (error) {
    if (error instanceof ComputedCycleError) {
      throw valuesInvalidError(
        fields
          .filter((field) => field.valueSource.kind === "computed")
          .map((field) => ({
            fieldKey: field.key,
            code: "NOT_COMPUTABLE" as const,
            message: `「${field.label}」無法計算(公式循環引用)`,
          })),
      );
    }
    throw error;
  }
}
