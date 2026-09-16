import type { SeedRegistry } from "../../../src/seed/seed-declaration";

/** 夾具 registry 第 1 版:兩筆種子。 */
export const seedRegistry: SeedRegistry = [
  {
    kind: "documents",
    collection: "seed_fixture_items",
    entries: [
      { key: "alpha", data: { name: "Alpha", order: 1, tags: ["a"] } },
      { key: "beta", data: { name: "Beta", order: 2, tags: [] } },
    ],
  },
];
