import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import type { FieldDef, FormDefinition } from "@repo/domain/form";

import {
  SHOPPING_FORM_KEY,
  field,
  formFragment,
  versionFragment,
} from "@/test/msw/form-fixtures";

import {
  defaultDesignOptions,
  findDesigner,
  openSelect,
  pickOption,
  preloadFormsPage,
  renderFormsPage,
  selectField,
} from "./forms-page-test-support";

preloadFormsPage();

const LEAVE_OPTIONS: FieldDef["options"] = {
  kind: "static",
  items: [
    { value: "sick", label: "病假", order: 1, enabled: true },
    { value: "annual", label: "特休", order: 2, enabled: true },
  ],
};

/** 台北 09-01 00:00 */
const TAIPEI_0901 = "2026-08-31T16:00:00.000Z";

/** 設計器第二批的草稿:各型別各一欄(是 / 否、多選、固定值日期、兩個同來源單選、日期)。 */
const batchDraft = (): FormDefinition => {
  const fields = [
    field("item", "品項", "text"),
    field("flag", "旗標", "boolean", { widget: { kind: "switch" } }),
    field("tags", "標籤", "multiSelect", {
      widget: { kind: "checkboxGroup" },
      options: LEAVE_OPTIONS,
    }),
    field("day", "固定日", "date", {
      widget: { kind: "datePicker" },
      valueSource: { kind: "constant", value: TAIPEI_0901 },
    }),
    field("leave", "假別", "select", {
      widget: { kind: "dropdown" },
      options: LEAVE_OPTIONS,
    }),
    field("prev_leave", "上次假別", "select", {
      widget: { kind: "dropdown" },
      options: LEAVE_OPTIONS,
    }),
    field("paid_on", "付款日", "date", { widget: { kind: "datePicker" } }),
  ];
  return {
    fields,
    layout: {
      sections: [
        {
          key: "basic",
          title: "基本",
          rows: fields.map((item) => ({
            cols: [{ fieldKey: item.key, span: 12 }],
          })),
        },
      ],
    },
    summaryMap: { title: "item" },
    prefills: [],
  };
};

const renderBatch = (currentVersion: number | null = 1) => {
  const options = defaultDesignOptions();
  return renderFormsPage({
    ...options,
    forms: [formFragment({ currentVersion })],
    versions: {
      [SHOPPING_FORM_KEY]: [
        versionFragment(batchDraft(), { baseVersion: 1 }),
        ...(options.versions?.[SHOPPING_FORM_KEY] ?? []).slice(1),
      ],
    },
  });
};

type Rendered = ReturnType<typeof renderBatch>;

const savedFields = async (
  user: Rendered["user"],
  world: Rendered["world"],
) => {
  await user.click(screen.getByRole("button", { name: "存草稿" }));
  await waitFor(() => {
    expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
  });
  return world.inputs.saveFormVersionDraft.at(0)?.fields ?? [];
};

/** 以 MUI X 日期選擇器(role group)選某一天(日曆按鈕在轉場中點不到,以 fireEvent 點)。 */
const pickDay = async (group: HTMLElement, day: string) => {
  fireEvent.click(
    within(group.parentElement ?? document.body).getByRole("button", {
      name: /choose date/i,
    }),
  );
  fireEvent.click(await screen.findByRole("gridcell", { name: day }));
};

/** 公式根的運算子下拉(巢狀的運算也叫「運算」,取第一個)。 */
const pickRootOperator = async (
  user: Rendered["user"],
  scope: HTMLElement,
  name: string,
) => {
  const [root] = within(scope).getAllByRole("combobox", { name: "運算" });
  await user.click(root);
  await user.click(await screen.findByRole("option", { name }));
};

describe("表單管理:固定值用依型別的輸入元件,存正確型別", () => {
  it("是 / 否存布林、多選存陣列", async () => {
    const { user, world } = renderBatch();
    await findDesigner();

    await selectField(user, "旗標", "flag");
    await pickOption(user, "值的來源", "固定值");
    expect(await openSelect(user, "固定值")).toEqual(["是", "否"]);
    await user.click(screen.getByRole("option", { name: "是" }));

    await selectField(user, "標籤", "tags");
    await pickOption(user, "值的來源", "固定值");
    await pickOption(user, "固定值", "特休");
    await user.keyboard("{Escape}");

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "flag")).toMatchObject({
      valueSource: { kind: "constant", value: true },
    });
    expect(fields.find((item) => item.key === "tags")).toMatchObject({
      valueSource: { kind: "constant", value: ["annual"] },
    });
  });

  it("日期存選的那天在租戶時區 00:00 的 ISO;日期上下限也是日期選擇器", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "固定日", "day");

    const constant = screen.getByRole("group", { name: "固定值" });
    expect(constant).toHaveTextContent("2026-09-01");
    await pickDay(constant, "26");
    // 上下限與固定值同一組元件(日期選擇器,不是文字框)
    expect(screen.getByRole("group", { name: "最小值" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "最小值" })).toBeNull();

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "day")).toMatchObject({
      valueSource: { kind: "constant", value: "2026-09-25T16:00:00.000Z" },
    });
  });
});

