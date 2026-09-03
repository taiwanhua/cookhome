import { useRecipesQuery } from "@repo/graphql";

import { graphqlClient } from "../lib/graphql";

import "./styles.css";

function App() {
  const { data, isPending, error } = useRecipesQuery(graphqlClient);

  return (
    <div className="container">
      <h1 className="title">
        CookHome <br />
        <span>後台管理</span>
      </h1>
      {isPending ? <p className="description">載入中…</p> : null}
      {error ? (
        <p className="description">無法連線到 API,請確認 api 服務已啟動</p>
      ) : null}
      {data ? (
        <>
          <p className="description">共 {data.recipes.length} 道食譜</p>
          <ul>
            {data.recipes.map((recipe) => (
              <li key={recipe.id}>{recipe.title}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export default App;
