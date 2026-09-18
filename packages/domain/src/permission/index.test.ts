import { describe, expect, it } from "@jest/globals";

import {
  WILDCARD_ACTION,
  hasPermission,
  ownerModuleKey,
  permissionAction,
  splitPermissionKey,
  wildcardKeyOf,
} from ".";

describe("@repo/domain/permission:權限 key 切分(ADR-0004:最後一段 = 動作,其餘 = 擁有模組 key)", () => {
  it("splitPermissionKey:多層模組 key 只切最後一段", () => {
    expect(
      splitPermissionKey("demo.sub.sample-one.edit-page.show-history"),
    ).toEqual({
      moduleKey: "demo.sub.sample-one.edit-page",
      action: "show-history",
    });
    expect(splitPermissionKey("system.user-manager.edit")).toEqual({
      moduleKey: "system.user-manager",
      action: "edit",
    });
  });

  it("ownerModuleKey / permissionAction 是切分的兩半;wildcard 的動作是 `*`", () => {
    expect(ownerModuleKey("demo.sub.sample-one.*")).toBe("demo.sub.sample-one");
    expect(permissionAction("demo.sub.sample-one.*")).toBe(WILDCARD_ACTION);
  });

  it("沒有「.」的字串不是合法權限 key(權限必屬某模組)→ 拋錯", () => {
    expect(() => splitPermissionKey("edit")).toThrow(/permission key/i);
    expect(() => splitPermissionKey("")).toThrow(/permission key/i);
  });

  it("wildcardKeyOf:模組 key + `.*`", () => {
    expect(wildcardKeyOf("demo.sub.sample-one")).toBe("demo.sub.sample-one.*");
  });
});

describe("@repo/domain/permission:hasPermission(ADR-0011:key 在集合中,或擁有模組 key + `.*` 在集合中;一次查表)", () => {
  it("精確持有 → 放行", () => {
    const granted = new Set(["demo.sub.sample-one.edit"]);
    expect(hasPermission(granted, "demo.sub.sample-one.edit")).toBe(true);
    expect(hasPermission(granted, "demo.sub.sample-one.delete")).toBe(false);
  });

  it("持有擁有模組的 `*` → 該層任何動作(含未來新增)放行", () => {
    const granted = new Set(["demo.sub.sample-one.*"]);
    expect(hasPermission(granted, "demo.sub.sample-one.edit")).toBe(true);
    expect(hasPermission(granted, "demo.sub.sample-one.not-yet-seeded")).toBe(
      true,
    );
  });

  it("wildcard 同層語意:父模組的 `*` 不涵蓋子模組的權限;子模組的 `*` 也不往上", () => {
    const parentWildcard = new Set(["demo.sub.*"]);
    expect(
      hasPermission(parentWildcard, "demo.sub.sample-one.edit"),
    ).toBe(false);
    expect(
      hasPermission(
        new Set(["demo.sub.sample-one.*"]),
        "demo.sub.sample-one.edit-page.show-history",
      ),
    ).toBe(false);
    expect(
      hasPermission(new Set(["demo.sub.sample-one.edit-page.*"]), "demo.sub.sample-one.edit"),
    ).toBe(false);
  });

  it("空集合一律不放行", () => {
    expect(hasPermission(new Set(), "demo.sub.sample-one.view")).toBe(false);
  });
});
