/* eslint-disable unicorn/prefer-structured-clone -- 這裡要的是「轉成純 JSON 值」不是深拷貝:資料庫讀出的陣列 / 子文件經 toJSON 才變成純陣列與純物件,structuredClone 做不到;到期條件:無 */
import { GraphQLError } from "graphql";

import {
  type DefinitionSeedSet,
  type PortableCatalog,
  type PortableIssue,
  SeedSerializationError,
  definitionSeedFileName,
  isValidDefinitionRevision,
  serializeSeedSet,
  validatePortableDefinition,
} from "@repo/domain/seed";

/**
 * 表單與流程「匯出專案設定」共用的部分(`exportFormSeed` / `exportWorkflowSeed`):
 * 輸入檢查、可攜性檢查、輸出檔名與原始碼。規則正本都在 `@repo/domain/seed`
 * (`validatePortableDefinition`、`serializeSeedSet`、`definitionSeedFileName`),這裡只接線,不另寫一份。
 * 匯出是唯讀的:不寫資料庫、不留稽核、也不建安裝紀錄。
 */

/** 匯出的一個檔案:檔名固定 `<key>.<revision>.seed.ts`,內容是可直接登記的 TypeScript。 */
export interface DefinitionSeedFile {
  fileName: string;
  source: string;
}

/** 兩個模組各自的 `VALIDATION_FAILED` 包裝(`validationError` / `workflowValidationError`)。 */
type InvalidInputError = (message: string, fields: string[]) => GraphQLError;

/** 轉成純 JSON 值:資料庫讀出的陣列 / 子文件不是純陣列與純物件,共用契約的檢查與匯出不收。 */
export function toPlainJson<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}

/** `revision` 格式與 `changelog` 必填;不符 → 該模組的 `VALIDATION_FAILED`(`fields` 指出是哪一欄)。 */
export function assertSeedExportInput(
  input: { revision: string; changelog: string },
  invalid: InvalidInputError,
): void {
  const fields = [
    ...(isValidDefinitionRevision(input.revision) ? [] : ["revision"]),
    ...(input.changelog.trim() === "" ? ["changelog"] : []),
  ];
  if (fields.length > 0) {
    throw invalid(`Seed export input is invalid: ${fields.join(", ")}`, fields);
  }
}

/**
 * 定義不能跨環境交付:`VALIDATION_FAILED` + `fields: ["definition"]` + `issues`
 * (`@repo/domain/seed` 的 `PortableIssue`,每筆帶宣告內的精確位置 `path` 與修正原因)。
 * 外框與兩個模組既有的「定義檢查器有錯」相同,差別只在 `issues` 的每一筆以 `path` 定位。
 */
export function seedNotPortableError(
  key: string,
  issues: readonly PortableIssue[],
): GraphQLError {
  return new GraphQLError(`Definition ${key} is not portable`, {
    extensions: { code: "VALIDATION_FAILED", fields: ["definition"], issues },
  });
}

/**
 * 一份宣告 → 匯出檔。先過可攜性檢查(含形狀與純資料邊界),有任何一筆錯就整份不匯出;
 * 通過才交給共用的序列化(字串一律安全編碼)。
 */
export function definitionSeedFileOf(
  seed: DefinitionSeedSet,
  catalog: PortableCatalog,
): DefinitionSeedFile {
  const { errors } = validatePortableDefinition(seed, catalog);
  if (errors.length > 0) {
    throw seedNotPortableError(seed.key, errors);
  }
  try {
    return {
      fileName: definitionSeedFileName(seed),
      source: serializeSeedSet(seed),
    };
  } catch (error) {
    if (error instanceof SeedSerializationError) {
      throw seedNotPortableError(seed.key, [
        { code: "SEED_SHAPE", message: error.detail, path: error.path },
      ]);
    }
    throw error;
  }
}
