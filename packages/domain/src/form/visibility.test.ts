import { describe, expect, it } from "@jest/globals";

import {
  arrayField,
  column,
  computedColumn,
  computedNumber,
  rowIdOf,
} from "./array-test-support";
import { CTX, field } from "./form-test-support";
import type { FieldDef, StoredValues } from "./types";
import { settleHidden } from "./visibility";

const withItems = field("with_items", "boolean");
const items = arrayField(
  "items",
  [
    column("qty", "number"),
    column("price", "number"),
    computedColumn("subtotal", {
      "*": [{ var: "row.qty" }, { var: "row.price" }],
    }),
  ],
  { visibleWhen: { "==": [{ var: "with_items" }, true] } },
);
const total = computedNumber("total", { sumOf: ["items", "subtotal"] });
const count = computedNumber("count", { countOf: ["items"] });

const lines = [
  { rowId: rowIdOf(1), qty: "2", price: "30" },
  { rowId: rowIdOf(2), qty: "1", price: "15" },
];

const settle = (fields: FieldDef[], values: StoredValues) =>
  settleHidden(fields, { values, ctx: CTX });

describe("settleHidden:隱藏的欄位當 null 算", () => {
  it("明細顯示時,彙總照各列算", () => {
    const { hidden, values } = settle([withItems, items, total, count], {
      with_items: true,
      items: lines,
    });

    expect([...hidden]).toEqual([]);
    expect(values.total).toBe("75");
    expect(values.count).toBe("2");
  });

  it("明細被隱藏 → 整欄 null、彙總視為空(sumOf 0、countOf 0),傳入的值不動", () => {
    const input = { with_items: false, items: lines };

    const { hidden, values } = settle([withItems, items, total, count], input);

    expect([...hidden]).toEqual(["items"]);
    expect(values.items).toBeNull();
    expect(values.total).toBe("0");
    expect(values.count).toBe("0");
    expect(input.items).toBe(lines);
  });

  it("被引用的一般欄位隱藏 → 公式讀到 null", () => {
    const hasDiscount = field("has_discount", "boolean");
    const discount = field("discount", "number", {
      visibleWhen: { "==": [{ var: "has_discount" }, true] },
    });
    const price = field("price", "number");
    const net = computedNumber("net", {
      "-": [{ var: "price" }, { var: "discount" }],
    });

    const { values } = settle([hasDiscount, discount, price, net], {
      has_discount: false,
      discount: "30",
      price: "100",
    });

    expect(values.discount).toBeNull();
    expect(values.net).toBeNull();
  });

  it("隱藏的計算欄位本身 null,下游也讀到 null", () => {
    const qty = field("qty", "number");
    const doubled: FieldDef = {
      ...computedNumber("doubled", { "*": [{ var: "qty" }, 2] }),
      visibleWhen: { ">": [{ var: "qty" }, 10] },
    };
    const plusOne = computedNumber("plus_one", {
      "+": [{ var: "doubled" }, 1],
    });

    const { values } = settle([qty, doubled, plusOne], { qty: "3" });

    expect(values.doubled).toBeNull();
    expect(values.plus_one).toBeNull();
  });

  it("條件引用受隱藏影響的計算欄位:收斂到穩定的隱藏集合", () => {
    // 明細隱藏 → 總額 0 → 「大額說明」跟著隱藏(第一輪還以明細算出 75 而顯示)
    const bigNote = field("big_note", "text", {
      visibleWhen: { ">": [{ var: "total" }, 50] },
    });

    const shown = settle([withItems, items, total, bigNote], {
      with_items: true,
      items: lines,
      big_note: "說明",
    });
    const collapsed = settle([withItems, items, total, bigNote], {
      with_items: false,
      items: lines,
      big_note: "說明",
    });

    expect(shown.values.big_note).toBe("說明");
    expect(collapsed.hidden).toEqual(new Set(["items", "big_note"]));
    expect(collapsed.values.big_note).toBeNull();
  });
});
