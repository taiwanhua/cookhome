import { describe, expect, it } from "@jest/globals";

import { field } from "./form-test-support";
import {
  lookupLabelFieldsOf,
  lookupTemplateFieldOf,
  renderLookupLabel,
  renderTemplate,
  templatePlaceholdersOf,
  templateTextOf,
} from "./template";

const nameOnly = (name: string) => (name === "name" ? "王小明" : null);

describe("顯示模板", () => {
  it("解析與套用佔位符:前後空白不計、沒值換空字串、結果去頭尾空白", () => {
    expect(templatePlaceholdersOf("{{ title }}・{{value.days}}{{x}}")).toEqual([
      "title",
      "value.days",
      "x",
    ]);
    const values: Record<string, string> = { title: "病假" };
    expect(
      renderTemplate(" {{ title }} {{missing}} ", (name) => values[name]),
    ).toBe("病假");
  });

  it("欄位值的模板文字:選項 label、日期依時區、數字照 precision、是 / 否、上傳檔名、讀不到為空", () => {
    const select = field("kind", "select", {
      options: {
        kind: "static",
        items: [{ value: "sick", label: "病假", order: 0, enabled: true }],
      },
    });
    expect(templateTextOf(select, "sick")).toBe("病假");
    expect(templateTextOf(select, { value: "x", label: "自訂" })).toBe("自訂");
    const day = field("day", "date");
    expect(
      templateTextOf(day, "2026-09-25T16:00:00.000Z", {
        timezone: "Asia/Taipei",
      }),
    ).toBe("2026-09-26");
    const at = field("at", "datetime");
    expect(
      templateTextOf(at, "2026-09-26T06:30:00.000Z", {
        timezone: "Asia/Taipei",
      }),
    ).toBe("2026-09-26 14:30");
    const amount = field("amount", "number", { precision: 2 });
    expect(templateTextOf(amount, "12.5")).toBe("12.50");
    expect(templateTextOf(field("ok", "boolean"), true)).toBe("是");
    expect(
      templateTextOf(field("file", "upload"), { name: "a.pdf", path: "p" }),
    ).toBe("a.pdf");
    expect(templateTextOf(field("note", "text"), "[redacted]")).toBe("");
  });

  it("lookup 模板的佔位符對到 provider 欄位:表單提交只收摘要槽與 value.<key>", () => {
    expect(lookupTemplateFieldOf("user", "email")).toBe("email");
    expect(lookupTemplateFieldOf("user", "value.email")).toBeNull();
    expect(lookupTemplateFieldOf("form_submission", "date")).toBe("date");
    expect(lookupTemplateFieldOf("form_submission", "value.days")).toBe("days");
    expect(lookupTemplateFieldOf("form_submission", "days")).toBeNull();
    expect(lookupTemplateFieldOf("form_submission", "value.title")).toBeNull();
  });

  it("lookup 顯示名:有模板套模板、套出空的或沒模板用 labelField", () => {
    const source = {
      provider: "user",
      labelField: "name",
      labelTemplate: "{{name}}({{email}})",
    };
    const texts: Record<string, string> = {
      name: "王小明",
      email: "wang@x.com",
    };
    expect(lookupLabelFieldsOf(source)).toEqual(["name", "email"]);
    expect(renderLookupLabel(source, (name) => texts[name] ?? null)).toBe(
      "王小明(wang@x.com)",
    );
    expect(
      renderLookupLabel({ ...source, labelTemplate: "{{email}}" }, nameOnly),
    ).toBe("王小明");
    expect(
      renderLookupLabel({ ...source, labelTemplate: null }, nameOnly),
    ).toBe("王小明");
  });
});

describe("lookup 顯示名:模板引用的欄位讀不到就整串退回 labelField", () => {
  const source = {
    provider: "user",
    labelField: "name",
    labelTemplate: "{{name}}({{email}})",
  };

  it("讀得到全部欄位 → 套模板", () => {
    const texts: Record<string, string> = { name: "王小明", email: "w@x.com" };
    expect(renderLookupLabel(source, (field) => texts[field])).toBe(
      "王小明(w@x.com)",
    );
  });

  it("有一個欄位讀不到(undefined)→ 只顯示 labelField,不留括號", () => {
    expect(
      renderLookupLabel(source, (field) =>
        field === "name" ? "王小明" : undefined,
      ),
    ).toBe("王小明");
  });

  it("讀得到但沒值(null)→ 照套,換空字串", () => {
    expect(
      renderLookupLabel(
        { ...source, labelTemplate: "{{name}} {{email}}" },
        (field) => (field === "name" ? "王小明" : null),
      ),
    ).toBe("王小明");
  });

  it("沒模板且 labelField 沒值 → null", () => {
    expect(
      renderLookupLabel({ ...source, labelTemplate: null }, () => null),
    ).toBeNull();
  });
});
