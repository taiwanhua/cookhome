import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import type { FormDefinition } from "@repo/domain/form";

import {
  SHOPPING_FORM_KEY,
  field,
  formFragment,
  shoppingDefinition,
  versionFragment,
} from "@/test/msw/form-fixtures";

import {
  addField,
  canvas,
  defaultDesignOptions,
  findDesigner,
  preloadFormsPage,
  renderFormsPage,
  selectField,
} from "./forms-page-test-support";

preloadFormsPage();

/** 舊草稿:多一個 key 也叫 `qty` 的「數量二」(改 key 到一半存下來的那種)。 */
const withDuplicateKey = (): FormDefinition => {
  const base = shoppingDefinition();
  return {
    ...base,
    fields: [
      ...base.fields,
      field("qty", "數量二", "number", { widget: { kind: "number" } }),
    ],
    layout: {
      sections: base.layout.sections.map((section) => ({
        ...section,
        rows: [...section.rows, { cols: [{ fieldKey: "qty", span: 12 }] }],
      })),
    },
  };
};

const renderWithDraft = (definition: FormDefinition) => {
  const options = defaultDesignOptions();
  return renderFormsPage({
    ...options,
    forms: [formFragment()],
    versions: {
      [SHOPPING_FORM_KEY]: [
        versionFragment(definition, { baseVersion: 1 }),
        ...(options.versions?.[SHOPPING_FORM_KEY] ?? []).slice(1),
      ],
    },
  });
};

