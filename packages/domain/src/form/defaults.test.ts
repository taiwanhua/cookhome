import { describe, expect, it } from "@jest/globals";

import { recheckRegexSafety } from "../form-regex-safety";
import { applyDefaults, defaultValueOf } from "./defaults";
import { CTX, definitionOf, field } from "./form-test-support";
import type { DefinitionIssueCode } from "./issues";
import type { FieldDef } from "./types";
import { validateDefinition } from "./validate-definition";

const title = field("title", "text");

const codesOf = (fields: FieldDef[]): DefinitionIssueCode[] =>
  validateDefinition(definitionOf([title, ...fields]), {
    regexSafety: recheckRegexSafety,
  }).errors.map((issue) => issue.code);

/** 引用欄 + 預設值公式。 */
const reference = (expr: FieldDef["visibleWhen"]) =>
  field("who", "reference", {
    source: { provider: "user", labelField: "name" },
    default: { kind: "expression", expr: expr ?? null },
  });

describe("@repo/domain/form 預設值:計算", () => {
  const qty = field("qty", "number", {
    default: { kind: "constant", value: 2 },
  });
  const price = field("price", "number", { precision: 1 });
  const total = field("budget", "number", {
    precision: 1,
    default: {
      kind: "expression",
      expr: { "*": [{ var: "qty" }, { var: "price" }] },
    },
  });
  const applicant = field("applicant", "reference", {
    source: { provider: "user", labelField: "name" },
    default: { kind: "expression", expr: { var: "ctx.user.id" } },
  });
  const due = field("due", "date", {
    default: { kind: "expression", expr: { now: [] } },
  });
  const fields = [total, qty, price, applicant, due];

  it("常數照型別收斂;公式依序算(後面的公式看得到前面的預設值);系統值填寫者 → { id, label: null }", () => {
    expect(
      applyDefaults(fields, { price: "1.5" }, CTX, { mode: "fill-empty" }),
    ).toEqual({
      price: "1.5",
      qty: "2",
      budget: "3.0",
      applicant: { id: "user-1", label: null },
      // CTX.now = 台北 3/1 09:00
      due: "2026-03-01",
    });
  });

  it("fill-empty 不覆蓋送來的值;touched 的欄位不動", () => {
    const result = applyDefaults(fields, { qty: "5", price: "2" }, CTX, {
      mode: "fill-empty",
      touched: ["budget"],
    });
    expect(result.qty).toBe("5");
    expect(result.budget).toBeUndefined();
  });

  it("recompute:沒碰過的欄位依目前的值重算(覆蓋上一次的預設值)", () => {
    const first = applyDefaults(fields, { price: "1" }, CTX, {
      mode: "recompute",
    });
    expect(first.budget).toBe("2.0");
    const changed = applyDefaults(fields, { ...first, price: "4" }, CTX, {
      mode: "recompute",
    });
    expect(changed.budget).toBe("8.0");
    const touched = applyDefaults(
      fields,
      { ...first, price: "4", budget: "1.0" },
      CTX,
      { mode: "recompute", touched: ["budget"] },
    );
    expect(touched.budget).toBe("1.0");
  });

  it("沒有預設值 / 不是使用者填的欄位 → undefined", () => {
    expect(defaultValueOf(price, fields, {}, CTX)).toBeUndefined();
    const computed = field("c", "number", {
      valueSource: { kind: "computed", expr: 1 },
      default: { kind: "constant", value: 3 },
    });
    expect(defaultValueOf(computed, [computed], {}, CTX)).toBeUndefined();
  });
});

describe("@repo/domain/form 預設值:檢查器每種錯誤", () => {
  it("DEFAULT_NOT_ALLOWED:計算欄位 / 上傳欄設了預設值", () => {
    expect(
      codesOf([
        field("c", "number", {
          valueSource: { kind: "computed", expr: 1 },
          default: { kind: "constant", value: 1 },
        }),
      ]),
    ).toEqual(["DEFAULT_NOT_ALLOWED"]);
    expect(
      codesOf([
        field("proof", "upload", {
          default: { kind: "constant", value: null },
        }),
      ]),
    ).toEqual(["DEFAULT_NOT_ALLOWED"]);
  });

  it("DEFAULT_KIND_INVALID:單選用公式、引用用固定值", () => {
    expect(
      codesOf([
        field("kind", "select", {
          default: { kind: "expression", expr: "sick" },
        }),
        field("who", "reference", {
          source: { provider: "user", labelField: "name" },
          default: { kind: "constant", value: "user-1" },
        }),
      ]),
    ).toEqual(["DEFAULT_KIND_INVALID", "DEFAULT_KIND_INVALID"]);
  });

  it("DEFAULT_VALUE_INVALID:常數型別不對、單選 / 多選的值不在選項內", () => {
    expect(
      codesOf([
        field("qty", "number", { default: { kind: "constant", value: "abc" } }),
        field("kind", "select", {
          default: { kind: "constant", value: "unknown" },
        }),
        field("kinds", "multiSelect", {
          default: { kind: "constant", value: ["sick", "nope"] },
        }),
      ]),
    ).toEqual([
      "DEFAULT_VALUE_INVALID",
      "DEFAULT_VALUE_INVALID",
      "DEFAULT_VALUE_INVALID",
    ]);
    expect(
      codesOf([
        field("kinds", "multiSelect", {
          default: { kind: "constant", value: ["sick", "annual"] },
        }),
      ]),
    ).toEqual([]);
  });

  it("DEFAULT_SELF:預設值公式引用自己", () => {
    expect(
      codesOf([
        field("qty", "number", {
          default: { kind: "expression", expr: { "+": [{ var: "qty" }, 1] } },
        }),
      ]),
    ).toEqual(["DEFAULT_SELF"]);
  });

  it("DEFAULT_REFERENCE_INVALID:引用欄只能用填寫者 / 填寫者的組織", () => {
    expect(codesOf([reference({ var: "ctx.timezone" })])).toEqual([
      "DEFAULT_REFERENCE_INVALID",
    ]);
    expect(codesOf([reference({ var: "ctx.user.orgId" })])).toEqual([]);
  });

  it("EXPR_TYPE_MISMATCH(default.expr):公式根型別要等於欄位型別", () => {
    const report = validateDefinition(
      definitionOf([
        title,
        field("qty", "number", {
          default: { kind: "expression", expr: { concat: ["a", "b"] } },
        }),
      ]),
      { regexSafety: recheckRegexSafety },
    );
    expect(report.errors).toEqual([
      expect.objectContaining({
        code: "EXPR_TYPE_MISMATCH",
        location: {
          fieldKey: "qty",
          exprSlot: "default.expr",
          exprPath: "concat",
        },
      }),
    ]);
  });

  it("EXPR_CYCLE:兩個欄位的預設值互相引用", () => {
    expect(
      codesOf([
        field("a", "number", {
          default: { kind: "expression", expr: { var: "b" } },
        }),
        field("b", "number", {
          default: { kind: "expression", expr: { var: "a" } },
        }),
      ]),
    ).toEqual(["EXPR_CYCLE"]);
  });
});
