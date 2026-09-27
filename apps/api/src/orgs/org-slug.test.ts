import { describe, expect, it } from "@jest/globals";
import { GraphQLError } from "graphql";

import { slugConflictOr } from "./org-slug";

/**
 * 同時開通 / 改成同一個短碼:兩個請求都通過事前檢查,後寫的撞 `slug` 唯一索引(E11000)。
 * 形狀照 mongodb driver 的 `MongoServerError`(`code` + `keyPattern` / `keyValue`)。
 */
describe("slugConflictOr:slug 唯一索引衝突 → VALIDATION_FAILED(fields: slug)", () => {
  it("撞 slug 的 E11000 換成與事前檢查同一個錯誤", () => {
    const mapped = slugConflictOr({
      code: 11_000,
      keyPattern: { slug: 1 },
      keyValue: { slug: "tenant_a" },
    });
    expect(mapped).toBeInstanceOf(GraphQLError);
    expect((mapped as GraphQLError).extensions).toEqual({
      code: "VALIDATION_FAILED",
      fields: ["slug"],
    });
  });

  it("其他唯一索引的衝突、其他錯誤原樣回傳", () => {
    const otherIndex = { code: 11_000, keyPattern: { key: 1 } };
    const unrelated = new Error("boom");
    expect(slugConflictOr(otherIndex)).toBe(otherIndex);
    expect(slugConflictOr(unrelated)).toBe(unrelated);
    expect(slugConflictOr(null)).toBeNull();
  });
});
