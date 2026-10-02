/**
 * 種子宣告的型別(正本:ADR-0002)。契約本身在 `@repo/domain/seed`(api 的發布適配、admin 的匯出與本包共用同一份),
 * 本檔只把它 re-export 給 db-migrator 內部沿用,不另外定義任何型別。
 */
export {
  DEFAULT_INITIAL_SEED_VALUE_FIELDS,
  type DefinitionSeedSet,
  type FormDefinitionSeedSet,
  type SeedAdoptBy,
  type SeedDocument,
  type SeedDocumentSet,
  type SeedIdReference,
  type SeedKeyReference,
  type SeedRegistry,
  type SeedRelation,
  type SeedRelationSet,
  type SeedRootAdminSet,
  type SeedSet,
  type WorkflowDefinitionSeedSet,
  isDefinitionSeedSet,
  isSeedIdReference,
  seedRef,
} from "@repo/domain/seed";
