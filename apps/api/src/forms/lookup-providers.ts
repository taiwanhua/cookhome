import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import {
  FORM_SUBMISSION_PROVIDER,
  type FieldDef,
  type FieldType,
  type LookupProviderRegistry,
  type LookupSourceDescriptor,
  optionLabelOf,
  semanticValueOf,
} from "@repo/domain/form";

import type { Persisted } from "../database/base.repository";
import {
  type FormSubmissionDocument,
  FormSubmissionsRepository,
  FormVersionsRepository,
  OrgsRepository,
  UsersRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import { RelationService } from "../database/relation.service";
import { fieldGateOf, requiredShowKeys } from "./field-permission-gate";
import {
  FormAccessService,
  type FormOperatorFacts,
  escapeRegex,
} from "./form-access.service";
import { formModulePermission } from "./form-permission-keys";

/**
 * lookup 來源登錄表(Spec 6a §5「lookup 來源」):帶入(prefill)、引用(reference)、
 * lookup 選項(`options.kind = "lookup"`)都用這一張。**新增來源 = 這裡加一筆**:
 *
 * 1. `LOOKUP_PROVIDERS` 加一筆宣告(可回的欄位、各欄位型別與讀它要的權限、可當固定條件的欄位)
 * 2. `LookupProvidersService.providerFor` 加一個實作(搜尋、依值取回,都要套操作者的範圍)
 * 3. `docs/modules/forms.md`「lookup 登錄表」補一列
 *
 * 執行時的查詢一律**以版本定義為準**:前端只帶「哪一版的哪一欄 / 哪一條帶入規則」+ 關鍵字,
 * provider 與 `filter` 都從定義取,前端改不了(`form-runtime/form-lookup.service.ts`)。
 */

/** 一個來源欄位:型別(帶入時驗型別相容)與讀它需要的權限(沒有就不回這一欄)。 */
export interface LookupFieldSpec {
  type: FieldType;
  /** 讀這一欄要的權限 key(含同層 wildcard);不給 = 看得到這筆就看得到這欄。 */
  permission?: string;
}

export interface LookupProviderDeclaration {
  /** 顯示在設計器來源下拉的名稱。 */
  name: string;
  /** 可回的欄位(`id` 一律可回,不必列)。`form_submission` 的欄位依 `formKey` 而定,這裡不列。 */
  fields: Readonly<Record<string, LookupFieldSpec>>;
  /** 可當 `filter` 固定條件的欄位(等值比對);其餘鍵一律不套。 */
  filterFields: readonly string[];
}

/** 讀使用者的帳號 / Email 要能看使用者管理(與使用者清單同一條)。 */
const USER_MANAGER_VIEW = "system.user-manager.view";

const USER_PROVIDER: LookupProviderDeclaration = {
  name: "使用者",
  fields: {
    name: { type: "text" },
    account: { type: "text", permission: USER_MANAGER_VIEW },
    email: { type: "text", permission: USER_MANAGER_VIEW },
  },
  filterFields: ["enabled"],
};

const ORG_PROVIDER: LookupProviderDeclaration = {
  name: "組織",
  fields: {
    name: { type: "text" },
    slug: { type: "text" },
  },
  filterFields: ["enabled"],
};

const FORM_SUBMISSION_DECLARATION: LookupProviderDeclaration = {
  name: "其他表單提交",
  fields: {},
  filterFields: [],
};

export const LOOKUP_PROVIDERS: Readonly<
  Record<string, LookupProviderDeclaration>
> = {
  user: USER_PROVIDER,
  org: ORG_PROVIDER,
  [FORM_SUBMISSION_PROVIDER]: FORM_SUBMISSION_DECLARATION,
};

/** 摘要槽也能當 `form_submission` 來源的欄位(設計時的欄位目錄 = 非受保護欄位 + 摘要槽)。 */
export const SUMMARY_SLOT_FIELDS: Readonly<Record<string, FieldType>> = {
  title: "text",
  date: "date",
  amount: "number",
};

/**
 * 一筆來源資料:`values` 只含操作者**讀得到**的欄位(讀不到的省略,不是 null);
 * `form_submission` 來源在「那筆的版本沒有這個欄位」時放 null。`labels` 是選項 / 引用欄的顯示名。
 */
export interface LookupRecord {
  id: string;
  values: Record<string, unknown>;
  labels: Record<string, string | null>;
}

export interface LookupSearch {
  keyword?: string | null;
  page: number;
  pageSize: number;
}

export interface LookupPage {
  items: LookupRecord[];
  totalCount: number;
}

/** 一個 provider 的執行面;`fields` = 定義要的欄位(`form_submission` 依每筆版本判斷它們)。 */
interface LookupProviderRuntime {
  search(
    facts: FormOperatorFacts,
    source: LookupSourceDescriptor,
    query: LookupSearch,
    fields: readonly string[],
  ): Promise<LookupPage>;
  /** 依某欄的值取回(`id` 或 `valueField`);讀不到的不回。 */
  findByValues(
    facts: FormOperatorFacts,
    source: LookupSourceDescriptor,
    field: string,
    values: readonly string[],
    fields: readonly string[],
  ): Promise<LookupRecord[]>;
}

/** 顯示名:`labels` 有就用,否則把值轉成字串;讀不到(被省略)→ null。 */
export function lookupLabelOf(
  record: LookupRecord,
  labelField: string,
): string | null {
  if (labelField === "id") {
    return record.id;
  }
  const label = record.labels[labelField];
  if (label !== undefined) {
    return label;
  }
  const value = record.values[labelField];
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => textOf(item)).join("、");
  }
  return textOf(value);
}

