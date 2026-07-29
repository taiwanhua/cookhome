import { useRecipesQuery } from "@repo/graphql";

import { graphqlClient } from "../lib/graphql";

export const revalidate = 60;

export default async function HomePage() {
  const { recipes } = await useRecipesQuery.fetcher(graphqlClient)();

  return (
    <div className="container">
      <h1 className="title">
        CookHome <br />
        <span>家常食譜</span>
      </h1>
      {recipes.length === 0 ? (
        <p className="description">還沒有食譜,快來新增第一道菜!</p>
      ) : (
        <ul>
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <h2>{recipe.title}</h2>
              <p>{recipe.description}</p>
              <p>
                烹調 {recipe.cookMinutes} 分鐘 · {recipe.servings} 人份
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
