import type { InjectionToken, Provider } from "@nestjs/common";
import type { ModelDefinition } from "@nestjs/mongoose";
import type { Schema } from "mongoose";

import type {
  OrgDataCheckBinding,
  OrgOwnedDataRepository,
  OrgOwnerField,
} from "./org-business-data.reader";
import {
  isLegacyUnscopedModel,
  repositoryTokenOf,
  validateDatabaseRegistrations,
} from "./registration-validation";

export type { OrgOwnedDataRepository } from "./org-business-data.reader";

/** 一張 collection:model 名、實際 collection 名(須與 schema 選項一致)與 schema 本體。 */
export interface DatabaseModelRegistration {
  readonly name: string;
  readonly collection: string;
  readonly schema: Schema;
}

/** 一個資料層出口;DI token 就是它的身分(class / string / symbol 本體)。 */
export interface DatabaseRepositoryRegistration {
  /** 這個出口讀寫的 model(須在同一份登記內);多個出口可共用同一張 model。 */
  readonly modelName: string;
  readonly provider: Provider;
}

/** 一項組織歸屬檢查:刪組織 / 撤銷開通前問「這個組織名下還有沒有這張表的資料」。 */
export interface OrgDataCheckRegistration {
  readonly key: string;
  readonly modelName: string;
  readonly repository: InjectionToken<OrgOwnedDataRepository>;
  readonly ownerField: OrgOwnerField;
}

/**
 * 一份資料登記(docs/concepts/data-layer-and-isolation.md「底座與專案資料的組裝」):
 * 一組 model、它們的資料層出口,以及組織歸屬檢查。底座的放 `database/base/registrations.ts`,
 * 專案的放 `project/database/registrations.ts`,由 `database.module.ts` 組裝。
 */
export interface DatabaseRegistration {
  readonly key: string;
  readonly models: readonly DatabaseModelRegistration[];
  readonly repositories: readonly DatabaseRepositoryRegistration[];
  readonly orgDataChecks: readonly OrgDataCheckRegistration[];
}

/**
 * 既有的無租戶原型(不掛租戶 plugin、不經 BaseRepository、沒有組織歸屬檢查)。
 * 只由固定組裝入口 `database.module.ts` 逐筆列出;登記本身沒有任何「略過檢查」的旗標。
 */
export interface LegacyUnscopedModel {
  readonly modelName: string;
  readonly collection: string;
  readonly repository: InjectionToken;
}

/** 專案登記裡要在啟動時驗證識別的 repository(須為綁對表的 BaseRepository)。 */
export interface ProjectRepositoryBinding {
  readonly token: InjectionToken;
  readonly modelName: string;
  readonly collection: string;
}

/** 組裝結果:直接餵給 `MongooseModule.forFeature` 與 Nest module 的 providers / exports。 */
export interface ComposedDatabase {
  readonly models: readonly ModelDefinition[];
  readonly providers: readonly Provider[];
  /** 只匯出 repository;model provider 與 MongooseModule 都不對功能模組開放。 */
  readonly exports: readonly InjectionToken[];
  readonly orgDataChecks: readonly OrgDataCheckBinding[];
  readonly projectRepositories: readonly ProjectRepositoryBinding[];
}

/**
 * 把底座與專案的資料登記組成一份:先整批驗證(任何碰撞、錯綁、缺 plugin 都拋
 * `DatabaseRegistrationError`),再依登記順序導出 model、providers、exports 與組織歸屬檢查。
 * schema 沿用登記的 instance,不 clone、不補掛 plugin;輸入不會被修改。
 */
export function composeDatabaseRegistrations(
  base: readonly DatabaseRegistration[],
  project: readonly DatabaseRegistration[],
  legacyUnscopedModels: readonly LegacyUnscopedModel[] = [],
): ComposedDatabase {
  validateDatabaseRegistrations(base, project, legacyUnscopedModels);
  const all = [...base, ...project];
  const collectionOf = new Map(
    all.flatMap((registration) =>
      registration.models.map((model) => [model.name, model.collection]),
    ),
  );
  const requireCollection = (modelName: string): string =>
    // 驗證已保證每個 modelName 都在登記內
    collectionOf.get(modelName) ?? modelName;
  const repositories = all.flatMap((registration) => registration.repositories);

  return {
    models: all.flatMap((registration) =>
      registration.models.map((model) => ({
        name: model.name,
        schema: model.schema,
        collection: model.collection,
      })),
    ),
    providers: repositories.map((repository) => repository.provider),
    exports: repositories.map((repository) =>
      repositoryTokenOf(repository.provider),
    ),
    orgDataChecks: all.flatMap((registration) =>
      registration.orgDataChecks.map((check) => ({
        key: check.key,
        modelName: check.modelName,
        collection: requireCollection(check.modelName),
        repository: check.repository,
        ownerField: check.ownerField,
      })),
    ),
    projectRepositories: project.flatMap((registration) =>
      registration.repositories
        .filter(
          (repository) =>
            !registration.models.some(
              (model) =>
                model.name === repository.modelName &&
                isLegacyUnscopedModel(
                  registration,
                  model,
                  legacyUnscopedModels,
                ),
            ),
        )
        .map((repository) => ({
          token: repositoryTokenOf(repository.provider),
          modelName: repository.modelName,
          collection: requireCollection(repository.modelName),
        })),
    ),
  };
}
