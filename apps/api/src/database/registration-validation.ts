import type { InjectionToken, Provider } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";

import { OrgBusinessDataReader } from "./org-business-data.reader";
import { hasBaseFields } from "./plugins/base-fields.plugin";
import {
  getTenantScope,
  getTenantScopeCollection,
} from "./plugins/tenant-scope.plugin";
import type {
  DatabaseModelRegistration,
  DatabaseRegistration,
  LegacyUnscopedModel,
} from "./registration";
import { DatabaseRegistrationError } from "./registration-error";

type RegistrationSource = "base" | "project";

interface SourcedRegistration {
  readonly source: RegistrationSource;
  readonly registration: DatabaseRegistration;
}

/** repository 不得佔用的 token:組裝器自己的 provider、Mongoose 連線、Nest 的全域擴充點。 */
const RESERVED_TOKENS: ReadonlySet<InjectionToken> = new Set<InjectionToken>([
  OrgBusinessDataReader,
  getConnectionToken(),
  APP_GUARD,
  APP_INTERCEPTOR,
  APP_FILTER,
  APP_PIPE,
]);

/** provider 的 DI token:class provider 是 class 本身,其餘取 `provide`。 */
export function repositoryTokenOf(provider: Provider): InjectionToken {
  return typeof provider === "function" ? provider : provider.provide;
}

/** 錯誤訊息用的 token 顯示名(比較一律用 token 本體,這裡只是給人看)。 */
function tokenLabel(token: InjectionToken): string {
  if (typeof token === "function") {
    return token.name;
  }
  if (typeof token === "symbol") {
    return token.description ?? token.toString();
  }
  return typeof token === "string" ? token : JSON.stringify(token);
}

function ownerOf({ source, registration }: SourcedRegistration): string {
  return `${source}:${registration.key}`;
}

/** 記下「誰先用了這個鍵」;已被用過就拋錯並列出兩個來源。鍵以本體比較(Map 的語意)。 */
function claim<TKey>(
  seen: Map<TKey, string>,
  key: TKey,
  owner: string,
  subject: string,
): void {
  const previous = seen.get(key);
  if (previous !== undefined) {
    throw new DatabaseRegistrationError(
      `${subject}重複:${previous} 與 ${owner}`,
    );
  }
  seen.set(key, owner);
}

function requireText(value: string, subject: string): void {
  if (value.trim() === "") {
    throw new DatabaseRegistrationError(`${subject} 不可空白`);
  }
}

/**
 * 這張 model 是不是固定入口列出的既有例外:model 名、collection 與它在該登記裡的**每一個**
 * repository token 都要精確相符(多掛一個別的出口就不算)。
 */
export function isLegacyUnscopedModel(
  registration: DatabaseRegistration,
  model: DatabaseModelRegistration,
  legacyUnscopedModels: readonly LegacyUnscopedModel[],
): boolean {
  const tokens = registration.repositories
    .filter((repository) => repository.modelName === model.name)
    .map((repository) => repositoryTokenOf(repository.provider));
  return legacyUnscopedModels.some(
    (legacy) =>
      legacy.modelName === model.name &&
      legacy.collection === model.collection &&
      tokens.length > 0 &&
      tokens.every((token) => token === legacy.repository),
  );
}

function assertUniqueKeys(all: readonly SourcedRegistration[]): void {
  const seen = new Map<string, string>();
  for (const sourced of all) {
    requireText(sourced.registration.key, `${sourced.source} 的登記 key`);
    claim(
      seen,
      sourced.registration.key,
      ownerOf(sourced),
      `登記 key「${sourced.registration.key}」`,
    );
  }
}

function assertUniqueModels(all: readonly SourcedRegistration[]): void {
  const names = new Map<string, string>();
  const collections = new Map<string, string>();
  for (const sourced of all) {
    const owner = ownerOf(sourced);
    for (const model of sourced.registration.models) {
      requireText(model.name, `${owner} 的 model 名`);
      requireText(
        model.collection,
        `${owner} 的 model「${model.name}」collection`,
      );
      claim(names, model.name, owner, `model「${model.name}」`);
      claim(
        collections,
        model.collection,
        `${owner}(${model.name})`,
        `collection「${model.collection}」`,
      );
    }
  }
}

