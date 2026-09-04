import { isLocale, localeLabels, locales, type Locale } from "@repo/i18n";
import { useRecipesQuery } from "@repo/graphql";
import { useTranslations } from "use-intl";

import { graphqlClient } from "../lib/graphql";

import "./styles.css";

interface AppProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

function App({ locale, onLocaleChange }: Readonly<AppProps>) {
  const t = useTranslations("admin.app");
  const tCommon = useTranslations("common");
  const { data, isPending, error } = useRecipesQuery(graphqlClient);

  return (
    <div className="container">
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) {
            onLocaleChange(next);
          }
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {localeLabels[value]}
          </option>
        ))}
      </select>
      <h1 className="title">
        {tCommon("brand")} <br />
        <span>{t("subtitle")}</span>
      </h1>
      {isPending ? <p className="description">{t("loading")}</p> : null}
      {error ? <p className="description">{t("apiError")}</p> : null}
      {data ? (
        <>
          <p className="description">
            {t("total", { count: data.recipes.length })}
          </p>
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
