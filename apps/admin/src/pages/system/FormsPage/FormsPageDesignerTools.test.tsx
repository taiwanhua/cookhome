import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import type { FormDefinition } from "@repo/domain/form";

import { autocompleteOption } from "@/test/autocomplete";
import {
  SHOPPING_FORM_KEY,
  formFragment,
  shoppingDefinition,
  versionFragment,
} from "@/test/msw/form-fixtures";

import {
  defaultDesignOptions,
  findDesigner,
  preloadFormsPage,
  renderFormsPage,
} from "./forms-page-test-support";

preloadFormsPage();

const canvas = () => screen.getByRole("region", { name: "畫布" });

/** 設計器自己的「設計 / 預覽」切換(與右欄的「設計 / 版本」頁籤同名,限定在這一組)。 */
const modeTab = (name: "設計" | "預覽") =>
  within(screen.getByRole("tablist", { name: "設計器模式" })).getByRole("tab", {
    name,
  });

/** 購物單多一個「店家」:autocomplete 靜態選項,預設不允許自訂值。 */
const withStoreField = (): FormDefinition => {
  const base = shoppingDefinition();
  return {
    ...base,
    fields: [
      ...base.fields,
      {
        key: "store",
        label: "店家",
        type: "select",
        widget: { kind: "autocomplete" },
        valueSource: { kind: "input" },
        options: {
          kind: "static",
          items: [{ value: "px", label: "全聯", order: 0, enabled: true }],
        },
        rules: { required: false },
        permission: { show: false, edit: false },
        help: null,
      },
    ],
    layout: {
      sections: base.layout.sections.map((section) => ({
        ...section,
        rows: [...section.rows, { cols: [{ fieldKey: "store", span: 12 }] }],
      })),
    },
  };
};

const removeOnlySection = async (
  user: ReturnType<typeof renderFormsPage>["user"],
) => {
  await user.click(
    within(canvas()).getByRole("button", { name: "刪除分區「採購內容」" }),
  );
  return screen.findByRole("dialog", { name: "刪除分區「採購內容」?" });
};

describe("表單管理:設計器的檢查器定位、刪分區、自訂值", () => {
  it("點檢查結果:定位到出錯的欄位(從預覽也會切回設計)", async () => {
    const { user } = renderFormsPage();
    await findDesigner();
    await user.click(
      within(canvas()).getByRole("button", { name: "選取欄位「數量」(qty)" }),
    );
    await user.click(await screen.findByRole("button", { name: "刪除欄位" }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "刪除欄位「數量」?" }),
      ).getByRole("button", { name: "刪除" }),
    );
    expect(screen.queryByRole("textbox", { name: "顯示名稱" })).toBeNull();
    await user.click(modeTab("預覽"));

    const issues = screen.getByRole("region", { name: "檢查結果" });
    const located = within(issues).getAllByRole("button", {
      name: /EXPR_UNKNOWN_FIELD/,
    });
    await user.click(located[0]);

    // 回到設計模式,屬性面板開的是引用了 qty 的欄位(總價的公式或備註的顯示條件)
    expect(await findDesigner()).toBeInTheDocument();
    const label = await screen.findByRole("textbox", { name: "顯示名稱" });
    expect(["總價", "備註"]).toContain((label as HTMLInputElement).value);
  });

  it("刪分區選「欄位移到未放置區」:欄位留在草稿、出現在未放置區", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();

    const dialog = await removeOnlySection(user);
    expect(
      within(dialog).getByRole("radio", { name: "欄位移到未放置區" }),
    ).toBeChecked();
    expect(within(dialog).queryByRole("list")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "刪除" }));

    const unplaced = await screen.findByRole("region", {
      name: "未放置的欄位",
    });
    expect(
      within(unplaced).getByRole("button", { name: "數量(qty)" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    const saved = world.inputs.saveFormVersionDraft[0];
    expect(saved.layout).toEqual({ sections: [] });
    expect(saved.fields.map((field) => field.key)).toContain("qty");
  });

  it("刪分區選「連同欄位一起刪除」:先列出分區外的引用處,確認後欄位也從草稿移除", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();

    const dialog = await removeOnlySection(user);
    await user.click(
      within(dialog).getByRole("radio", { name: "連同欄位一起刪除" }),
    );
    const references = within(dialog).getByRole("list", {
      name: "引用這個欄位的地方",
    });
    expect(within(references).getByText("摘要槽「標題」")).toBeInTheDocument();
    expect(within(references).getByText("摘要槽「金額」")).toBeInTheDocument();
    expect(
      within(references).getByText("帶入規則「從使用者帶入」"),
    ).toBeInTheDocument();
    // 分區內欄位彼此的引用(總價的公式引用數量)跟著一起刪,不列
    expect(within(references).queryByText(/欄位 total/)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "刪除" }));

    expect(screen.queryByRole("region", { name: "未放置的欄位" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    expect(world.inputs.saveFormVersionDraft[0]?.fields).toEqual([]);
  });

  it("允許自訂值(allowCustom):autocomplete 打清單外的字多一個「使用「…」」選項", async () => {
    const options = defaultDesignOptions();
    const { user } = renderFormsPage({
      ...options,
      forms: [formFragment()],
      versions: {
        [SHOPPING_FORM_KEY]: [
          versionFragment(withStoreField(), { baseVersion: 1 }),
          ...(options.versions?.[SHOPPING_FORM_KEY] ?? []).slice(1),
        ],
      },
    });
    await findDesigner();

    // 還沒開:清單外的字沒有自訂選項
    await user.click(modeTab("預覽"));
    let preview = await screen.findByRole("region", { name: "預覽" });
    await user.type(
      within(preview).getByRole("combobox", { name: "店家" }),
      "好市多",
    );
    expect(screen.queryByRole("option", { name: /使用「好市多」/ })).toBeNull();

    await user.click(modeTab("設計"));
    await user.click(
      within(canvas()).getByRole("button", { name: "選取欄位「店家」(store)" }),
    );
    await user.click(await screen.findByRole("switch", { name: "允許自訂值" }));

    await user.click(modeTab("預覽"));
    preview = await screen.findByRole("region", { name: "預覽" });
    const store = within(preview).getByRole("combobox", { name: "店家" });
    await user.clear(store);
    await user.type(store, "好市多");
    await user.click(autocompleteOption("使用「好市多」"));

    expect(store).toHaveValue("好市多");
  });
});
