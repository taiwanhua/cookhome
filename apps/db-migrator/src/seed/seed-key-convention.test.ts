import { describe, expect, it } from "@jest/globals";

import { seedRegistry } from "../../seeds/registry";
import {
  type SeedDocument,
  type SeedRegistry,
  seedRef,
} from "./seed-declaration";
import { findSeedKeyViolations } from "./seed-key-convention";

/** 以最小 registry 描述一棵模組樹與其權限(純資料,不碰資料庫)。 */
function registryOf(
  modules: SeedDocument[],
  permissions: SeedDocument[] = [],
): SeedRegistry {
  return [
    { kind: "documents", collection: "modules", entries: modules },
    { kind: "documents", collection: "permissions", entries: permissions },
  ];
}

function moduleNode(
  key: string,
  sidebarType: "group" | "link" | "hidden",
  parentKey: string | null = null,
): SeedDocument {
  return {
    key,
    data: {
      name: key,
      sidebarType,
      parentId: parentKey === null ? null : seedRef("modules", parentKey),
    },
  };
}

function permission(key: string, moduleKey: string): SeedDocument {
  return {
    key,
    data: { name: key, moduleId: seedRef("modules", moduleKey) },
  };
}

const demoTree = [
  moduleNode("demo", "group"),
  moduleNode("demo.sub", "group", "demo"),
  moduleNode("demo.sub.sample-one", "link", "demo.sub"),
  moduleNode("demo.sub.sample-one.edit-page", "hidden", "demo.sub.sample-one"),
];

describe("種子權限 key 規約(ADR-0004;純函式全掃種子宣告)", () => {
  it("合規的模組樹與權限沒有違規", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        permission("demo.sub.sample-one.*", "demo.sub.sample-one"),
        permission("demo.sub.sample-one.view", "demo.sub.sample-one"),
        permission(
          "demo.sub.sample-one.show-internal-note",
          "demo.sub.sample-one",
        ),
        permission(
          "demo.sub.sample-one.edit-page.show-history",
          "demo.sub.sample-one.edit-page",
        ),
      ]),
    );
    expect(violations).toEqual([]);
  });

  it("key 必須全小寫 kebab-case、以「.」分層(模組與權限皆然)", () => {
    const violations = findSeedKeyViolations(
      registryOf(
        [...demoTree, moduleNode("demo.SampleTwo", "link", "demo")],
        [
          permission("demo.sub.sample-one.showField", "demo.sub.sample-one"),
          permission("demo.sub.sample-one.show_field", "demo.sub.sample-one"),
        ],
      ),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.SampleTwo"),
      expect.stringContaining("demo.sub.sample-one.showField"),
      expect.stringContaining("demo.sub.sample-one.show_field"),
    ]);
  });

  it("權限 key = 擁有模組 key + 「.」+ 動作,動作恆為單段", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        // 前綴不是 moduleId 指向的模組
        permission("demo.sub.view", "demo.sub.sample-one"),
        // 動作多段
        permission("demo.sub.sample-one.field.show", "demo.sub.sample-one"),
      ]),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.sub.view"),
      expect.stringContaining("demo.sub.sample-one.field.show"),
    ]);
  });

  it("隱藏頁模組 key 一律以 -page 結尾,其他側欄型別不得以 -page 結尾", () => {
    const violations = findSeedKeyViolations(
      registryOf([
        ...demoTree,
        moduleNode("demo.sub.sample-one.view", "hidden", "demo.sub.sample-one"),
        moduleNode("demo.list-page", "link", "demo"),
      ]),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.sub.sample-one.view"),
      expect.stringContaining("demo.list-page"),
    ]);
  });

  it("權限動作禁用 -page 結尾(模組 key 與權限 key 永不同字串)", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        permission("demo.sub.sample-one.edit-page", "demo.sub.sample-one"),
      ]),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.sub.sample-one.edit-page"),
    ]);
  });

  it("key 全域唯一(模組之間、權限之間、模組與權限之間)", () => {
    const violations = findSeedKeyViolations(
      registryOf(
        [...demoTree, moduleNode("demo.sub", "group", "demo")],
        [
          permission("demo.sub.sample-one.view", "demo.sub.sample-one"),
          permission("demo.sub.sample-one.view", "demo.sub.sample-one"),
        ],
      ),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.sub"),
      expect.stringContaining("demo.sub.sample-one.view"),
    ]);
  });

  it("權限的 moduleId 與模組的 parentId 必須指向已宣告(且先宣告)的模組", () => {
    const violations = findSeedKeyViolations(
      registryOf(
        [moduleNode("demo.sub", "group", "demo"), moduleNode("demo", "group")],
        [permission("nowhere.view", "nowhere")],
      ),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.sub"),
      expect.stringContaining("nowhere.view"),
    ]);
  });
});

describe("seeds/registry.ts 靜態檢查", () => {
  it("所有種子模組與權限宣告皆符合 key 規約", () => {
    expect(findSeedKeyViolations(seedRegistry)).toEqual([]);
  });

  it("示範家族依正本落地:10 個模組節點、14 筆權限、每個有自有權限的模組具備 wildcard", () => {
    const documentSets = seedRegistry.filter((set) => set.kind === "documents");
    const moduleKeys = documentSets
      .filter((set) => set.collection === "modules")
      .flatMap((set) => set.entries.map((entry) => entry.key));
    const permissionKeys = documentSets
      .filter((set) => set.collection === "permissions")
      .flatMap((set) => set.entries.map((entry) => entry.key));

    // 正本:docs/modules/demo.sub.sample-one.md 家族模組樹 + demo.sample-two.md 模組節點
    expect(moduleKeys.filter((key) => key.startsWith("demo"))).toEqual([
      "demo",
      "demo.sub",
      "demo.sub.sample-one",
      "demo.sub.sample-one.view-page",
      "demo.sub.sample-one.create-page",
      "demo.sub.sample-one.edit-page",
      "demo.sample-two",
      "demo.sample-two.view-page",
      "demo.sample-two.create-page",
      "demo.sample-two.edit-page",
    ]);

    // 正本:兩份權限表(9 + 5);權限只種示範家族(#29 留言定案)
    expect(permissionKeys).toHaveLength(14);
    expect(new Set(permissionKeys)).toEqual(
      new Set([
        "demo.sub.sample-one.*",
        "demo.sub.sample-one.view",
        "demo.sub.sample-one.create",
        "demo.sub.sample-one.edit",
        "demo.sub.sample-one.delete",
        "demo.sub.sample-one.show-internal-note",
        "demo.sub.sample-one.edit-internal-note",
        "demo.sub.sample-one.create-page.show-tips",
        "demo.sub.sample-one.edit-page.show-history",
        "demo.sample-two.*",
        "demo.sample-two.view",
        "demo.sample-two.create",
        "demo.sample-two.edit",
        "demo.sample-two.delete",
      ]),
    );

    const modulesWithOwnPermissions = new Set(
      permissionKeys.map((key) => key.slice(0, key.lastIndexOf("."))),
    );
    for (const moduleKey of modulesWithOwnPermissions) {
      // 隱藏頁的自有權限(show-tips / show-history)由列表頁的 wildcard 涵蓋子孫,不各自另設 *
      if (moduleKey.endsWith("-page")) continue;
      expect(permissionKeys).toContain(`${moduleKey}.*`);
    }
  });
});
