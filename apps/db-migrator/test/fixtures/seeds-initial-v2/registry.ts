import type { SeedRegistry } from "../../../src/seed/seed-declaration";

/**
 * 夾具 registry(初始 seed 值第 2 版):alpha 只改 enabled(初始 seed 值的欄位 → 不同步、不算變更);
 * beta 改 name(每次都 seed 的欄位 → 同步)。
 */
export const seedRegistry: SeedRegistry = [
  {
    kind: "documents",
    collection: "seed_fixture_items",
    entries: [
      { key: "alpha", data: { name: "Alpha", enabled: false } },
      { key: "beta", data: { name: "Beta 2", enabled: true } },
    ],
  },
];
