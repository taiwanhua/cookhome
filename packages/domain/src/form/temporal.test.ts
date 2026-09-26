import { describe, expect, it } from "@jest/globals";

import { recheckRegexSafety } from "../form-regex-safety";
import { computeAll } from "./compute";
import { evaluateCondition, evaluateExpression } from "./expression";
import { CTX, definitionOf, field } from "./form-test-support";
import { computeSummary } from "./summary";
import {
  fromZonedWallTime,
  normalizeDateTime,
  toZonedWallTime,
  zonedMidnightOf,
} from "./temporal";
import type { Expression } from "./types";
import { validateDefinition } from "./validate-definition";
import { normalizeFieldValue, validateFieldRules } from "./values";

const evaluate = (expr: Expression, values: Record<string, unknown> = {}) =>
  evaluateExpression(expr, { values, ctx: CTX });

describe("@repo/domain/form datetime:正規化(ISO 8601 UTC)", () => {
  const meeting = field("meeting", "datetime");

  it("帶時區的輸入一律存成 UTC、秒以下捨去", () => {
    expect(normalizeFieldValue(meeting, "2026-03-01T09:30+08:00")).toEqual({
      ok: true,
      value: "2026-03-01T01:30:00Z",
    });
    expect(normalizeFieldValue(meeting, "2026-03-01T01:30:15.987Z")).toEqual({
      ok: true,
      value: "2026-03-01T01:30:15Z",
    });
    expect(normalizeFieldValue(meeting, "")).toEqual({ ok: true, value: null });
  });

  it("沒有時區、只有日期、不存在的時間 → TYPE_INVALID", () => {
    for (const raw of [
      "2026-03-01T09:30",
      "2026-03-01",
      "2026-13-01T00:00:00Z",
      1_700_000_000_000,
    ]) {
      const result = normalizeFieldValue(meeting, raw);
      expect(result.ok).toBe(false);
    }
  });

  it("上下限(min / max)以時點比較", () => {
    const limited = field("meeting", "datetime", {
      rules: { min: "2026-03-01T00:00:00Z", max: "2026-03-31T23:59:59+08:00" },
    });
    const ruleOf = (value: string) =>
      validateFieldRules(limited, value, {
        semantic: {},
        ctx: CTX,
        fields: [limited],
        stored: {},
      })?.code ?? null;
    expect(ruleOf("2026-02-28T23:59:59Z")).toBe("MIN");
    expect(ruleOf("2026-03-31T15:59:59Z")).toBeNull();
    expect(ruleOf("2026-03-31T16:00:00Z")).toBe("MAX");
  });

  it("超出上下限的訊息以租戶時區顯示;上下限格式不合法 → 檢查器 RULE_RANGE_INVALID", () => {
    const limited = field("meeting", "datetime", {
      rules: { min: "2026-03-01T00:00:00Z" },
    });
    expect(
      validateFieldRules(limited, "2026-02-28T00:00:00Z", {
        semantic: {},
        ctx: CTX,
        fields: [limited],
        stored: {},
      })?.message,
    ).toBe("「meeting」不可早於 2026-03-01 08:00(Asia/Taipei)");
    const report = validateDefinition(
      definitionOf([
        field("title", "text"),
        field("meeting", "datetime", {
          rules: { min: "2026-03-01 09:00", max: "2026-03-31T23:59+08:00" },
        }),
      ]),
      { regexSafety: recheckRegexSafety },
    );
    expect(
      report.errors.map((issue) => [issue.code, issue.location.property]),
    ).toEqual([["RULE_RANGE_INVALID", "rules.min"]]);
  });

  it("租戶時區的牆上時間 ↔ 存值(台北 +08:00;無效回 null)", () => {
    expect(fromZonedWallTime("2026-03-01T09:30", "Asia/Taipei")).toBe(
      "2026-03-01T01:30:00Z",
    );
    expect(toZonedWallTime("2026-03-01T01:30:00Z", "Asia/Taipei")).toBe(
      "2026-03-01T09:30",
    );
    expect(zonedMidnightOf("2026-03-01", "Asia/Taipei")).toBe(
      Date.parse("2026-02-28T16:00:00Z"),
    );
    expect(fromZonedWallTime("nope", "Asia/Taipei")).toBeNull();
    expect(normalizeDateTime("2026-03-01T09:30")).toBeNull();
  });
});

