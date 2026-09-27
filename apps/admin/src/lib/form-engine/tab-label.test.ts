import { describe, expect, it } from "@jest/globals";

import {
  applyTabLabelTemplate,
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
