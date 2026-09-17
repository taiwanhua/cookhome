import type { SeedRegistry } from "../../../src/seed/seed-declaration";

/** 夾具 registry(初始 seed 值第 1 版):兩筆皆 enabled=true。 */
export const seedRegistry: SeedRegistry = [
  {
    kind: "documents",
    collection: "seed_fixture_items",
    entries: [
      { key: "alpha", data: { name: "Alpha", enabled: true } },
      { key: "beta", data: { name: "Beta", enabled: true } },
    ],
  },
];