describe("@repo/domain/form datetime:比較與計算", () => {
  it("比較以時點:同一刻不同寫法相等、帶毫秒的 now 與存值可比大小", () => {
    expect(
      evaluateCondition(
        { "==": [{ var: "at" }, "2026-03-01T09:00:00+08:00"] },
        { values: { at: "2026-03-01T01:00:00Z" }, ctx: CTX },
      ),
    ).toBe(true);
    // CTX.now = 2026-03-01T01:00:00.000Z
    expect(
      evaluateCondition(
        { "<=": [{ var: "at" }, { now: [] }] },
        { values: { at: "2026-03-01T01:00:00Z" }, ctx: CTX },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { ">": [{ var: "at" }, { now: [] }] },
        { values: { at: "2026-03-01T01:00:01Z" }, ctx: CTX },
      ),
    ).toBe(true);
  });

  it("計算欄位回 now:存成 UTC 秒;日期結果視為租戶時區當天 00:00", () => {
    const stamped = field("stamped", "datetime", {
      valueSource: { kind: "computed", expr: { now: [] } },
    });
    const dayStart = field("day_start", "datetime", {
      valueSource: { kind: "computed", expr: "2026-03-05" },
    });
    expect(computeAll([stamped, dayStart], { values: {}, ctx: CTX })).toEqual({
      stamped: "2026-03-01T01:00:00Z",
      day_start: "2026-03-04T16:00:00Z",
    });
  });

  it("摘要槽 date 對日期時間欄時存 ISO 時間", () => {
    const at = field("at", "datetime");
    expect(
      computeSummary(
        { fields: [at], summaryMap: { date: "at" } },
        { at: "2026-03-01T01:00:00Z" },
        { submittedAt: "2026-04-01T00:00:00.000Z" },
      ).date,
    ).toBe("2026-03-01T01:00:00Z");
  });
});

describe("@repo/domain/form dateDiff 三種單位", () => {
  it("days(預設):租戶時區的日曆日 —— 台北 3/1 23:30 到 3/2 00:10 = 1 天", () => {
    const values = {
      from: "2026-03-01T15:30:00Z",
      to: "2026-03-01T16:10:00Z",
    };
    expect(
      evaluate({ dateDiff: [{ var: "from" }, { var: "to" }] }, values),
    ).toBe("1");
    expect(
      evaluate({ dateDiff: [{ var: "from" }, { var: "to" }, "days"] }, values),
    ).toBe("1");
  });

  it("hours:精確時間差,可有小數(90 分鐘 = 1.5 小時)", () => {
    expect(
      evaluate({
        dateDiff: ["2026-03-01T01:00:00Z", "2026-03-01T02:30:00Z", "hours"],
      }),
    ).toBe("1.5");
  });

  it("minutes:日期視為租戶時區當天 00:00(台北 3/2 00:00 → 3/2 01:15 = 75 分)", () => {
    expect(
      evaluate({
        dateDiff: ["2026-03-02", "2026-03-01T17:15:00Z", "minutes"],
      }),
    ).toBe("75");
  });

  it("認不得的單位或無效值 → null", () => {
    expect(
      evaluate({
        dateDiff: ["2026-03-01T01:00:00Z", "2026-03-01T02:00:00Z", "weeks"],
      }),
    ).toBeNull();
    expect(
      evaluate({ dateDiff: [null, "2026-03-01T02:00:00Z", "hours"] }),
    ).toBeNull();
  });
});