describe("表單管理:設計器修正(失焦、key 重複、面板依型別)", () => {
  it("引用與上傳欄位不顯示「值的來源」;引用要設資料來源", async () => {
    const { user } = renderFormsPage();
    await addField(user, "引用");
    expect(screen.queryByRole("combobox", { name: "值的來源" })).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "資料來源" }),
    ).toBeInTheDocument();

    await addField(user, "上傳");
    expect(screen.queryByRole("combobox", { name: "值的來源" })).toBeNull();
    expect(
      screen.queryByRole("group", { name: "自訂驗證(條件成立才通過)" }),
    ).toBeNull();
  });

  it("靜態選項的值欄連續打字不失焦(列以穩定內部 id 當 key)", async () => {
    const { user, world } = renderFormsPage();
    await addField(user, "單選");
    const items = screen.getByRole("group", { name: "選項" });
    await user.click(screen.getByRole("button", { name: "+ 新增選項" }));
    const value = within(items).getByRole("textbox", { name: "值" });

    await user.clear(value);
    await user.type(value, "sick");

    expect(value).toHaveFocus();
    expect(value).toHaveValue("sick");
    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    expect(world.inputs.saveFormVersionDraft[0]?.fields.at(-1)).toMatchObject({
      options: { kind: "static", items: [{ value: "sick" }] },
    });
  });

  it("改 key 成別的欄位的 key:輸入框標紅、不寫入,欄位數不變", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();
    await selectField(user, "數量", "qty");
    const key = await screen.findByRole("textbox", { name: "欄位 key" });

    await user.clear(key);
    await user.type(key, "unit_price");

    expect(key).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("與其他欄位的 key 重複")).toBeInTheDocument();
    expect(
      within(canvas()).getAllByRole("button", { name: /^選取欄位/ }),
    ).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    const keys = (world.inputs.saveFormVersionDraft[0]?.fields ?? []).map(
      (item) => item.key,
    );
    expect(keys).toHaveLength(7);
    expect(new Set(keys).size).toBe(7);
    // 打到 unit_pric 還合格(寫入);再打一個 e 撞到單價 → 擋下,不寫入
    expect(keys).toContain("unit_pric");
  });

  it("舊草稿 key 重複:刪第二個只刪它,第一個還在(以內部 id 認欄位)", async () => {
    const { user, world } = renderWithDraft(withDuplicateKey());
    await findDesigner();

    await selectField(user, "數量二", "qty");
    await user.click(await screen.findByRole("button", { name: "刪除欄位" }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "刪除欄位「數量二」?" }),
      ).getByRole("button", { name: "刪除" }),
    );

    expect(
      within(canvas()).queryByRole("button", {
        name: "選取欄位「數量二」(qty)",
      }),
    ).toBeNull();
    expect(
      within(canvas()).getByRole("button", { name: "選取欄位「數量」(qty)" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    const labels = (world.inputs.saveFormVersionDraft.at(0)?.fields ?? []).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("數量二");
    expect(labels).toContain("數量");
    // 內部 id 只活在設計器裡:送出去的欄位與版面每一格都不帶 `_id`
    const saved = world.inputs.saveFormVersionDraft.at(0);
    for (const item of saved?.fields ?? []) {
      expect(item).not.toHaveProperty("_id");
    }
    const layout = saved?.layout as
      { sections: { rows: { cols: object[] }[] }[] } | undefined;
    const cols = (layout?.sections ?? []).flatMap((section) =>
      section.rows.flatMap((row) => row.cols),
    );
    expect(cols.length).toBeGreaterThan(0);
    for (const col of cols) {
      expect(col).not.toHaveProperty("_id");
    }
  });

  it("面板依型別:文字有格式、多行有列數沒有格式、數字有單位;計算欄位沒有鎖定條件", async () => {
    const { user } = renderFormsPage();
    await findDesigner();

    await selectField(user, "品項", "item");
    expect(
      await screen.findByRole("combobox", { name: "內建格式" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "列數" })).toBeNull();

    await selectField(user, "備註", "note");
    expect(
      await screen.findByRole("spinbutton", { name: "列數" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "內建格式" })).toBeNull();

    await selectField(user, "數量", "qty");
    expect(
      await screen.findByRole("textbox", { name: "單位" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "最少字數" })).toBeNull();
    expect(
      screen.getByRole("group", { name: "鎖定條件(成立時此欄位不可修改)" }),
    ).toBeInTheDocument();

    await selectField(user, "總價", "total");
    await screen.findByRole("group", { name: "公式" });
    expect(
      screen.queryByRole("group", { name: "鎖定條件(成立時此欄位不可修改)" }),
    ).toBeNull();
    expect(screen.getByRole("switch", { name: "必填" })).toBeInTheDocument();
  });

  it("計算欄位在畫布是有框的唯讀輸入框;是 / 否欄位的標題在元件前面", async () => {
    const { user } = renderFormsPage();
    await findDesigner();
    const total = within(canvas()).getByRole("button", {
      name: "選取欄位「總價」(total)",
    });
    expect(within(total).getByRole("textbox", { name: "總價" })).toBeDisabled();

    await addField(user, "是否");
    const label = within(canvas())
      .getByText("是否", { selector: ".MuiFormControlLabel-label" })
      .closest(".MuiFormControlLabel-root");
    expect(label).toHaveClass("MuiFormControlLabel-labelPlacementStart");
  });

  it("表單編輯跳窗:頁籤模板下方即時顯示以範例資料套用的結果", async () => {
    const { user } = renderFormsPage();
    await findDesigner();
    await user.click(screen.getByRole("button", { name: "編輯名稱與標題" }));
    const dialog = await screen.findByRole("dialog", {
      name: "編輯名稱與標題",
    });
    const preview = within(dialog).getByRole("status", {
      name: "頁籤模板預覽",
    });
    // 留空 = 模組預設 {{title}}
    expect(preview).toHaveTextContent("範例:病假申請");

    // user-event 的 `{{` 是字面的 `{`
    await user.type(
      within(dialog).getByRole("textbox", { name: "頁籤 / 標題模板" }),
      "{{{{title}} — {{{{date}}",
    );
    expect(preview).toHaveTextContent("範例:病假申請 — 2026-03-12");

    // 系統佔位符:可用清單列出來,{{form}} 用輸入框裡的表單名、{{applicant}} 用範例的建立者
    const placeholders = within(dialog).getByRole("list", {
      name: "可用的佔位符",
    });
    expect(
      within(placeholders).getByText("{{applicant}}:建立者(顯示現在的名字)"),
    ).toBeInTheDocument();
    const template = within(dialog).getByRole("textbox", {
      name: "頁籤 / 標題模板",
    });
    await user.clear(template);
    await user.type(template, "{{{{form}} · {{{{applicant}}");
    expect(preview).toHaveTextContent("範例:購物單 · 王小明");
  });
});
