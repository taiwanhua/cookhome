import { describe, expect, it } from "@jest/globals";

import {
  arrayField,
  column,
  computedColumn,
  computedNumber,
  rowIdOf,
} from "./array-test-support";
import { computeAll } from "./compute";
import { ComputedCycleError, requiredShowFieldsFor } from "./dependencies";
import { CTX, field } from "./form-test-support";
import type { FieldDef, StoredValues } from "./types";

const qty = column("qty", "number");
const price = column("price", "number", { precision: 2 });
const subtotal = computedColumn("subtotal", {
  "*": [{ var: "row.qty" }, { var: "row.price" }],
});
const items = arrayField("items", [qty, price, subtotal]);

function compute(
  fields: FieldDef[],
  values: StoredValues,
): Record<string, unknown> {
  return computeAll(fields, { values, ctx: CTX });
}

function rows(
  ...cells: { qty?: string | null; price?: string | null }[]
): StoredValues["items"] {
  return cells.map((cell, index) => ({
    rowId: rowIdOf(index + 1),
    qty: cell.qty ?? null,
    price: cell.price ?? null,
  }));
}

describe("明細列:列內公式", () => {
  it("每一列以 row.* 算自己的小計", () => {
    const result = compute([items], {
      items: rows({ qty: "2", price: "10.00" }, { qty: "3", price: "1.50" }),
    });
    expect(
      (result.items as { subtotal: unknown }[]).map((row) => row.subtotal),
    ).toEqual(["20", "5"]);
  });

  it("明細為 null 時列內公式不算、維持 null", () => {
    expect(compute([items], { items: null }).items).toBeNull();
  });
});

function withTotal(expr: FieldDef["visibleWhen"], precision = 0): FieldDef[] {
  return [items, computedNumber("total", expr ?? null, precision)];
}

describe("明細列:彙總", () => {
  it("sumOf 加總子欄、略過空值", () => {
    const result = compute(withTotal({ sumOf: ["items", "subtotal"] }), {
      items: rows({ qty: "2", price: "10.00" }, { qty: null, price: "3.00" }),
    });
    expect(result.total).toBe("20");
  });

  it("sumOf 全空為 0", () => {
    const result = compute(withTotal({ sumOf: ["items", "qty"] }), {
      items: rows({}, {}),
    });
    expect(result.total).toBe("0");
  });

  it("sumOf 明細為 null(隱藏)為 0", () => {
    const result = compute(withTotal({ sumOf: ["items", "qty"] }), {
      items: null,
    });
    expect(result.total).toBe("0");
  });

  it("countOf 是列數(空白列也算)", () => {
    const result = compute(withTotal({ countOf: ["items"] }), {
      items: rows({ qty: "1" }, {}),
    });
    expect(result.total).toBe("2");
  });

  it("countOf 增刪列即重算", () => {
    const fields = withTotal({ countOf: ["items"] });
    const before = compute(fields, { items: rows({ qty: "1" }) });
    const after = compute(fields, {
      items: rows({ qty: "1" }, { qty: "2" }, { qty: "3" }),
    });
    expect([before.total, after.total]).toEqual(["1", "3"]);
  });

  it("countOf 明細為 null 為 0", () => {
    const result = compute(withTotal({ countOf: ["items"] }), {
      items: null,
    });
    expect(result.total).toBe("0");
  });

  it("minOf / maxOf 取最小 / 最大,略過空值", () => {
    const values = { items: rows({ qty: "5" }, { qty: null }, { qty: "2" }) };
    const min = compute(withTotal({ minOf: ["items", "qty"] }), values);
    const max = compute(withTotal({ maxOf: ["items", "qty"] }), values);
    expect([min.total, max.total]).toEqual(["2", "5"]);
  });

  it("avgOf 的分母是有值的筆數", () => {
    const result = compute(withTotal({ avgOf: ["items", "qty"] }, 2), {
      items: rows({ qty: "3" }, { qty: null }, { qty: "4" }),
    });
    expect(result.total).toBe("3.50");
  });

  it("minOf / maxOf / avgOf 全空為 null", () => {
    const values = { items: rows({}, {}) };
    const results = (["minOf", "maxOf", "avgOf"] as const).map(
      (operator) =>
        compute(withTotal({ [operator]: ["items", "qty"] }), values).total,
    );
    expect(results).toEqual([null, null, null]);
  });
});

describe("明細列:依賴圖與取位", () => {
  it("跨層順序:discountRate → items.subtotal → total", () => {
    const discountRate = field("discount_rate", "number", { precision: 2 });
    const discounted = arrayField("items", [
      qty,
      computedColumn("subtotal", {
        "*": [{ var: "row.qty" }, { var: "discount_rate" }],
      }),
    ]);
    const total = computedNumber("total", { sumOf: ["items", "subtotal"] });
    // 故意把 total 排在最前面:順序靠依賴圖,不靠欄位順序
    const result = compute([total, discounted, discountRate], {
      discount_rate: "0.50",
      items: [
        { rowId: rowIdOf(1), qty: "4" },
        { rowId: rowIdOf(2), qty: "6" },
      ],
    });
    expect(result.total).toBe("5");
  });

  it("取位邊界:總額 = 各列取位後的小計相加", () => {
    const half = arrayField("items", [
      qty,
      computedColumn("subtotal", { "*": [{ var: "row.qty" }, 0.4] }),
    ]);
    const total = computedNumber("total", { sumOf: ["items", "subtotal"] });
    // 每列 1 × 0.4 = 0.4 → 取位 0;不取位相加會是 1.2 → 1
    const result = compute([half, total], {
      items: [
        { rowId: rowIdOf(1), qty: "1" },
        { rowId: rowIdOf(2), qty: "1" },
        { rowId: rowIdOf(3), qty: "1" },
      ],
    });
    expect(result.total).toBe("0");
  });

  it("循環:total = sumOf(items, subtotal) 且 subtotal = row.qty × total", () => {
    const cyclic = arrayField("items", [
      qty,
      computedColumn("subtotal", {
        "*": [{ var: "row.qty" }, { var: "total" }],
      }),
    ]);
    const total = computedNumber("total", { sumOf: ["items", "subtotal"] });
    expect(() =>
      compute([cyclic, total], { items: rows({ qty: "1" }) }),
    ).toThrow(ComputedCycleError);
  });
});

describe("明細列:整欄保護傳遞", () => {
  const secret = field("unit_cost", "number", {
    permission: { show: true, edit: false },
  });
  const costed = arrayField("items", [
    qty,
    computedColumn("cost", { "*": [{ var: "row.qty" }, { var: "unit_cost" }] }),
  ]);

  it("子欄引用受保護欄位 → 整個明細欄要那個欄位的 show", () => {
    expect(requiredShowFieldsFor([secret, costed], "items")).toEqual([
      "unit_cost",
    ]);
  });

  it("彙總引用受保護明細的計算欄位同樣受保護", () => {
    const total = computedNumber("total", { sumOf: ["items", "cost"] });
    expect(requiredShowFieldsFor([secret, costed, total], "total")).toEqual([
      "unit_cost",
    ]);
  });

  it("明細欄自己設 show → 彙總它的計算欄位要明細欄的 show", () => {
    const shown = arrayField("items", [qty], {
      permission: { show: true, edit: false },
    });
    const total = computedNumber("total", { countOf: ["items"] });
    expect(requiredShowFieldsFor([shown, total], "total")).toEqual(["items"]);
  });
});
