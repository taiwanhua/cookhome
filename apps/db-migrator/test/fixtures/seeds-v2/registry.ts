import type { SeedRegistry } from "../../../src/seed/seed-declaration";

/** 夾具 registry 第 2 版:alpha 改名、beta 不變、新增 gamma(模擬「修改宣告檔後重跑」)。 */
export const seedRegistry: SeedRegistry = [
  {
    kind: "documents",
    collection: "seed_fixture_items",
    entries: [
      { key: "alpha", data: { name: "Alpha 2", order: 1, tags: ["a"] } },
      { key: "beta", data: { name: "Beta", order: 2, tags: [] } },
      { key: "gamma", data: { name: "Gamma", order: 3, tags: ["g"] } },
    ],
  },
];
