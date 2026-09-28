import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import {
  CATEGORY_MANAGER,
  categoryList,
  optionsPanel,
  renderPage,
  selectCategory,
} from "./field-manager-test-support";

/** 左欄的一個類別(名稱 + key + 標籤組成它的可及名稱)。 */
const categoryItem = async (name: string) => {
  const list = await screen.findByRole("region", { name: "欄位類別" });
  return within(list).findByRole("button", { name: new RegExp(name) });
};

/**
 * 類別作業(`system.field-manager.category-ops.manage-categories`,根組織專屬):
 * 新增 / 改名 / 停用類別、系統類別標籤、停用的類別灰掉。
 * 規則正本 `docs/modules/field-manager.md`;假伺服器照 api 的規則擋(`field-manager-handlers.ts`)。
 */
describe("欄位管理頁:類別作業", () => {
  it("系統類別標「系統」;停用的類別照樣列出、標「已停用」", async () => {
    renderPage();

    expect(within(await categoryItem("性別")).getByText("系統")).toBeVisible();
    const cuisine = await categoryItem("料理類型");
    expect(within(cuisine).getByText("已停用")).toBeVisible();
    expect(within(cuisine).queryByText("系統")).not.toBeInTheDocument();
  });

  it("沒有 manage-categories:沒有「新增類別」、也沒有編輯 / 停用類別", async () => {
    renderPage();
    await categoryItem("性別");

    expect(
      within(categoryList()).queryByRole("button", { name: "+ 新增類別" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "編輯類別" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /停用類別|啟用類別/ }),
    ).not.toBeInTheDocument();
  });

  it("新增類別:key 格式與重複當場擋(不送出);合法時送出、清單重查後出現新類別", async () => {
    const { user, fake } = renderPage({ permissions: CATEGORY_MANAGER });
    await categoryItem("性別");

    await user.click(
      within(categoryList()).getByRole("button", { name: "+ 新增類別" }),
    );
    const keyInput = screen.getByLabelText("類別 key *");
    const submit = screen.getByRole("button", { name: "新增" });
    await user.type(screen.getByLabelText("類別名稱 *"), "場合");

    await user.type(keyInput, "Occasion_1");
    expect(keyInput).toHaveAccessibleDescription(
      "格式不符:只能用小寫英文、數字與單一 -,最長 40 字。",
    );
    expect(submit).toBeDisabled();

    // 與既有類別同 key(含停用的「料理類型」)
    await user.clear(keyInput);
    await user.type(keyInput, "cuisine");
    expect(keyInput).toHaveAccessibleDescription(
      "這個 key 已經有類別用了(含已停用的),請換一個。",
    );
    expect(submit).toBeDisabled();

    await user.clear(keyInput);
    await user.type(keyInput, "occasion");
    await user.type(screen.getByLabelText("說明"), "用餐場合");
    const callsBefore = fake.calls.fieldCategories;
    await user.click(submit);

    await waitFor(() => {
      expect(fake.inputs.createFieldCategory).toEqual([
        { key: "occasion", name: "場合", description: "用餐場合" },
      ]);
    });
    expect(await categoryItem("場合")).toBeInTheDocument();
    expect(fake.calls.fieldCategories).toBeGreaterThan(callsBefore);
  });

  it("api 回 FIELD_CATEGORY_KEY_DUPLICATE(別人剛建了同 key)→ 標在 key 欄位,彈窗留著", async () => {
    const { user } = renderPage({
      permissions: CATEGORY_MANAGER,
      world: {
        failures: { CreateFieldCategory: "FIELD_CATEGORY_KEY_DUPLICATE" },
      },
    });
    await categoryItem("性別");

    await user.click(
      within(categoryList()).getByRole("button", { name: "+ 新增類別" }),
    );
    await user.type(screen.getByLabelText("類別 key *"), "occasion");
    await user.type(screen.getByLabelText("類別名稱 *"), "場合");
    await user.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      expect(screen.getByLabelText("類別 key *")).toHaveAccessibleDescription(
        "這個 key 已經有類別用了(含已停用的),請換一個。",
      );
    });
    expect(screen.getByRole("button", { name: "新增" })).toBeInTheDocument();
  });

  it("系統類別唯讀:沒有「編輯類別」也沒有「停用類別」", async () => {
    const { user } = renderPage({ permissions: CATEGORY_MANAGER });
    await selectCategory(user, "性別");

    expect(
      within(optionsPanel()).queryByRole("button", { name: "編輯類別" }),
    ).not.toBeInTheDocument();
    expect(
      within(optionsPanel()).queryByRole("button", { name: "停用類別" }),
    ).not.toBeInTheDocument();
  });

  it("root 建的類別:可改名稱與說明(key 唯讀)", async () => {
    const { user, fake } = renderPage({ permissions: CATEGORY_MANAGER });
    await selectCategory(user, "料理類型");

    await user.click(
      within(optionsPanel()).getByRole("button", { name: "編輯類別" }),
    );
    expect(screen.getByLabelText("類別 key")).toBeDisabled();
    expect(screen.getByLabelText("類別 key")).toHaveValue("cuisine");
    const nameInput = screen.getByLabelText("類別名稱 *");
    await user.clear(nameInput);
    await user.type(nameInput, "菜系");
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.updateFieldCategory).toEqual([
        {
          id: "cat-cuisine",
          name: "菜系",
          description: "營運上臨時需要的分類",
        },
      ]);
    });
    expect(await categoryItem("菜系")).toBeInTheDocument();
  });

  it("停用 / 啟用 root 建的類別:直接送出,清單重查後標籤跟著變", async () => {
    const { user, fake } = renderPage({ permissions: CATEGORY_MANAGER });
    await selectCategory(user, "料理類型");

    await user.click(
      within(optionsPanel()).getByRole("button", { name: "啟用類別" }),
    );
    await waitFor(() => {
      expect(fake.inputs.setFieldCategoryEnabled).toEqual([
        { id: "cat-cuisine", enabled: true },
      ]);
    });
    await waitFor(async () => {
      expect(
        within(await categoryItem("料理類型")).queryByText("已停用"),
      ).not.toBeInTheDocument();
    });

    await user.click(
      await within(optionsPanel()).findByRole("button", { name: "停用類別" }),
    );
    await waitFor(() => {
      expect(fake.inputs.setFieldCategoryEnabled).toHaveLength(2);
    });
    expect(fake.inputs.setFieldCategoryEnabled[1]).toEqual({
      id: "cat-cuisine",
      enabled: false,
    });
    expect(
      await within(await categoryItem("料理類型")).findByText("已停用"),
    ).toBeVisible();
  });
});
