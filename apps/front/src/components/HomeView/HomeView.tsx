import { getTranslations } from "next-intl/server";

import { useRecipesQuery } from "@repo/graphql";

import { graphqlClient } from "@/lib/graphql";

import { RecipeList } from "./RecipeList";

export const HomeView = async () => {
  const t = await getTranslations("front.home");
  const tCommon = await getTranslations("common");
  const { recipes } = await useRecipesQuery.fetcher(graphqlClient)();

  return (
    <div className="container">
      <h1 className="title">
        {tCommon("brand")} <br />
        <span>{t("subtitle")}</span>
      </h1>
      <RecipeList recipes={recipes} />
    </div>
  );
};
