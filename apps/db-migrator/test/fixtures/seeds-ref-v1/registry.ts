import { type SeedRegistry, seedRef } from "../../../src/seed/seed-declaration";

/** 夾具 registry(引用第 1 版):兩個群組,一個成員以 seedRef 指向群組 a。 */
export const seedRegistry: SeedRegistry = [
  {
    kind: "documents",
    collection: "seed_fixture_groups",
    entries: [
      { key: "a", data: { name: "Group A" } },
      { key: "b", data: { name: "Group B" } },
    ],
  },
  {
    kind: "documents",
    collection: "seed_fixture_members",
    entries: [
      {
        key: "m",
        data: { name: "Member", groupId: seedRef("seed_fixture_groups", "a") },
      },
    ],
  },
];
