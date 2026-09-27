import { describe, expect, it } from "@jest/globals";

import { type FormDefinition, formatTemporal } from "@repo/domain/form";

import {
  applyTabLabelTemplate,
  summaryDateTypeOf,
  tabLabelOf,
  tabLabelValuesOf,
} from "./tab-label";

describe("頁籤 / 標題模板", () => {
  it("摘要槽與系統佔位符(建立者現名、表單名)都能套;沒值的換成空字串", () => {
    const values = tabLabelValuesOf({
      summary: { title: "病假", date: "2026-03-12", amount: null },
      createdBy: { name: "小華" },
      formName: "請假單",
    });
    expect(
      applyTabLabelTemplate("{{form}}:{{title}} — {{applicant}}", values),
    ).toBe("請假單:病假 — 小華");
    expect(applyTabLabelTemplate("{{amount}}", values)).toBeNull();
  });

  it("{{date}} 給了格式化函式就印顯示文字(不印原始 ISO / UTC 日期)", () => {
    const summary = {
      title: "病假",
      date: "2026-09-25T16:00:00.000Z",
      amount: null,
    };
    expect(tabLabelValuesOf({ summary }).date).toBe("2026-09-25T16:00:00.000Z");
    const values = tabLabelValuesOf({ summary }, (value) =>
      formatTemporal(value, { type: "date", timezone: "Asia/Taipei" }),
    );
    expect(applyTabLabelTemplate("{{title}} {{date}}", values)).toBe(
      "病假 2026-09-26",
    );
  });

  it("summaryDateTypeOf:對到日期欄 → date,其餘(日期時間欄、沒對、沒載到)→ datetime", () => {
    const fields = [
      { key: "day", type: "date" },
      { key: "at", type: "datetime" },
    ] as unknown as FormDefinition["fields"];
    expect(summaryDateTypeOf({ fields, summaryMap: { date: "day" } })).toBe(
      "date",
    );
    expect(summaryDateTypeOf({ fields, summaryMap: { date: "at" } })).toBe(
      "datetime",
    );
    expect(summaryDateTypeOf({ fields, summaryMap: {} })).toBe("datetime");
    expect(summaryDateTypeOf(null)).toBe("datetime");
  });

  it("表單沒設模板就用模組層的", () => {
    const values = tabLabelValuesOf({
      summary: { title: "病假" },
      createdBy: null,
      formName: "請假單",
    });
    expect(tabLabelOf("{{title}}", null, values)).toBe("病假");
    expect(tabLabelOf("{{title}}", "{{form}}", values)).toBe("請假單");
  });
});
