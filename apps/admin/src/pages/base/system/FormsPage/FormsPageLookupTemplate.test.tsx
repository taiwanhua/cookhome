import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { SHOPPING_FORM_KEY } from "@/test/msw/form-fixtures";

import {
  findDesigner,
  pickOption,
  preloadFormsPage,
  renderFormsPage,
} from "./forms-page-test-support";

preloadFormsPage();

/** 獨立一檔、一案只做一件事:設計器的下拉案例集中在同一檔時,全套並行會超過 15 秒(TEST-08)。 */
describe("表單管理:lookup 來源的顯示模板", () => {
  it("帶入規則的來源換成表單提交:從「插入欄位」下拉插入摘要槽 {{date}} 與欄位 {{value.<key>}},存進來源描述", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();
    const rule = await screen.findByRole("group", { name: "帶入規則 1" });
    await pickOption(user, "資料來源", "表單提交", rule);
    await pickOption(user, "表單", "購物單(shopping_list)", rule);
    const insert = within(rule).getByRole("combobox", { name: "插入欄位" });
    await waitFor(() => {
      expect(insert).not.toHaveAttribute("aria-disabled");
    });
    const template = within(rule).getByRole("textbox", {
      name: "顯示模板(選填)",
    });
    await pickOption(user, "插入欄位", "日期(摘要)", rule);
    await pickOption(user, "插入欄位", "品項(item)", rule);
    expect(template).toHaveValue("{{date}}{{value.item}}");

    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    expect(
      world.inputs.saveFormVersionDraft.at(0)?.prefills.at(0)?.source,
    ).toMatchObject({
      provider: "form_submission",
      formKey: SHOPPING_FORM_KEY,
      labelTemplate: "{{date}}{{value.item}}",
    });
  });
});
