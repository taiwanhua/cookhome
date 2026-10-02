/* eslint-disable @repo/no-raw-model-query -- deprecated:早期原型(無租戶欄位)的唯一資料出口,食譜域重寫時整包刪除 */
import type { Model } from "mongoose";

import type { Recipe, RecipeDocument } from "./recipe.schema";

/** 建立一筆食譜的內容(只有標題必填,其餘由 schema 預設值補)。 */
export type NewRecipe = Pick<Recipe, "title"> &
  Partial<Omit<Recipe, "id" | "title" | "createdAt" | "updatedAt">>;

/**
 * `recipes` 的專用資料出口(既有相容邊界,docs/plans/feature-registration.md「Recipes 的既有相容邊界」)。
 *
 * 食譜是早期原型:沒有 `orgId`、不掛租戶 plugin、不經 BaseRepository,公開查詢給 front 用。
 * 三個裸 Model 操作只留在這一檔;固定組裝入口 `database/database.module.ts` 精確列出
 * 這一組(model、collection、本 class)為唯一例外。**新的專案租戶模組不可照抄**,
 * 一律走 BaseRepository + 租戶 plugin + 組織歸屬檢查。
 */
export class RecipesLegacyRepository {
  constructor(private readonly model: Model<RecipeDocument>) {}

  /** 全部食譜,新的在前。 */
  findAllNewestFirst(): Promise<RecipeDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<RecipeDocument | null> {
    return this.model.findById(id).exec();
  }

  create(recipe: NewRecipe): Promise<RecipeDocument> {
    return this.model.create(recipe);
  }
}