/** 純量轉文字;物件(不該出現在顯示欄)回空字串。 */
function textOf(value: unknown): string {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}

/** 某欄的值(`id` 或 `values` 裡的);讀不到回 undefined。 */
export function lookupValueOf(record: LookupRecord, field: string): unknown {
  return field === "id" ? record.id : record.values[field];
}

/** 定義裡的 `filter` 只收 provider 允許的欄位(其餘忽略 —— 不認得的條件不套,也不放寬)。 */
function allowedFilterOf(
  declaration: LookupProviderDeclaration,
  filter: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const allowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter ?? {})) {
    if (declaration.filterFields.includes(key)) {
      allowed[key] = value;
    }
  }
  return allowed;
}

function objectIdsOf(values: readonly string[]): Types.ObjectId[] {
  return values
    .filter((value) => Types.ObjectId.isValid(value))
    .map((value) => new Types.ObjectId(value));
}

/** 組織以**可見範圍**讀(lookup 是業務用途;`orgs` 本身掛的是管理範圍)。 */
function visibleOrgReader(operator: OperatorContext): OperatorContext {
  return { ...operator, managedOrgIds: operator.visibleOrgIds };
}

function orgRecord(org: {
  _id: Types.ObjectId;
  name: string;
  slug?: string | null;
}): LookupRecord {
  return {
    id: String(org._id),
    values: { name: org.name, slug: org.slug ?? null },
    labels: {},
  };
}

function labelTextOf(label: unknown): string | null {
  if (Array.isArray(label)) {
    return label.map(String).join("、");
  }
  return typeof label === "string" ? label : null;
}

const EMPTY_PROVIDER: LookupProviderRuntime = {
  search: () => Promise.resolve({ items: [], totalCount: 0 }),
  findByValues: () => Promise.resolve([]),
};

type SubmissionRecord = Persisted<FormSubmissionDocument>;

/** 回 label 的欄位型別(選項與引用)。 */
const LABELLED_TYPES: ReadonlySet<FieldType> = new Set([
  "select",
  "multiSelect",
  "reference",
]);

