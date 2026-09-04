import { useRecipesQuery } from "@repo/graphql";
import { getTranslations } from "next-intl/server";

import { enableStaticRendering } from "../../i18n/set-request-locale";
import { graphqlClient } from "../../lib/graphql";

export const revalidate = 60;

export default async function HomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  enableStaticRendering(locale);

  const t = await getTranslations("front.home");
  const tCommon = await getTranslations("common");
  const { recipes } = await useRecipesQuery.fetcher(graphqlClient)();

  return (
    <div className="container">
      <h1 className="title">
        {tCommon("brand")} <br />
        <span>{t("subtitle")}</span>
      </h1>
      {recipes.length === 0 ? (
        <p className="description">{t("empty")}</p>
      ) : (
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
      )}
    </div>
  );
}
