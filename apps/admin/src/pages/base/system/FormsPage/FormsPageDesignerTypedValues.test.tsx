import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react";

import { SHOPPING_FORM_KEY } from "@/test/msw/form-fixtures";

import {
  pickDay,
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

describe("表單管理:固定值用依型別的輸入元件,存正確型別", () => {
  it("是 / 否存布林", async () => {
    const { user, world } = renderBatch();
    await findDesigner();

    await selectField(user, "旗標", "flag");
    await pickOption(user, "值的來源", "固定值");
    expect(await openSelect(user, "固定值")).toEqual(["是", "否"]);
    await user.click(screen.getByRole("option", { name: "是" }));

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "flag")).toMatchObject({
      valueSource: { kind: "constant", value: true },
    });
  });

  it("多選存陣列", async () => {
    const { user, world } = renderBatch();
    await findDesigner();

    await selectField(user, "標籤", "tags");
    await pickOption(user, "值的來源", "固定值");
    await pickOption(user, "固定值", "特休");
    await user.keyboard("{Escape}");

    const fields = await savedFields(user, world);
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
  it("固定值是已停用的選項:仍列出並標「已停用」", async () => {
    const { user } = renderBatch();
    await findDesigner();
    await user.click(await screen.findByRole("button", { name: /舊假別/ }));
    expect(
      await screen.findByRole("combobox", { name: "固定值" }),
    ).toHaveTextContent("舊假(已停用)");
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
