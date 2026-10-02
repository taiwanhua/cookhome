import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Types } from "mongoose";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { HOOK_TIMEOUT_MS } from "../../database/test-support/mongo-connection";

const RECIPE_FIELDS = /* GraphQL */ `
  fragment RecipeFields on Recipe {
    id
    title
    description
    ingredients {
      name
      amount
    }
    steps
    cookMinutes
    servings
    tags
    imageUrl
    createdAt
    updatedAt
  }
`;

const RECIPES = /* GraphQL */ `
  ${RECIPE_FIELDS}
  query Recipes {
    recipes {
      ...RecipeFields
    }
  }
`;

const RECIPE = /* GraphQL */ `
  ${RECIPE_FIELDS}
  query Recipe($id: ID!) {
    recipe(id: $id) {
      ...RecipeFields
    }
  }
`;

const CREATE_RECIPE = /* GraphQL */ `
  ${RECIPE_FIELDS}
  mutation CreateRecipe($input: CreateRecipeInput!) {
    createRecipe(input: $input) {
      ...RecipeFields
    }
  }
`;

interface RecipeRow {
  id: string;
  title: string;
  description: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  cookMinutes: number;
  servings: number;
  tags: string[];
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Recipes 搬進 `project/` 之後的相容性(docs/plans/feature-registration.md「Recipes 的既有相容邊界」):
 * 經正式的專案登記與真 AppModule,GraphQL 契約、公開存取、`recipes` collection 與無 orgId 的形狀都不變。
 */
describe("Recipes(專案功能,GraphQL 端點 + 真 MongoDB)", () => {
  let api: AuthTestApp;

  async function create(input: Record<string, unknown>): Promise<RecipeRow> {
    const result = await api.graphql<{ createRecipe: RecipeRow }>(
      CREATE_RECIPE,
      { input },
    );
    expect(result.errors).toBeUndefined();
    const recipe = result.data?.createRecipe;
    if (!recipe) {
      throw new Error("createRecipe 沒有回資料");
    }
    return recipe;
  }

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-recipes");
  }, HOOK_TIMEOUT_MS * 4);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  it("未登入即可建立:只給標題時其餘欄位取預設值", async () => {
    const recipe = await create({ title: "蛋炒飯" });

    expect(recipe).toMatchObject({
      title: "蛋炒飯",
      description: "",
      ingredients: [],
      steps: [],
      cookMinutes: 0,
      servings: 1,
      tags: [],
      imageUrl: null,
    });
    expect(Types.ObjectId.isValid(recipe.id)).toBe(true);
  });

  it("寫進 recipes collection,沒有 orgId 與軟刪除欄位(既有原型的形狀)", async () => {
    const recipe = await create({
      title: "番茄炒蛋",
      description: "家常菜",
      ingredients: [{ name: "番茄", amount: "2 顆" }],
      steps: ["切", "炒"],
      cookMinutes: 10,
      servings: 2,
      tags: ["快炒"],
      imageUrl: "https://example.com/tomato.jpg",
    });

    const row = await api.connection
      .collection("recipes")
      .findOne({ _id: new Types.ObjectId(recipe.id) });
    expect(row).toMatchObject({
      title: "番茄炒蛋",
      ingredients: [{ name: "番茄", amount: "2 顆" }],
      steps: ["切", "炒"],
      cookMinutes: 10,
      servings: 2,
      tags: ["快炒"],
    });
    expect(row).not.toHaveProperty("orgId");
    expect(row).not.toHaveProperty("deletedAt");
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it("recipes:未登入可查,新的在前", async () => {
    const older = await create({ title: "先建的" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await create({ title: "後建的" });

    const result = await api.graphql<{ recipes: RecipeRow[] }>(RECIPES);

    expect(result.errors).toBeUndefined();
    const ids = (result.data?.recipes ?? []).map((recipe) => recipe.id);
    expect(ids.indexOf(newer.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  it("recipe(id):查得到回同一筆,查不到回錯誤", async () => {
    const created = await create({ title: "滷肉飯" });

    const found = await api.graphql<{ recipe: RecipeRow }>(RECIPE, {
      id: created.id,
    });
    expect(found.errors).toBeUndefined();
    expect(found.data?.recipe).toEqual(created);

    const missingId = String(new Types.ObjectId());
    const missing = await api.graphql(RECIPE, { id: missingId });
    expect(missing.errors?.[0]?.message).toBe(`Recipe ${missingId} not found`);
  });
});
