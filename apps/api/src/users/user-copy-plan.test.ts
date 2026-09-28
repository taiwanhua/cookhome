import { describe, expect, it } from "@jest/globals";

import { CopyUserOrgRolesMode } from "./models/copy-user-org-roles.model";
import { planCopySet } from "./user-copy-plan";

/** 管理範圍 = 只有 m1 / m2 / m3(t-out 在範圍外)。 */
const isManaged = (id: string) => ["m1", "m2", "m3"].includes(id);

describe("planCopySet(複製組織與角色的集合運算)", () => {
  it("合併:final = T ∪ S,不移除任何東西", () => {
    const plan = planCopySet(
      CopyUserOrgRolesMode.MERGE,
      ["m1", "t-out"],
      ["m2"],
      isManaged,
    );

    expect(plan).toEqual({
      added: ["m2"],
      removed: [],
      kept: ["m1"],
      final: ["m1", "t-out", "m2"],
    });
  });

  it("取代:final = (T − M) ∪ S,範圍外的目標留著且不列進 kept", () => {
    const plan = planCopySet(
      CopyUserOrgRolesMode.REPLACE,
      ["m1", "m2", "t-out"],
      ["m2", "m3"],
      isManaged,
    );

    expect(plan).toEqual({
      added: ["m3"],
      removed: ["m1"],
      kept: ["m2"],
      final: ["m2", "t-out", "m3"],
    });
  });

  it("取代且管理範圍是全部:目標完全變成來源", () => {
    const plan = planCopySet(
      CopyUserOrgRolesMode.REPLACE,
      ["a", "b"],
      ["c"],
      () => true,
    );

    expect(plan).toEqual({
      added: ["c"],
      removed: ["a", "b"],
      kept: [],
      final: ["c"],
    });
  });

  it("重複的 id 去重:同一個 id 只出現一次", () => {
    const plan = planCopySet(
      CopyUserOrgRolesMode.MERGE,
      ["m1", "m1"],
      ["m1", "m2", "m2"],
      isManaged,
    );

    expect(plan).toEqual({
      added: ["m2"],
      removed: [],
      kept: ["m1"],
      final: ["m1", "m2"],
    });
  });
});
