import { type SeedRegistry, seedRef } from "../../../src/seed/seed-declaration";

/** 夾具 registry(引用第 2 版):成員改指向群組 b(模擬「修改引用後重跑」)。 */
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
        data: { name: "Member", groupId: seedRef("seed_fixture_groups", "b") },
      },
    ],
  },
];
