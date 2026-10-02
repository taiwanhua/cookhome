import { getModelToken } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import type { DatabaseRegistration } from "../../database/registration";
import {
  RECIPES_COLLECTION,
  Recipe,
  type RecipeDocument,
  RecipeSchema,
} from "./recipe.schema";
import { RecipesLegacyRepository } from "./recipes-legacy.repository";

/**
 * 專案的資料登記(docs/concepts/data-layer-and-isolation.md「底座與專案資料的組裝」)。
 *
 * 新增專案租戶資料時在這裡加一份登記:schema 沿用示範模組的形狀(先以 schema 選項定 collection,
 * 再掛 `baseFieldsPlugin` 與 `tenantScopePlugin`;模組資料用 `moduleData: true`)、
 * repository 繼承 `BaseRepository`,並為每張 model 列一項歸屬欄為 `orgId` 的組織歸屬檢查 ——
 * 少任何一項 app 都起不來。
 *
 * `recipes` 是唯一的既有例外(無租戶欄位的早期原型),由 `database/database.module.ts` 精確列出;
 * 這裡沒有任何「略過檢查」的旗標可用。
 */
export const PROJECT_DATABASE_REGISTRATIONS: readonly DatabaseRegistration[] = [
  {
    key: "recipes",
    models: [
      {
        name: Recipe.name,
        collection: RECIPES_COLLECTION,
        schema: RecipeSchema,
      },
    ],
    repositories: [
      {
        modelName: Recipe.name,
        provider: {
          provide: RecipesLegacyRepository,
          inject: [getModelToken(Recipe.name)],
          useFactory: (model: Model<RecipeDocument>) =>
            new RecipesLegacyRepository(model),
        },
      },
    ],
    orgDataChecks: [],
  },
];
