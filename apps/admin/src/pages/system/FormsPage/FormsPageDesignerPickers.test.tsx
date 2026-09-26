import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { FormVersionStatus } from "@repo/graphql";

import {
  SHOPPING_FORM_KEY,
  field,
  formFragment,
  shoppingDefinition,
  versionFragment,
} from "@/test/msw/form-fixtures";

import {
  addField,
  findDesigner,
  openSelect,
  pickOption,
  preloadFormsPage,
  renderFormsPage,
  selectField,
} from "./forms-page-test-support";

preloadFormsPage();

/** 已發布 v1 多一個受保護的「成本」:其他表單拿它當來源時,欄位目錄不列它。 */
const renderWithProtectedPublished = () => {
  const published = shoppingDefinition();
  published.fields.push(
    field("cost", "成本", "number", {
      widget: { kind: "number" },
      permission: { show: true, edit: false },
    }),
  );
  return renderFormsPage({
    // 還沒發布過的表單不能當來源(沒有版本可查欄位)
    forms: [
      formFragment(),
      formFragment({
        key: "draft_only",
        name: "草稿表單",
        currentVersion: null,
      }),
    ],
    versions: {
      [SHOPPING_FORM_KEY]: [
        versionFragment(shoppingDefinition(), { baseVersion: 1 }),
        versionFragment(published, {
          id: `ver-${SHOPPING_FORM_KEY}-1`,
          version: 1,
          status: FormVersionStatus.Published,
        }),
      ],
    },
  });
};

const savedFields = async (
  user: ReturnType<typeof renderFormsPage>["user"],
  world: ReturnType<typeof renderFormsPage>["world"],
) => {
  await user.click(screen.getByRole("button", { name: "存草稿" }));
  await waitFor(() => {
    expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
  });
  return world.inputs.saveFormVersionDraft.at(0)?.fields ?? [];
};

describe("表單管理:類別 / 表單 / 欄位改用下拉選", () => {
  it("選項來源 = 欄位管理類別:從類別清單挑", async () => {
    const { user, world } = renderFormsPage();
    await addField(user, "單選");
    await pickOption(user, "選項來源", "欄位管理類別");

    expect(await openSelect(user, "類別")).toEqual(
      expect.arrayContaining(["性別(gender)", "示範分類(demo-category)"]),
    );
    await user.click(screen.getByRole("option", { name: "性別(gender)" }));

    const fields = await savedFields(user, world);
    expect(fields.at(-1)).toMatchObject({
      options: { kind: "fieldCategory", key: "gender" },
    });
  });

  it("表單提交:表單只列已發布的;顯示欄從該版欄位挑、不列受保護欄位", async () => {
    const { user, world } = renderWithProtectedPublished();
    await addField(user, "單選");
    await pickOption(user, "選項來源", "資料來源");
    await pickOption(user, "資料來源", "表單提交");
    // 還沒選表單:顯示欄是停用的下拉(不是文字框)
    expect(screen.getByRole("combobox", { name: "顯示欄" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(await openSelect(user, "表單")).toEqual([
      "請選表單",
      "購物單(shopping_list)",
    ]);
    await user.click(
      screen.getByRole("option", { name: "購物單(shopping_list)" }),
    );

    // 換了表單,顯示欄預設摘要槽「標題」;欄位目錄載到後可以挑
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "顯示欄" }),
      ).toHaveTextContent("標題(摘要)");
    });
    const labelFields = await openSelect(user, "顯示欄");
    expect(labelFields).toEqual(
      expect.arrayContaining(["標題(摘要)", "品項(item)", "數量(qty)"]),
    );
    expect(labelFields).not.toContain("成本(cost)");
    await user.click(screen.getByRole("option", { name: "品項(item)" }));

    const fields = await savedFields(user, world);
    expect(fields.at(-1)).toMatchObject({
      options: {
        kind: "lookup",
        source: {
          provider: "form_submission",
          formKey: SHOPPING_FORM_KEY,
          labelField: "item",
        },
      },
    });
  });

  it("帶入規則照四步排、全部下拉:本表單欄位只列使用者填的,來源欄位只列型別相容的", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();
    const rule = await screen.findByRole("group", { name: "帶入規則 1" });
    expect(within(rule).getByRole("textbox", { name: "規則名稱" })).toHaveValue(
      "從使用者帶入",
    );
    // 沒有英文欄位名的平鋪文字框:規則名稱之外全是下拉
    expect(within(rule).getAllByRole("textbox")).toHaveLength(1);

    await user.click(
      within(rule).getAllByRole("combobox", { name: "本表單欄位" })[0],
    );
    const targets = within(await screen.findByRole("listbox"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(targets).toContain("採購人(buyer)");
    expect(targets).not.toContain("總價(total)");
    await user.keyboard("{Escape}");

    // 換成表單提交 → 購物單;對到數字欄「數量」的列,來源只列數字(金額摘要、數量、單價、總價)
    await pickOption(user, "資料來源", "表單提交", rule);
    await pickOption(user, "表單", "購物單(shopping_list)", rule);
    const [firstTarget] = within(rule).getAllByRole("combobox", {
      name: "本表單欄位",
    });
    await user.click(firstTarget);
    await user.click(await screen.findByRole("option", { name: "數量(qty)" }));
    const [firstSource] = within(rule).getAllByRole("combobox", {
      name: "來源欄位",
    });
    await waitFor(() => {
      expect(firstSource).not.toHaveAttribute("aria-disabled");
    });
    await user.click(firstSource);
    const listbox = await screen.findByRole("listbox");
    const sources = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(sources).toEqual(
      expect.arrayContaining(["金額(摘要)", "數量(qty)", "單價(unit_price)"]),
    );
    expect(sources).not.toContain("品項(item)");
    expect(sources).not.toContain("標題(摘要)");
    await user.click(screen.getByRole("option", { name: "單價(unit_price)" }));

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
        labelField: "title",
      },
      // 第二列(內部備註 ← email)是換來源前的舊對應,留給檢查器報錯、由設計者改
      mapping: [
        { fieldKey: "qty", sourceField: "unit_price" },
        { fieldKey: "internal_note", sourceField: "email" },
      ],
    });
  });
});

