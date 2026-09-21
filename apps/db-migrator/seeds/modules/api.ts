import { API_MODULE_KEY } from "../../src/seed/seed-key-convention";
import type { ModuleSeedDeclaration } from "../module-declaration";

/**
 * 隱藏的純 API 模組樹(ADR-0004「API 權限」):API 預設重用頁面權限 key,
 * 僅無對應頁面的純 API 能力放進此樹。不在側欄、不是頁面,故無 route;
 * 整棵子樹豁免「hidden 一律 `-page` 結尾」規則(seed-key-convention)。目前尚無個別權限。
 */
export const apiModules: ModuleSeedDeclaration = {
  nodes: [
    {
      key: API_MODULE_KEY,
      name: "API 能力",
      sidebarType: "hidden",
      parentKey: null,
      order: 99,
      icon: "tune",
      description: "無對應頁面的純 API 權限掛此樹(ADR-0004)",
    },
  ],
};
