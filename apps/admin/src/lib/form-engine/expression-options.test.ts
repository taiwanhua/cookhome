import { describe, expect, it } from "@jest/globals";

import { field } from "@/test/msw/form-fixtures";

import {
  conditionFieldsOf,
  initialExpressionOf,
  positionOptionsOf,
} from "./expression-options";
import { operationNode, withOperator } from "./expression-tree";

const fields = [
  field("qty", "數量", "number"),
  field("title", "標題", "text"),
  field("start", "開始日", "date"),
  field("agree", "同意", "boolean"),
  field("tags", "標籤", "multiSelect"),
  field("proof", "附件", "upload"),
  field("secret", "成本", "number", {
    permission: { show: true, edit: false },
  }),
];

const keysOf = (items: readonly { key: string }[]) =>
  items.map((item) => item.key);

describe("表達式選擇器:根節點依用途過濾(Spec 6a §5 表 B)", () => {
  it("條件的根:只有回是 / 否的運算與是 / 否欄位;常數與系統值不能單獨當根", () => {
    const root = positionOptionsOf(
      {
        expected: ["boolean"],
        usage: "condition",
        isRoot: true,
        allowNull: false,
      },
      fields,
    );
    expect(root.kinds).toEqual(["field", "operation"]);
    expect(keysOf(root.fields)).toEqual(["agree"]);
    expect(root.operators).toEqual(
      expect.arrayContaining(["==", ">", "and", "or", "!", "in", "if"]),
    );
    expect(root.operators).not.toContain("+");
    expect(root.operators).not.toContain("concat");
    expect(root.operators).not.toContain("dateDiff");
  });

  it("數字欄的公式根:數字欄、數字常數、回數字的運算;系統值只有型別對得上的(沒有)", () => {
    const root = positionOptionsOf(
      {
        expected: ["number"],
        usage: "formula",
        isRoot: true,
        allowNull: false,
      },
      fields,
    );
    expect(root.kinds).toEqual(["field", "constant", "operation"]);
    expect(keysOf(root.fields)).toEqual(["qty", "secret"]);
    expect(root.constants).toEqual(["number"]);
    expect(root.operators).toEqual(
      expect.arrayContaining(["+", "*", "dateDiff", "if"]),
    );
    expect(root.operators).not.toContain("==");
  });

  it("文字欄的公式根可單獨用系統值「填寫者 / 填寫者的組織」,不列時區;日期位置可用現在時間", () => {
    const text = positionOptionsOf(
      { expected: ["text"], usage: "formula", isRoot: true, allowNull: false },
      fields,
    );
    expect(text.contexts).toEqual(["ctx.user.id", "ctx.user.orgId"]);
    const date = positionOptionsOf(
      { expected: ["date"], usage: "formula", isRoot: false, allowNull: false },
      fields,
    );
    expect(date.contexts).toEqual(["ctx.now"]);
    expect(keysOf(date.fields)).toEqual(["start"]);
  });

  it("參數位置:加法只收數字;包含的第二個參數只收清單;上傳欄永遠不列", () => {
    const plus = positionOptionsOf(
      {
        expected: ["number"],
        usage: "condition",
        isRoot: false,
        allowNull: false,
      },
      fields,
    );
    expect(keysOf(plus.fields)).toEqual(["qty", "secret"]);
    const list = positionOptionsOf(
      {
        expected: ["list"],
        usage: "condition",
        isRoot: false,
        allowNull: false,
      },
      fields,
    );
    expect(keysOf(list.fields)).toEqual(["tags"]);
    expect(list.constants).toEqual(["list"]);
    const any = positionOptionsOf(
      { expected: null, usage: "condition", isRoot: false, allowNull: true },
      fields,
    );
    expect(keysOf(any.fields)).not.toContain("proof");
    expect(any.constants).toContain("null");
  });

  it("條件不列受保護欄位;顯示條件不列自己", () => {
    expect(keysOf(conditionFieldsOf(fields, "qty", false))).toEqual([
      "title",
      "start",
      "agree",
      "tags",
      "proof",
    ]);
    expect(keysOf(conditionFieldsOf(fields, "qty", true))).toContain("qty");
  });

  it("起點:數字 → 相乘、文字 → 串接、是 / 否 → 等於;dateDiff 預設單位 days;同族換運算子保留參數", () => {
    expect(initialExpressionOf(["number"])).toEqual({ "*": [null, null] });
    expect(initialExpressionOf(["text"])).toEqual({ concat: [null, null] });
    expect(initialExpressionOf(["boolean"])).toEqual({ "==": [null, null] });
    expect(operationNode("dateDiff")).toEqual({
      dateDiff: [null, null, "days"],
    });
    expect(withOperator({ "==": [{ var: "qty" }, 1] }, "!=")).toEqual({
      "!=": [{ var: "qty" }, 1],
    });
    expect(withOperator({ "==": [{ var: "qty" }, 1] }, "and")).toEqual({
      and: [null, null],
    });
  });
});