describe("表單管理:表達式常數、dateAdd、選擇器可讀性", () => {
  // 分成兩案:全套並行時設計器頁的單一案例接近 15 秒上限(TEST-08)
  it("日期加減:方向(之前 / 之後)與單位(天 / 週 / 月 / 年)是下拉", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "付款日", "paid_on");
    await pickOption(user, "值的來源", "計算");
    const formula = await screen.findByRole("group", { name: "公式" });
    await pickRootOperator(user, formula, "日期加減");

    expect(await openSelect(user, "方向", formula)).toEqual(["之前", "之後"]);
    await user.click(screen.getByRole("option", { name: "之前" }));
    expect(await openSelect(user, "單位", formula)).toEqual([
      "天",
      "週",
      "月",
      "年",
    ]);
    await user.click(screen.getByRole("option", { name: "月" }));

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "paid_on")).toMatchObject({
      valueSource: {
        kind: "computed",
        expr: { dateAdd: [null, "before", 1, "months"] },
      },
    });
  });

  it("日期常數:種類有日期 / 日期時間,用選擇器(不是原生日期輸入),存 { date: ISO }", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "付款日", "paid_on");
    await pickOption(user, "值的來源", "計算");
    const formula = await screen.findByRole("group", { name: "公式" });
    await pickRootOperator(user, formula, "日期加減");
    await pickOption(user, "節點種類(dateAdd.0)", "常數", formula);

    // 起的常數種類(數量那格也是常數,取第一個)
    const [startKind] = within(formula).getAllByRole("combobox", {
      name: "常數種類",
    });
    await user.click(startKind);
    expect(
      within(await screen.findByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["日期", "日期時間"]);
    await user.keyboard("{Escape}");
    expect(
      within(formula).getByRole("group", { name: "值" }),
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "paid_on")).toMatchObject({
      valueSource: {
        kind: "computed",
        expr: {
          dateAdd: [
            { date: expect.stringMatching(/T\d{2}:00:00\.000Z$/) },
            "after",
            1,
            "days",
          ],
        },
      },
    });
  });

  it("且 / 或:預設放「等於」比較、按鈕叫「+ 條件」;巢狀運算畫成帶框群組", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "品項", "item");
    const visible = screen.getByRole("group", { name: "顯示條件" });
    await user.click(within(visible).getByRole("button", { name: "設定" }));
    await pickOption(user, "運算", "且", visible);

    // 兩個條件各是一個標頭為「等於」的群組;還沒選的參數是空位
    expect(
      within(visible).getAllByRole("group", { name: "等於" }),
    ).toHaveLength(2);
    expect(await openSelect(user, "節點種類(and.0.==.0)", visible)).toEqual([
      "請選節點種類",
      "欄位",
      "系統值",
      "常數",
      "運算",
    ]);
    await user.keyboard("{Escape}");
    await user.click(within(visible).getByRole("button", { name: "+ 條件" }));

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "item")?.visibleWhen).toEqual({
      and: [
        { "==": [null, null] },
        { "==": [null, null] },
        { "==": [null, null] },
      ],
    });
  });

  it("單選的公式根是「選項」:只列如果、選項常數從該欄位選項挑,不列串接", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "假別", "leave");
    await pickOption(user, "值的來源", "計算");
    const formula = await screen.findByRole("group", { name: "公式" });

    const [rootOperator] = within(formula).getAllByRole("combobox", {
      name: "運算",
    });
    await user.click(rootOperator);
    expect(
      within(await screen.findByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["如果…則…否則"]);
    await user.keyboard("{Escape}");
    // 然後:選項常數從「假別」的選項挑
    await pickOption(user, "節點種類(if.1)", "常數", formula);
    expect(await openSelect(user, "常數種類", formula)).toEqual(["選項"]);
    await user.keyboard("{Escape}");
    await pickOption(user, "假別 的選項", "特休", formula);

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "leave")).toMatchObject({
      valueSource: {
        kind: "computed",
        expr: { if: [{ "==": [null, null] }, "annual", null] },
      },
    });
  });

  it("單選公式的否則:欄位只列同選項來源的單選", async () => {
    const { user } = renderBatch();
    await findDesigner();
    await selectField(user, "假別", "leave");
    await pickOption(user, "值的來源", "計算");
    const formula = await screen.findByRole("group", { name: "公式" });

    await pickOption(user, "節點種類(if.2)", "欄位", formula);
    expect(await openSelect(user, "欄位", formula)).toEqual([
      "上次假別(prev_leave)",
    ]);
  });
});

describe("表單管理:帶入可選同一張表單", () => {
  it("還沒發布也列出自己;欄位目錄 = 草稿的欄位", async () => {
    const { user, world } = renderBatch(null);
    await findDesigner();
    await user.click(screen.getByRole("button", { name: "+ 新增帶入規則" }));
    await pickOption(user, "資料來源", "表單提交");
    expect(await openSelect(user, "表單")).toEqual([
      "請選表單",
      "購物單(shopping_list)",
    ]);
    await user.click(
      screen.getByRole("option", { name: "購物單(shopping_list)" }),
    );
    await user.click(screen.getByRole("button", { name: "+ 對應" }));

    const sources = await openSelect(user, "來源欄位");
    // 草稿才有的欄位(上次假別、付款日)也在目錄裡
    expect(sources).toEqual(
      expect.arrayContaining(["品項(item)", "付款日(paid_on)"]),
    );
    await user.click(screen.getByRole("option", { name: "品項(item)" }));

    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    expect(
      world.inputs.saveFormVersionDraft.at(0)?.prefills.at(0),
    ).toMatchObject({
      source: {
        provider: "form_submission",
        formKey: SHOPPING_FORM_KEY,
      },
      mapping: [{ sourceField: "item" }],
    });
  });
});
