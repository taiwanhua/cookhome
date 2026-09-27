import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { SHOPPING_FORM_KEY, formFragment } from "@/test/msw/form-fixtures";

import {
  defaultDesignOptions,
  findDesigner,
  preloadFormsPage,
  renderFormsPage,
} from "./forms-page-test-support";

preloadFormsPage();

const OTHER_KEY = "other_form";

const withTwoForms = () => {
  const options = defaultDesignOptions();
  return {
    ...options,
    forms: [
      ...(options.forms ?? []),
      formFragment({ key: OTHER_KEY, name: "另一張表單", hasDraft: false }),
    ],
  };
};

describe("表單管理:設計器未存的變更不會無聲消失", () => {
  it("切到「版本」再切回來,改動還在;發布跳窗提示發布的是上次存的草稿,可先存再發布", async () => {
    const { user, world } = renderFormsPage();
    const palette = await findDesigner();
    await user.click(
      within(palette).getByRole("button", { name: "新增數字欄位" }),
    );
    expect(await screen.findByText(/有未儲存的變更/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "表單版本" }));
    const versions = await screen.findByRole("table", { name: "版本清單" });
    await user.click(within(versions).getByRole("button", { name: "發布" }));
    const dialog = await screen.findByRole("dialog", { name: "發布新版本" });
    expect(
      within(dialog).getByText("設計器有未存的變更:發布的是上次存的草稿。"),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "先存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    expect(world.inputs.saveFormVersionDraft[0]?.fields).toContainEqual(
      expect.objectContaining({ key: "field_1", type: "number" }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "變更說明" }),
      "加數字欄位",
    );
    await user.click(within(dialog).getByRole("button", { name: "發布" }));
    await waitFor(() => {
      expect(world.inputs.publishFormVersion).toHaveLength(1);
    });
    // 發布帶的是剛存完的修訂號,不是開跳窗時的舊值
    expect(world.inputs.publishFormVersion[0]?.expectedDraftRevision).toBe(2);
  });

  it("有未存的變更時換表單:先問(留在設計 / 放棄變更);留在設計不換、放棄才換", async () => {
    const { user } = renderFormsPage(withTwoForms());
    const palette = await findDesigner();
    await user.click(
      within(palette).getByRole("button", { name: "新增數字欄位" }),
    );
    const list = screen.getByRole("region", { name: "表單清單" });

    await user.click(within(list).getByText("另一張表單"));
    const ask = await screen.findByRole("dialog", { name: "有未存的變更" });
    await user.click(within(ask).getByRole("button", { name: "留在設計" }));
    expect(screen.queryByRole("dialog", { name: "有未存的變更" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "購物單", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/有未儲存的變更/)).toBeInTheDocument();

    await user.click(within(list).getByText("另一張表單"));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "有未存的變更" }),
      ).getByRole("button", { name: "放棄變更" }),
    );
    expect(
      await screen.findByRole("heading", { name: "另一張表單", level: 1 }),
    ).toBeInTheDocument();
  });

  it("沒有未存的變更:換表單直接換,不問", async () => {
    const { user } = renderFormsPage(withTwoForms());
    await findDesigner();

    await user.click(
      within(screen.getByRole("region", { name: "表單清單" })).getByText(
        "另一張表單",
      ),
    );

    expect(
      await screen.findByRole("heading", { name: "另一張表單", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "有未存的變更" })).toBeNull();
  });

  it("預覽以後端為準:「以後端重算」之後計算結果與顯示條件照 previewFormVersion", async () => {
    const { user, world } = renderFormsPage({
      ...defaultDesignOptions(),
      preview: {
        values: { qty: "2", unit_price: "15", total: "999" },
        fieldStates: [
          { key: "note", visible: false, readonly: false, redacted: false },
        ],
        summary: { title: null, date: null, amount: "999" },
        fieldErrors: [],
      },
    });
    await findDesigner();
    await user.click(screen.getByRole("tab", { name: "預覽" }));
    const preview = await screen.findByRole("region", { name: "預覽" });
    await user.type(
      within(preview).getByRole("textbox", { name: "數量" }),
      "2",
    );
    await user.type(
      within(preview).getByRole("textbox", { name: "單價" }),
      "15",
    );
    // 前端即時算:30,數量 > 0 所以備註出現
    expect(
      await within(preview).findByDisplayValue("30 元"),
    ).toBeInTheDocument();
    expect(
      within(preview).getByRole("textbox", { name: "備註" }),
    ).toBeVisible();

    await user.click(
      within(preview).getByRole("button", { name: "以後端重算" }),
    );

    expect(
      await within(preview).findByDisplayValue("999 元"),
    ).toBeInTheDocument();
    expect(within(preview).queryByRole("textbox", { name: "備註" })).toBeNull();
    expect(world.inputs.previewFormVersion[0]).toEqual({
      formKey: SHOPPING_FORM_KEY,
      values: { qty: "2", unit_price: "15" },
    });
  });
});
