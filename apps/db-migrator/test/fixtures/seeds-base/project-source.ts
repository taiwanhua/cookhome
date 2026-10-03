import type {
  ProjectSeedSettings,
  SeedSource,
} from "../../../seeds/base/seed-source";

/**
 * 夾具:一個**空的專案來源**(沒有專案模組、普通種子與定義)。用來驗只屬於底座的內容:
 * 固定數量、底座宣告的落庫結果,以及要自己決定專案內容的負例。
 * 引用專案在正式的 `seeds/project/` 登記自己的內容後,這些測試的期望值不能跟著變,
 * 所以不讀正式專案來源;正式 registry 的合法性另由契約檢查驗。內容只供測試,不是任何正式專案的設定。
 */

/** 專案初值:只給根組織必要的三個值,不指定任何模組初值。 */
export const baseOnlyProjectSettings: ProjectSeedSettings = {
  rootOrg: {
    name: "底座夾具營運組織",
    description: "空專案來源夾具的根組織",
    settings: {},
  },
  moduleInitialValues: {},
};

export const baseOnlyProjectSource: SeedSource = {
  moduleDeclarations: [],
  seeds: [],
};
