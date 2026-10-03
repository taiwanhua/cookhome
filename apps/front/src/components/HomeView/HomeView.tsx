import { getTranslations } from "next-intl/server";

export const HomeView = async () => {
  const t = await getTranslations("front.home");
  const tCommon = await getTranslations("common");

  return (
    <div className="container">
      <h1 className="title">
        {tCommon("brand")} <br />
        <span>{t("subtitle")}</span>
      </h1>
    </div>
  );
};