function assertRepositories(all: readonly SourcedRegistration[]): void {
  const modelTokens = new Set<InjectionToken>(
    all.flatMap(({ registration }) =>
      registration.models.map((model) => getModelToken(model.name)),
    ),
  );
  const seen = new Map<InjectionToken, string>();
  for (const sourced of all) {
    const owner = ownerOf(sourced);
    const { registration } = sourced;
    for (const repository of registration.repositories) {
      const token = repositoryTokenOf(repository.provider);
      const label = tokenLabel(token);
      if (
        !registration.models.some(
          (model) => model.name === repository.modelName,
        )
      ) {
        throw new DatabaseRegistrationError(
          `repository「${label}」指向的 model「${repository.modelName}」不在登記「${registration.key}」內(${owner})`,
        );
      }
      if (modelTokens.has(token)) {
        throw new DatabaseRegistrationError(
          `repository token「${label}」撞到 model token(${owner})`,
        );
      }
      if (RESERVED_TOKENS.has(token)) {
        throw new DatabaseRegistrationError(
          `repository token「${label}」是保留 token,不可登記(${owner})`,
        );
      }
      claim(seen, token, owner, `repository token「${label}」`);
    }
  }
}

function assertChecks(all: readonly SourcedRegistration[]): void {
  const seen = new Map<string, string>();
  for (const sourced of all) {
    const owner = ownerOf(sourced);
    const { registration } = sourced;
    for (const check of registration.orgDataChecks) {
      requireText(check.key, `${owner} 的檢查 key`);
      claim(seen, check.key, owner, `檢查 key「${check.key}」`);
      const label = tokenLabel(check.repository);
      const repository = registration.repositories.find(
        (candidate) =>
          repositoryTokenOf(candidate.provider) === check.repository,
      );
      if (repository === undefined) {
        throw new DatabaseRegistrationError(
          `檢查「${check.key}」指向的 repository「${label}」不在登記「${registration.key}」內(${owner})`,
        );
      }
      if (repository.modelName !== check.modelName) {
        throw new DatabaseRegistrationError(
          `檢查「${check.key}」宣告 model「${check.modelName}」,但 repository「${label}」登記的是 model「${repository.modelName}」(${owner})`,
        );
      }
    }
  }
}

/**
 * 專案租戶 model 的形狀(沿用示範模組):baseFields、tenantScope 的業務類 `orgId` 範圍、
 * 不開全域資料、掛 plugin 前就定好 collection,並且一定有組織歸屬檢查。
 * 一律以 plugin 自己留的記號判斷,不讀 Mongoose 私有 metadata、不把欄位存在當成中介層的證據。
 */
function assertProjectTenantModel(
  registration: DatabaseRegistration,
  model: DatabaseModelRegistration,
): void {
  const subject = `project:${registration.key} 的 model「${model.name}」`;
  if (!hasBaseFields(model.schema)) {
    throw new DatabaseRegistrationError(`${subject}沒有掛 baseFieldsPlugin`);
  }
  const scope = getTenantScope(model.schema);
  if (scope === undefined) {
    throw new DatabaseRegistrationError(`${subject}沒有掛 tenantScopePlugin`);
  }
  if (
    scope.kind !== "business" ||
    scope.path !== "orgId" ||
    scope.allowGlobal
  ) {
    throw new DatabaseRegistrationError(
      `${subject}的租戶範圍必須是 kind: business、path: orgId、allowGlobal: false`,
    );
  }
  // 中介層閉包拿的是掛 plugin 當下的 collection;與 schema 現在的選項不同 = 事後才補(規則會靜默不套)
  if (
    getTenantScopeCollection(model.schema) !== model.schema.get("collection")
  ) {
    throw new DatabaseRegistrationError(
      `${subject}必須在掛 tenantScopePlugin 之前就以 schema 選項設定 collection「${model.collection}」`,
    );
  }
  assertOrgIdPath(subject, model);
  if (
    !registration.orgDataChecks.some((check) => check.modelName === model.name)
  ) {
    throw new DatabaseRegistrationError(
      `${subject}沒有組織歸屬檢查(orgDataChecks)`,
    );
  }
}

/**
 * schema 必須真的宣告 `orgId`:必填的 ObjectId。plugin 只裝中介層、不替 schema 補這一欄 ——
 * 沒宣告時 strict 模式會在存檔時把 `orgId` 丟掉,資料寫得進去卻沒有歸屬,租戶過濾與
 * 刪組織前的存在性檢查都查不到它。這裡補的是欄位形狀,plugin 是否安裝仍以上面的記號為準。
 * 只用 Mongoose 公開的 `schema.path()` 與 SchemaType 的 `instance` / `isRequired` / `options`。
 */