describe("表單管理:型別導向的表達式選擇器(表 B)", () => {
  it("自訂驗證的根只列回是 / 否的運算(沒有常數、系統值);填錯誤訊息存進 rules.customMessage", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();
    await selectField(user, "品項", "item");
    const custom = await screen.findByRole("group", {
      name: "自訂驗證(條件成立才通過)",
    });
    await user.click(within(custom).getByRole("button", { name: "設定" }));

    // 購物單沒有是 / 否欄位,所以根只剩「運算」
    expect(await openSelect(user, "節點種類(根)", custom)).toEqual(["運算"]);
    await user.keyboard("{Escape}");
    const operators = await openSelect(user, "運算", custom);
    expect(operators).toEqual(
      expect.arrayContaining(["等於", "且", "非", "包含於", "如果…則…否則"]),
    );
    expect(operators).not.toContain("加");
    expect(operators).not.toContain("串接文字");
    expect(operators).not.toContain("日期差");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("textbox", { name: "錯誤訊息" }));
    await user.paste("品項不能是這個");
    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "item")).toMatchObject({
      rules: {
        custom: { "==": [null, null] },
        customMessage: "品項不能是這個",
      },
    });
  });

  it("公式參數依型別過濾:乘法的參數只列數字欄;換成日期差出現單位下拉,產生第三參數", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();
    await selectField(user, "總價", "total");
    const formula = await screen.findByRole("group", { name: "公式" });

    const [firstArg] = within(formula).getAllByRole("combobox", {
      name: "欄位",
    });
    await user.click(firstArg);
    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["數量(qty)", "單價(unit_price)"]);
    await user.keyboard("{Escape}");

    await pickOption(user, "運算", "日期差", formula);
    expect(
      within(formula).getByRole("combobox", { name: "單位" }),
    ).toHaveTextContent("天");
    // 起 / 迄只列日期類:購物單沒有日期欄,剩系統值(現在時間)、日期常數、回日期的運算
    expect(await openSelect(user, "節點種類(dateDiff.0)", formula)).toEqual([
      "系統值",
      "常數",
      "運算",
    ]);
    await user.keyboard("{Escape}");
    await pickOption(user, "單位", "小時", formula);

    const fields = await savedFields(user, world);
    expect(fields.find((item) => item.key === "total")).toMatchObject({
      valueSource: {
        kind: "computed",
        expr: { dateDiff: [null, null, "hours"] },
      },
    });
  });
});
