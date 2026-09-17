import { type SeedRegistry, seedRef } from "../../../src/seed/seed-declaration";

/** 夾具 registry(引用缺漏):成員指向從未種子化的群組 — seed 應失敗並指出缺哪一筆。 */
export const seedRegistry: SeedRegistry = [
  {
    kind: "documents",
    collection: "seed_fixture_members",
    entries: [
      {
        key: "orphan",
        data: {
          name: "Orphan",
          groupId: seedRef("seed_fixture_groups", "nowhere"),
        },
      },
    ],
  },
];