function assertOrgIdPath(
  subject: string,
  model: DatabaseModelRegistration,
): void {
  const orgId = model.schema.path("orgId") as
    | {
        instance?: string;
        isRequired?: boolean;
        options?: { required?: unknown };
      }
    | undefined;
  if (orgId === undefined) {
    throw new DatabaseRegistrationError(
      `${subject}的 schema 沒有宣告 orgId 欄位(需為必填的 ObjectId)`,
    );
  }
  // 注意 `@Prop({ type: Types.ObjectId })`(bson 的 class)經 @nestjs/mongoose 會變成 Mixed:
  // Mixed 不轉型,字串 orgId 會原樣存進去,之後以 ObjectId 查就查不到。要寫 mongoose 的 SchemaType
  if (orgId.instance !== "ObjectId") {
    throw new DatabaseRegistrationError(
      `${subject}的 orgId 必須是 ObjectId,現在是 ${orgId.instance ?? "未知型別"}` +
        "(@Prop 的 type 請寫 mongoose 的 Schema.Types.ObjectId,不是 Types.ObjectId)",
    );
  }
  // 只收「無條件必填」:把公開的 required 選項還原成它的條件值,必須正好是 true。
  // 函式(含包在 `[fn, 訊息]` 或 `{ isRequired: fn }` 裡的)是有條件必填 —— `isRequired` 照樣是 true,
  // 條件回 false 時沒有 orgId 的文件仍通過驗證,所以不能只看 `isRequired`
  if (
    orgId.isRequired !== true ||
    requiredConditionOf(orgId.options?.required) !== true
  ) {
    throw new DatabaseRegistrationError(
      `${subject}的 orgId 必須無條件必填(required: true)`,
    );
  }
}

/**
 * Mongoose 的 `required` 選項有三種寫法:值本身、`[值, 訊息]`、`{ isRequired: 值, message }`。
 * 取出其中的條件值(布林或函式);認不得的形狀原樣回傳,由呼叫端當成不合格。
 */
function requiredConditionOf(required: unknown): unknown {
  if (Array.isArray(required)) {
    return required[0];
  }
  if (
    typeof required === "object" &&
    required !== null &&
    "isRequired" in required
  ) {
    return required.isRequired;
  }
  return required;
}

function assertProjectRegistration(
  registration: DatabaseRegistration,
  legacyUnscopedModels: readonly LegacyUnscopedModel[],
): void {
  for (const model of registration.models) {
    if (!isLegacyUnscopedModel(registration, model, legacyUnscopedModels)) {
      assertProjectTenantModel(registration, model);
    }
  }
  for (const check of registration.orgDataChecks) {
    if (check.ownerField !== "orgId") {
      throw new DatabaseRegistrationError(
        `檢查「${check.key}」:專案資料的歸屬欄固定為 orgId(project:${registration.key})`,
      );
    }
  }
}

/** 登記的 collection 必須就是 schema 選項寫的那個;只有既有例外可以沒寫(由 forFeature 明確指定)。 */
function assertSchemaCollections(
  all: readonly SourcedRegistration[],
  legacyUnscopedModels: readonly LegacyUnscopedModel[],
): void {
  for (const sourced of all) {
    for (const model of sourced.registration.models) {
      const declared: string | undefined = model.schema.get("collection");
      const legacy =
        sourced.source === "project" &&
        isLegacyUnscopedModel(
          sourced.registration,
          model,
          legacyUnscopedModels,
        );
      if (declared === model.collection || (declared === undefined && legacy)) {
        continue;
      }
      throw new DatabaseRegistrationError(
        `${ownerOf(sourced)} 的 model「${model.name}」:登記的 collection「${model.collection}」與 schema 選項「${declared ?? "(未設定)"}」不一致`,
      );
    }
  }
}

/**
 * 資料登記的整批驗證(純函式,不碰連線):
 * 1. 登記 key、model 名、實際 collection、repository token、檢查 key 全域唯一
 * 2. repository token 不撞 model token 與保留 token
 * 3. repository → model、check → repository → model 都在同一份登記內對得起來
 * 4. 專案的每張 model 都是租戶資料的標準形狀並帶組織歸屬檢查(既有例外除外)
 * 5. 登記的 collection 與 schema 選項一致
 */
export function validateDatabaseRegistrations(
  base: readonly DatabaseRegistration[],
  project: readonly DatabaseRegistration[],
  legacyUnscopedModels: readonly LegacyUnscopedModel[],
): void {
  const all: SourcedRegistration[] = [
    ...base.map((registration) => ({ source: "base" as const, registration })),
    ...project.map((registration) => ({
      source: "project" as const,
      registration,
    })),
  ];
  assertUniqueKeys(all);
  assertUniqueModels(all);
  assertRepositories(all);
  assertChecks(all);
  for (const registration of project) {
    assertProjectRegistration(registration, legacyUnscopedModels);
  }
  assertSchemaCollections(all, legacyUnscopedModels);
}
