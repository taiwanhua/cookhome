import { describe, expect, it } from "@jest/globals";

import { CTX, field } from "./form-test-support";
import type { FieldDef } from "./types";
import {
  isCalendarDate,
  normalizeFieldValue,
  validateFieldRules,
} from "./values";

function normalized(target: FieldDef, raw: unknown): unknown {
  const result = normalizeFieldValue(target, raw);
  if (!result.ok) {
    throw new Error(result.issue.message);
  }
  return result.value;
}

function ruleCode(target: FieldDef, value: unknown): string | null {
  return (
    validateFieldRules(target, value, {
      semantic: { [target.key]: value },
      ctx: CTX,
      fields: [target],
      stored: { [target.key]: value },
    })?.code ?? null
  );
}

describe("normalizeFieldValue:型別層(草稿也驗)", () => {
  it("空值一律收成 null(空字串、空陣列、undefined)", () => {
    expect(normalized(field("note", "text"), "")).toBeNull();
    expect(normalized(field("tags", "multiSelect"), [])).toBeNull();
    expect(normalized(field("qty", "number"), null)).toBeNull();
  });

  it("number 取到 precision 位的十進位字串;非數字 → TYPE_INVALID", () => {
    const price = field("price", "number", { precision: 2 });
    expect(normalized(price, 1.005)).toBe("1.01");
    expect(normalized(price, "12")).toBe("12.00");
    expect(normalizeFieldValue(price, "12a")).toMatchObject({
      ok: false,
      issue: { code: "TYPE_INVALID", fieldKey: "price" },
    });
  });

  it("date 只收存在的 YYYY-MM-DD", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(normalizeFieldValue(field("day", "date"), "2026/02/01").ok).toBe(
      false,
    );
  });

  it("靜態選項存 value;類別 / lookup 選項存 { value, label };allowCustom 打進來的標 custom", () => {
    expect(normalized(field("kind", "select"), "sick")).toBe("sick");
    expect(
      normalized(field("kind", "select"), { value: "sick", label: "病假" }),
    ).toBe("sick");
    const category = field("kind", "select", {
      options: { kind: "fieldCategory", key: "leave-type" },
    });
    expect(normalized(category, "sick")).toEqual({
      value: "sick",
      label: null,
    });
    expect(
      normalized(field("kind", "select"), { value: "x", custom: true }),
    ).toEqual({ value: "x", label: "x", custom: true });
  });

  it("reference 收 id 字串或 { id, label };upload 要完整的四欄", () => {
    expect(normalized(field("owner", "reference"), "u1")).toEqual({
      id: "u1",
      label: null,
    });
    expect(
      normalizeFieldValue(field("file", "upload"), { path: "form/a.png" }).ok,
    ).toBe(false);
  });
});

describe("validateFieldRules:完成資料所需的驗證", () => {
  it("必填空值 → REQUIRED;計算欄位算成 null → NOT_COMPUTABLE(「X 無法計算」)", () => {
    expect(
      ruleCode(field("note", "text", { rules: { required: true } }), null),
    ).toBe("REQUIRED");
    const total = field("total", "number", {
      valueSource: { kind: "computed", expr: { "*": [1, 2] } },
      rules: { required: true },
    });
    const issue = validateFieldRules(total, null, {
      semantic: {},
      ctx: CTX,
      fields: [total],
      stored: {},
    });
    expect(issue).toMatchObject({ code: "NOT_COMPUTABLE" });
    expect(issue?.message).toContain("無法計算");
  });

  it("number / date 的範圍、文字長度、正則(用 patternMessage)與內建格式", () => {
    expect(ruleCode(field("qty", "number", { rules: { min: 1 } }), "0")).toBe(
      "MIN",
    );
    expect(
      ruleCode(
        field("day", "date", { rules: { max: "2026-01-31" } }),
        "2026-02-01",
      ),
    ).toBe("MAX");
    expect(
      ruleCode(field("name", "text", { rules: { maxLength: 2 } }), "三個字"),
    ).toBe("MAX_LENGTH");
    const code = field("code", "text", {
      rules: { pattern: "^[A-Z]{3}$", patternMessage: "三個大寫字母" },
    });
    expect(
      validateFieldRules(code, "abc", {
        semantic: {},
        ctx: CTX,
        fields: [code],
        stored: {},
      })?.message,
    ).toBe("三個大寫字母");
    expect(
      ruleCode(field("mail", "text", { rules: { format: "email" } }), "a@b"),
    ).toBe("FORMAT");
    expect(
      ruleCode(field("mail", "text", { rules: { format: "email" } }), "a@b.co"),
    ).toBeNull();
  });

  it("rules.custom 回 false 即錯,看的是語意值", () => {
    const kind = field("kind", "select", {
      rules: { custom: { "==": [{ var: "kind" }, "sick"] } },
    });
    expect(ruleCode(kind, "annual")).toBe("CUSTOM");
    expect(ruleCode(kind, "sick")).toBeNull();
  });
});
