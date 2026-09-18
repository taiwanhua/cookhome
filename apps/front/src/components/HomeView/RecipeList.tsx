import { getTranslations } from "next-intl/server";

import type { RecipesQuery } from "@repo/graphql";

export interface RecipeListProps {
  recipes: RecipesQuery["recipes"];
}

export const RecipeList = async ({ recipes }: RecipeListProps) => {
  const t = await getTranslations("front.home");

  if (recipes.length === 0) {
    return <p className="description">{t("empty")}</p>;
  }

  return (
    <ul>
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <h2>{recipe.title}</h2>
          <p>{recipe.description}</p>
          <p>
            {t("recipeMeta", {
              minutes: recipe.cookMinutes,
              servings: recipe.servings,
            })}
          </p>
        </li>
      ))}
    </ul>
  );
};
