import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";

import {
  pickRootOperator,
  renderBatch,
  savedFields,
} from "./designer-batch-test-support";
import {
  findDesigner,
  openSelect,
  pickOption,
  preloadFormsPage,
  selectField,
} from "./forms-page-test-support";

preloadFormsPage();

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

  it("單選公式的然後:常數種類只有「選項」,從該欄位選項挑", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "假別", "leave");
    await pickOption(user, "值的來源", "計算");
    const formula = await screen.findByRole("group", { name: "公式" });

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

  it("單選的公式根的運算只列「如果…則…否則」", async () => {
    const { user } = renderBatch();
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
  it("比較的參數選了欄位之後可以「清空(= 空值)」回到空位", async () => {
    const { user, world } = renderBatch();
    await findDesigner();
    await selectField(user, "品項", "item");
    const visible = screen.getByRole("group", { name: "顯示條件" });
    await user.click(within(visible).getByRole("button", { name: "設定" }));
    await pickOption(user, "節點種類(==.0)", "欄位", visible);
    expect(await openSelect(user, "節點種類(==.0)", visible)).toContain(
      "清空(= 空值)",
    );
    await user.click(screen.getByRole("option", { name: "清空(= 空值)" }));

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "item")?.visibleWhen).toEqual({
      "==": [null, null],
    });
  });
});
