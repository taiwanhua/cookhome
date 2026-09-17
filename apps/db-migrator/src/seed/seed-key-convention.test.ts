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

/** 每個模組各一筆 `<key>.*`(wildcard 只代表該模組自己這一層,含群組與隱藏頁)。 */
const demoWildcards = demoTree.map((node) =>
  permission(`${node.key}.*`, node.key),
);

describe("種子權限 key 規約(ADR-0004;純函式全掃種子宣告)", () => {
  it("合規的模組樹與權限沒有違規", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        ...demoWildcards,
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
          ...demoWildcards,
          permission("demo.SampleTwo.*", "demo.SampleTwo"),
          permission("demo.sub.sample-one.showField", "demo.sub.sample-one"),
          permission("demo.sub.sample-one.show_field", "demo.sub.sample-one"),
        ],
      ),
    );
    expect(violations).toEqual([
      expect.stringContaining("模組 demo.SampleTwo"),
      expect.stringContaining("權限 demo.SampleTwo.*"),
      expect.stringContaining("demo.sub.sample-one.showField"),
      expect.stringContaining("demo.sub.sample-one.show_field"),
    ]);
  });

  it("權限 key = 擁有模組 key + 「.」+ 動作,動作恆為單段", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        ...demoWildcards,
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
    const extra = [
      moduleNode("demo.sub.sample-one.view", "hidden", "demo.sub.sample-one"),
      moduleNode("demo.list-page", "link", "demo"),
    ];
    const violations = findSeedKeyViolations(
      registryOf(
        [...demoTree, ...extra],
        [
          ...demoWildcards,
          ...extra.map((node) => permission(`${node.key}.*`, node.key)),
        ],
      ),
    );
    expect(violations).toEqual([
      expect.stringContaining("demo.sub.sample-one.view"),
      expect.stringContaining("demo.list-page"),
    ]);
  });

  it("隱藏的 api 模組子樹整體豁免 -page 規則(不是頁面,ADR-0004「API 權限」)", () => {
    const apiTree = [
      moduleNode("api", "hidden"),
      moduleNode("api.export", "hidden", "api"),
    ];
    const violations = findSeedKeyViolations(
      registryOf(
        apiTree,
        apiTree.map((node) => permission(`${node.key}.*`, node.key)),
      ),
    );
    expect(violations).toEqual([]);
  });

  it("子模組 key 必須以父模組 key + 「.」為前綴(D1:key 累加父 key)", () => {
    const orphanNaming = moduleNode("org-manager", "link", "demo");
    const violations = findSeedKeyViolations(
      registryOf(
        [...demoTree, orphanNaming],
        [...demoWildcards, permission("org-manager.*", "org-manager")],
      ),
    );
    expect(violations).toEqual([expect.stringContaining("org-manager")]);
  });

  it("每個模組必有且只有一筆 wildcard `<key>.*`", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        ...demoWildcards.filter((entry) => entry.key !== "demo.sub.*"),
        permission("demo.*", "demo"),
      ]),
    );
    expect(violations).toEqual([
      expect.stringContaining("權限 demo.*:key 重複宣告"),
      expect.stringContaining("模組 demo:必有且只有一筆"),
      expect.stringContaining("模組 demo.sub:必有且只有一筆"),
    ]);
  });

  it("權限動作禁用 -page 結尾(模組 key 與權限 key 永不同字串)", () => {
    const violations = findSeedKeyViolations(
      registryOf(demoTree, [
        ...demoWildcards,
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
          ...demoWildcards,
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
        [
          permission("demo.sub.*", "demo.sub"),
          permission("demo.*", "demo"),
          permission("nowhere.view", "nowhere"),
        ],
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

  it("示範家族依正本落地:10 個模組節點、12 筆個別權限;全部 18 個模組各一筆 wildcard(共 30 筆)", () => {
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

    // 正本:兩份權限表的個別權限(7 + 5);權限只種示範家族(#29 留言定案)
    const individualKeys = permissionKeys.filter((key) => !key.endsWith(".*"));
    expect(individualKeys).toHaveLength(12);
    expect(new Set(individualKeys)).toEqual(
      new Set([
        "demo.sub.sample-one.view",
        "demo.sub.sample-one.create",
        "demo.sub.sample-one.edit",
        "demo.sub.sample-one.delete",
        "demo.sub.sample-one.show-internal-note",
        "demo.sub.sample-one.edit-internal-note",
        "demo.sub.sample-one.create-page.show-tips",
        "demo.sub.sample-one.edit-page.show-history",
        "demo.sample-two.view",
        "demo.sample-two.create",
        "demo.sample-two.edit",
        "demo.sample-two.delete",
      ]),
    );

    // 每個模組各一筆 `<key>.*`(D3:wildcard 只代表該模組自己這一層)
    expect(moduleKeys).toHaveLength(18);
    expect(new Set(permissionKeys.filter((key) => key.endsWith(".*")))).toEqual(
      new Set(moduleKeys.map((key) => `${key}.*`)),
    );
    expect(permissionKeys).toHaveLength(30);

    // D1:治理模組 key 累加 system 群組前綴
    expect(moduleKeys.filter((key) => key.startsWith("system"))).toEqual([
      "system",
      "system.org-manager",
      "system.user-manager",
      "system.role-manager",
      "system.module-manager",
      "system.field-manager",
      "system.data-scope",
    ]);
  });
});