@Injectable()
export class LookupProvidersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly orgs: OrgsRepository,
    private readonly relations: RelationService,
    private readonly submissions: FormSubmissionsRepository,
    private readonly versions: FormVersionsRepository,
    private readonly access: FormAccessService,
  ) {}

  /**
   * 檢查器要的登錄表(`@repo/domain/form` 的 `LookupProviderRegistry`)。
   * `form_submission` 的欄位 = 定義裡用到的每張來源表單目前版本的非受保護欄位 + 摘要槽(聯集);
   * 精確到「哪張表單有哪些欄位」由 `formSubmissionCatalog` 另外檢查。
   */
  async registryFor(
    operator: OperatorContext,
    formKeys: readonly string[],
  ): Promise<LookupProviderRegistry> {
    const registry: Record<string, { fields: Record<string, FieldType> }> = {};
    for (const [key, declaration] of Object.entries(LOOKUP_PROVIDERS)) {
      registry[key] = {
        fields: Object.fromEntries(
          Object.entries(declaration.fields).map(([name, spec]) => [
            name,
            spec.type,
          ]),
        ),
      };
    }
    const union: Record<string, FieldType> = { ...SUMMARY_SLOT_FIELDS };
    for (const formKey of new Set(formKeys)) {
      Object.assign(union, await this.formSubmissionCatalog(operator, formKey));
    }
    registry[FORM_SUBMISSION_PROVIDER] = { fields: union };
    return registry;
  }

  /** `form_submission` 來源在設計時可挑的欄位:該表單目前版本的非受保護欄位 + 摘要槽。 */
  async formSubmissionCatalog(
    operator: OperatorContext,
    formKey: string,
  ): Promise<Record<string, FieldType>> {
    const catalog: Record<string, FieldType> = { ...SUMMARY_SLOT_FIELDS };
    const form = await this.access.findForm(operator, formKey);
    if (form?.currentVersion === null || form === null) {
      return catalog;
    }
    const version = await this.versions.findOne(operator, {
      formKey,
      version: form.currentVersion,
    });
    const fields = version?.fields ?? [];
    for (const field of fields) {
      if (requiredShowKeys(fields, field.key).length === 0) {
        catalog[field.key] = field.type;
      }
    }
    return catalog;
  }

  search(
    facts: FormOperatorFacts,
    source: LookupSourceDescriptor,
    query: LookupSearch,
    fields: readonly string[],
  ): Promise<LookupPage> {
    return this.providerFor(source.provider).search(
      facts,
      source,
      query,
      fields,
    );
  }

  findByValues(
    facts: FormOperatorFacts,
    source: LookupSourceDescriptor,
    field: string,
    values: readonly string[],
    fields: readonly string[] = [],
  ): Promise<LookupRecord[]> {
    if (values.length === 0) {
      return Promise.resolve([]);
    }
    return this.providerFor(source.provider).findByValues(
      facts,
      source,
      field,
      values,
      fields,
    );
  }

  private providerFor(key: string): LookupProviderRuntime {
    switch (key) {
      case "user": {
        return this.userProvider;
      }
      case "org": {
        return this.orgProvider;
      }
      case FORM_SUBMISSION_PROVIDER: {
        return this.formSubmissionProvider;
      }
      default: {
        // 定義檢查器擋掉未登錄的來源;走到這裡是舊資料,一律查無(fail-closed)
        return EMPTY_PROVIDER;
      }
    }
  }

  // ---- user:操作者可見範圍內組織的成員(org_user)----

  private readonly userProvider: LookupProviderRuntime = {
    search: async (facts, source, query) => {
      const filter = await this.userFilter(facts, source);
      if (filter === null) {
        return { items: [], totalCount: 0 };
      }
      const keyword = query.keyword?.trim();
      const condition = keyword
        ? {
            $and: [
              filter,
              {
                $or: [
                  { name: { $regex: escapeRegex(keyword), $options: "i" } },
                  { account: { $regex: escapeRegex(keyword), $options: "i" } },
                ],
              },
            ],
          }
        : filter;
      const [totalCount, found] = await Promise.all([
        this.users.count(facts.operator, condition),
        this.users.findMany(facts.operator, condition, {
          sort: { name: 1, _id: 1 },
          skip: (query.page - 1) * query.pageSize,
          limit: query.pageSize,
        }),
      ]);
      return {
        items: found.map((user) => this.userRecord(facts, user)),
        totalCount,
      };
    },
    findByValues: async (facts, source, field, values) => {
      const filter = await this.userFilter(facts, source);
      if (
        filter === null ||
        !["id", "name", "account", "email"].includes(field)
      ) {
        return [];
      }
      const byValue =
        field === "id"
          ? { _id: { $in: objectIdsOf(values) } }
          : { [field]: { $in: [...values] } };
      const found = await this.users.findMany(facts.operator, {
        $and: [filter, byValue],
      });
      return found.map((user) => this.userRecord(facts, user));
    },
  };

  /** 可見範圍內組織的成員;根組織(可見全部)不限。`filter` 只收 `enabled`。 */
  private async userFilter(
    facts: FormOperatorFacts,
    source: LookupSourceDescriptor,
  ): Promise<Record<string, unknown> | null> {
    const fixed = allowedFilterOf(USER_PROVIDER, source.filter);
    if (facts.operator.visibleOrgIds === "all") {
      return fixed;
    }
    const links = await this.relations.listLinks("org_user", {
      firstIds: facts.operator.visibleOrgIds,
    });
    if (links.length === 0) {
      return null;
    }
    return { ...fixed, _id: { $in: links.map((link) => link.secondId) } };
  }

  private userRecord(
    facts: FormOperatorFacts,
    user: { _id: Types.ObjectId; name: string; account: string; email: string },
  ): LookupRecord {
    const canRead = (field: string): boolean => {
      const permission = USER_PROVIDER.fields[field]?.permission;
      return permission === undefined || this.access.has(facts, permission);
    };
    const values: Record<string, unknown> = { name: user.name };
    if (canRead("account")) {
      values.account = user.account;
    }
    if (canRead("email")) {
      values.email = user.email;
    }
    return { id: String(user._id), values, labels: {} };
  }

  // ---- org:操作者可見範圍內的組織 ----

  private readonly orgProvider: LookupProviderRuntime = {
    search: async (facts, source, query) => {
      const reader = visibleOrgReader(facts.operator);
      const fixed = allowedFilterOf(ORG_PROVIDER, source.filter);
      const keyword = query.keyword?.trim();
      const condition = keyword
        ? { ...fixed, name: { $regex: escapeRegex(keyword), $options: "i" } }
        : fixed;
      const [totalCount, found] = await Promise.all([
        this.orgs.count(reader, condition),
        this.orgs.findMany(reader, condition, {
          sort: { name: 1, _id: 1 },
          skip: (query.page - 1) * query.pageSize,
          limit: query.pageSize,
        }),
      ]);
      return { items: found.map((org) => orgRecord(org)), totalCount };
    },
    findByValues: async (facts, source, field, values) => {
      if (!["id", "name", "slug"].includes(field)) {
        return [];
      }
      const fixed = allowedFilterOf(ORG_PROVIDER, source.filter);
      const condition =
        field === "id"
          ? { ...fixed, _id: { $in: objectIdsOf(values) } }
          : { ...fixed, [field]: { $in: [...values] } };
      const found = await this.orgs.findMany(
        visibleOrgReader(facts.operator),
        condition,
      );
      return found.map((org) => orgRecord(org));
    },
  };

  // ---- form_submission:依每筆**自己綁的版本**判斷欄位 ----

  private readonly formSubmissionProvider: LookupProviderRuntime = {
    search: async (facts, source, query, fields) => {
      const scope = await this.submissionScope(facts, source);
      if (scope === null) {
        return { items: [], totalCount: 0 };
      }
      const keyword = query.keyword?.trim();
      // 關鍵字只比對摘要標題(受保護欄位不可當摘要槽,所以不會拿它試出受保護的值)
      const filter = keyword
        ? {
            ...scope.filter,
            "summary.title": { $regex: escapeRegex(keyword), $options: "i" },
          }
        : scope.filter;
      const [totalCount, found] = await Promise.all([
        this.submissions.count(facts.operator, filter),
        this.submissions.findMany(facts.operator, filter, {
          sort: { submittedAt: -1, _id: -1 },
          skip: (query.page - 1) * query.pageSize,
          limit: query.pageSize,
        }),
      ]);
      return {
        items: await this.submissionRecords(facts, scope, found, fields),
        totalCount,
      };
    },
    findByValues: async (facts, source, field, values, fields) => {
      const scope = await this.submissionScope(facts, source);
      // 表單提交只能以 id 取回(欄位值不是唯一鍵,也可能受保護)
      if (scope === null || field !== "id") {
        return [];
      }
      const found = await this.submissions.findMany(facts.operator, {
        ...scope.filter,
        _id: { $in: objectIdsOf(values) },
      });
      return this.submissionRecords(facts, scope, found, fields);
    },
  };

  /** 來源表單的提交:要有該表單所屬模組的 `view`;可見範圍 / 資料範圍由插件自動套。 */
  private async submissionScope(
    facts: FormOperatorFacts,
    source: LookupSourceDescriptor,
  ): Promise<{
    formKey: string;
    moduleKey: string;
    filter: Record<string, unknown>;
  } | null> {
    if (!source.formKey) {
      return null;
    }
    const form = await this.access.findForm(facts.operator, source.formKey);
    if (
      !form ||
      !this.access.has(facts, formModulePermission(form.moduleKey, "view"))
    ) {
      return null;
    }
    return {
      formKey: form.key,
      moduleKey: form.moduleKey,
      filter: {
        formKey: form.key,
        moduleKey: form.moduleKey,
        ...(source.completedOnly === false ? {} : { status: "completed" }),
      },
    };
  }

  /**
   * 每一筆依**它自己綁的版本**決定要的欄位能不能給(Spec §5 的表):
   * 存在且非受保護 → 語意值(+ 選項 / 引用的 label);存在但受保護且沒有 show → **省略**;
   * 那一版沒有這個欄位 → null。摘要槽照回。
   */
  private async submissionRecords(
    facts: FormOperatorFacts,
    scope: { formKey: string; moduleKey: string },
    found: readonly SubmissionRecord[],
    requested: readonly string[],
  ): Promise<LookupRecord[]> {
    const fieldsByVersion = await this.fieldsByVersion(
      facts.operator,
      scope.formKey,
      found.map((record) => record.version),
    );
    const gate = fieldGateOf(facts, scope.moduleKey, scope.formKey);
    return found.map((record) => {
      const fields = fieldsByVersion.get(record.version) ?? [];
      const byKey = new Map(fields.map((field) => [field.key, field]));
      const values: Record<string, unknown> = {};
      const labels: Record<string, string | null> = {};
      const summary = (record.summary ?? {}) as Record<string, unknown>;
      for (const name of new Set(requested)) {
        if (name === "id") {
          continue;
        }
        if (name in SUMMARY_SLOT_FIELDS) {
          values[name] = summary[name] ?? null;
          continue;
        }
        const field = byKey.get(name);
        if (!field) {
          values[name] = null;
          continue;
        }
        if (!gate.canShow(fields, name)) {
          continue;
        }
        const stored = record.values[name];
        values[name] = semanticValueOf(field, stored);
        if (LABELLED_TYPES.has(field.type)) {
          labels[name] = labelTextOf(optionLabelOf(field, stored));
        }
      }
      return { id: String(record._id), values, labels };
    });
  }

  private async fieldsByVersion(
    operator: OperatorContext,
    formKey: string,
    versions: readonly number[],
  ): Promise<Map<number, FieldDef[]>> {
    const unique = [...new Set(versions)];
    const result = new Map<number, FieldDef[]>();
    if (unique.length === 0) {
      return result;
    }
    const docs = await this.versions.findMany(operator, {
      formKey,
      version: { $in: unique },
    });
    for (const doc of docs) {
      if (doc.version !== null) {
        result.set(doc.version, doc.fields);
      }
    }
    return result;
  }
}
