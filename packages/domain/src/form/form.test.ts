import { describe, expect, it } from "@jest/globals";

import {
  fieldProtections,
  isProtected,
  requiredShowFieldsFor,
} from "./dependencies";
import { field } from "./form-test-support";
import {
  RESERVED_FIELD_KEYS,
  checkFieldKey,
  isValidFormKey,
  isValidOrgSlug,
} from "./keys";
import { resolveLayout, spanFor } from "./layout";
import { computeSummary } from "./summary";

describe("@repo/domain/form key 規則", () => {
  it("表單 key:小寫開頭、只允許小寫數字底線、最長 40;不准 - 與 .", () => {
    expect(isValidFormKey("sick_leave_good_food")).toBe(true);
    expect(isValidFormKey("a".repeat(40))).toBe(true);
    expect(isValidFormKey("a".repeat(41))).toBe(false);
    expect(isValidFormKey("sick-leave")).toBe(false);
    expect(isValidFormKey("sick.leave")).toBe(false);
    expect(isValidFormKey("1leave")).toBe(false);
  });

  it("欄位 key:保留字與格式不符分得開", () => {
    expect(RESERVED_FIELD_KEYS).toHaveLength(11);
    expect(checkFieldKey("internal_amount")).toEqual({ valid: true });
    expect(checkFieldKey("status")).toEqual({
      valid: false,
      reason: "reserved",
    });
    expect(checkFieldKey("tenantId")).toEqual({
      valid: false,
      reason: "reserved",
    });
    expect(checkFieldKey("Amount")).toEqual({ valid: false, reason: "format" });
  });

  it("租戶短碼:2–20 字", () => {
    expect(isValidOrgSlug("good_food")).toBe(true);
    expect(isValidOrgSlug("g")).toBe(false);
    expect(isValidOrgSlug("a".repeat(21))).toBe(false);
    expect(isValidOrgSlug("Good")).toBe(false);
    expect(isValidOrgSlug("good-food")).toBe(false);
  });
});

describe("@repo/domain/form 版面換算", () => {
  it("桌機照 span、平板 ×2 封頂 12、手機一律 12", () => {
    expect(spanFor(4, "desktop")).toBe(4);
    expect(spanFor(4, "tablet")).toBe(8);
    expect(spanFor(8, "tablet")).toBe(12);
    expect(spanFor(3, "mobile")).toBe(12);
  });

  it("resolveLayout 換整份版面,結構不變", () => {
    const layout = {
      sections: [
        {
          key: "basic",
          title: "基本",
          rows: [
            {
              cols: [
                { fieldKey: "a", span: 6 },
                { fieldKey: "b", span: 6 },
              ],
            },
          ],
        },
      ],
    };
    expect(resolveLayout(layout, "tablet").sections[0]?.rows[0]?.cols).toEqual([
      { fieldKey: "a", span: 12 },
      { fieldKey: "b", span: 12 },
    ]);
  });
});

describe("@repo/domain/form 摘要計算", () => {
  const fields = [
    field("kind", "select"),
    field("day", "date"),
    field("amount", "number", { precision: 2 }),
    field("note", "text"),
  ];

  it("title 對選項欄存 label;date / amount 讀存值", () => {
    expect(
      computeSummary(
        {
          fields,
          summaryMap: { title: "kind", date: "day", amount: "amount" },
        },
        { kind: "sick", day: "2026-03-01", amount: "120.50" },
        { submittedAt: "2026-03-02T00:00:00.000Z" },
      ),
    ).toEqual({ title: "病假", date: "2026-03-01", amount: "120.50" });
  });

  it("date 沒對欄位 = 送出時間;amount 沒對就不出現", () => {
    expect(
      computeSummary(
        { fields, summaryMap: { title: "note" } },
        { note: "買菜" },
        { submittedAt: "2026-03-02T00:00:00.000Z" },
      ),
    ).toEqual({ title: "買菜", date: "2026-03-02T00:00:00.000Z" });
  });
});

describe("@repo/domain/form 受保護依賴鏈", () => {
  const unitPrice = field("unit_price", "number", {
    permission: { show: true, edit: false },
  });
  const qty = field("qty", "number");
  const total = field("total", "number", {
    valueSource: {
      kind: "computed",
      expr: { "*": [{ var: "unit_price" }, { var: "qty" }] },
    },
  });
  const totalTax = (show: boolean) =>
    field("total_tax", "number", {
      valueSource: {
        kind: "computed",
        expr: { "*": [{ var: "total" }, "1.05"] },
      },
      permission: { show, edit: false },
    });

  it("unit_price 受保護 → total、total_tax 都因依賴而受保護", () => {
    const protections = fieldProtections([
      unitPrice,
      qty,
      total,
      totalTax(false),
    ]);
    expect(protections.get("qty")).toEqual({ self: false, via: [] });
    expect(isProtected(protections.get("qty"))).toBe(false);
    expect(protections.get("total")).toEqual({
      self: false,
      via: ["unit_price"],
    });
    expect(protections.get("total_tax")).toEqual({
      self: false,
      via: ["unit_price"],
    });
    expect(
      requiredShowFieldsFor(
        [unitPrice, qty, total, totalTax(false)],
        "total_tax",
      ),
    ).toEqual(["unit_price"]);
  });

  it("total_tax 自己也設 show → 兩個 show 都要", () => {
    const fields = [unitPrice, qty, total, totalTax(true)];
    expect(requiredShowFieldsFor(fields, "total_tax")).toEqual([
      "total_tax",
      "unit_price",
    ]);
    expect(requiredShowFieldsFor(fields, "qty")).toEqual([]);
  });

  it("公式只引用公開欄位、結果自設 show 的計算欄位只要自己的 show", () => {
    const secretTotal = field("secret_total", "number", {
      valueSource: { kind: "computed", expr: { var: "qty" } },
      permission: { show: true, edit: false },
    });
    expect(requiredShowFieldsFor([qty, secretTotal], "secret_total")).toEqual([
      "secret_total",
    ]);
  });
});
