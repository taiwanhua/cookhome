import { describe, expect, it } from "@jest/globals";

import {
  arrayField,
  column,
  computedColumn,
  computedNumber,
  rowIdOf,
} from "./array-test-support";
import { field } from "./form-test-support";
import { upgradeFillTargets, upgradeValues } from "./upgrade";

const title = field("title", "text");
const amount = field("amount", "number");
const leaveType = field("leave_type", "select");

describe("upgradeValues:搬值", () => {
  it("同 key 同型別的使用者填欄位保留值", () => {
    const upgraded = upgradeValues(
      { fields: [title] },
      { fields: [title] },
      { title: "出差" },
    );

    expect(upgraded).toEqual({ title: "出差" });
  });

  it("目標版沒有的欄位丟掉", () => {
    const upgraded = upgradeValues(
      { fields: [title, amount] },
      { fields: [title] },
      { title: "出差", amount: "3" },
    );

    expect(upgraded).toEqual({ title: "出差" });
  });

  it("同 key 但型別變了的欄位不搬", () => {
    const upgraded = upgradeValues(
      { fields: [field("amount", "text")] },
      { fields: [amount] },
      { amount: "三" },
    );

    expect(upgraded).toEqual({});
  });

  it("目標版是計算欄位的不搬(由呼叫端重算)", () => {
    const upgraded = upgradeValues(
      { fields: [amount] },
      { fields: [computedNumber("amount", 1)] },
      { amount: "3" },
    );

    expect(upgraded).toEqual({});
  });

  it("明細列逐子欄:只留目標仍有、同型別、使用者填的子欄,rowId 保留", () => {
    const from = arrayField("items", [
      column("qty", "number"),
      column("note", "text"),
      column("price", "number"),
    ]);
    const to = arrayField("items", [
      column("qty", "number"),
      column("note", "number"),
      computedColumn("price", { var: "row.qty" }),
      column("added", "text"),
    ]);

    const upgraded = upgradeValues(
      { fields: [from] },
      { fields: [to] },
      {
        items: [{ rowId: rowIdOf(1), qty: "2", note: "a", price: "9" }],
      },
    );

    expect(upgraded).toEqual({ items: [{ rowId: rowIdOf(1), qty: "2" }] });
  });

  it("補值只填搬完後沒有值的欄位,已有值不覆蓋", () => {
    const upgraded = upgradeValues(
      { fields: [title] },
      { fields: [title, leaveType] },
      { title: "出差" },
      { title: "覆蓋", leave_type: "sick" },
    );

    expect(upgraded).toEqual({ title: "出差", leave_type: "sick" });
  });

  it("補值不填計算欄位與目標版沒有的鍵", () => {
    const upgraded = upgradeValues(
      { fields: [] },
      { fields: [computedNumber("total", 1)] },
      {},
      { total: "5", ghost: "x" },
    );

    expect(upgraded).toEqual({});
  });
});

describe("upgradeFillTargets:補值欄位", () => {
  it("列出必填、對到摘要槽、目標版新增的使用者填欄位", () => {
    const required = field("reason", "text", { rules: { required: true } });
    const summaryDate = field("start", "date");
    const added = field("added", "boolean");
    const plain = field("note", "text");
    const to = {
      fields: [required, summaryDate, added, plain],
      summaryMap: { title: null, date: "start" },
    };
    const from = { fields: [required, summaryDate, plain] };

    const keys = upgradeFillTargets(to, [from]).map((target) => target.key);

    expect(keys).toEqual(["reason", "start", "added"]);
  });

  it("任一個來源版沒有同型別的欄位就算新增", () => {
    const note = field("note", "text");
    const to = { fields: [note] };

    const keys = upgradeFillTargets(to, [
      { fields: [note] },
      { fields: [field("note", "number")] },
    ]).map((target) => target.key);

    expect(keys).toEqual(["note"]);
  });

  it("明細列、上傳、引用與計算欄位不列入", () => {
    const to = {
      fields: [
        arrayField("items", [column("qty", "number")], {
          rules: { required: true },
        }),
        field("file", "upload", { rules: { required: true } }),
        field("customer", "reference", { rules: { required: true } }),
        computedNumber("total", 1),
      ],
    };

    expect(upgradeFillTargets(to, [{ fields: [] }])).toEqual([]);
  });
});
