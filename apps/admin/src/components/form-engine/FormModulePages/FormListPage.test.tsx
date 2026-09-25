import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ModuleListColumnKind } from "@repo/graphql";

import {
  SHOPPING_LIST_KEY,
  SHOPPING_ROUTES,
  submissionFragment,
} from "@/test/msw/form-fixtures";
import { setupFakeViewport } from "@/test/viewport";

import {
  defaultRuntimeOptions,
  renderShopping,
  shoppingForm,
} from "./form-module-test-support";

setupFakeViewport();

/** 新增鈕在「此刻可新增的表單」回來之前是停用的;等它可按再點。 */
const createButton = async () => {
  // 停用時 Tooltip 會包一層 span,啟用後節點換掉:每次都重新查
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "+ 新增" })).toBeEnabled();
  });
  return screen.getByRole("button", { name: "+ 新增" });
};

const table = () => screen.findByRole("table", { name: "購物清單清單" });

describe("表單模組列表頁(預設組裝)", () => {
  it("列表依列表欄位配置顯示;配置引用那一筆版本沒有的欄位顯示「—」", async () => {
    renderShopping({
      path: SHOPPING_ROUTES.list,
      world: {
        ...defaultRuntimeOptions(),
        submissions: [submissionFragment()],
        listColumns: {
          [SHOPPING_LIST_KEY]: [
            {
              kind: ModuleListColumnKind.Slot,
              key: "title",
              formKey: null,
              width: 200,
              order: 0,
            },
            {
              kind: ModuleListColumnKind.Field,
              key: "qty",
              formKey: null,
              width: 120,
              order: 1,
            },
            {
              kind: ModuleListColumnKind.Field,
              key: "discount",
              formKey: null,
              width: 120,
              order: 2,
            },
          ],
        },
      },
    });

    const grid = await table();
    expect(await within(grid).findByText("雞蛋")).toBeInTheDocument();
    // 數量是版本裡有的欄位:顯示值;折扣是配置引用、那一版沒有的欄位:顯示「—」
    expect(
      await within(grid).findByRole("columnheader", { name: /數量/ }),
    ).toBeInTheDocument();
    const row = within(grid).getByText("雞蛋").closest("tr");
    expect(row).not.toBeNull();
    await waitFor(() => {
      expect(within(row as HTMLElement).getByText("2")).toBeInTheDocument();
    });
    expect(within(row as HTMLElement).getAllByText("—").length).toBeGreaterThan(
      0,
    );
  });

  it("此刻可新增的表單只有一張:按新增直接進那張表單", async () => {
    const { user } = renderShopping({ path: SHOPPING_ROUTES.list });

    await user.click(await createButton());

    expect(
      await screen.findByRole("heading", { name: "新增 — 購物單" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      `${SHOPPING_ROUTES.createPage}/shopping_list`,
    );
  });

  it("多張表單:先選(FormPicker),選了才進新增頁", async () => {
    const { user } = renderShopping({
      path: SHOPPING_ROUTES.list,
      world: {
        ...defaultRuntimeOptions(),
        moduleForms: [
          shoppingForm,
          {
            ...shoppingForm,
            key: "shopping_list_good_food",
            name: "購物單(門市版)",
          },
        ],
      },
    });

    await user.click(await createButton());
    const picker = await screen.findByRole("dialog", {
      name: "選擇要填寫的表單",
    });
    expect(within(picker).getByText("購物單(門市版)")).toBeInTheDocument();

    await user.click(within(picker).getByText("購物單"));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        `${SHOPPING_ROUTES.createPage}/shopping_list`,
      );
    });
  });

  it("沒有可新增的表單(停用、收回或退役):新增鈕停用", async () => {
    renderShopping({
      path: SHOPPING_ROUTES.list,
      world: { ...defaultRuntimeOptions(), moduleForms: [] },
    });

    expect(
      await screen.findByRole("button", { name: "+ 新增" }),
    ).toBeDisabled();
  });
});
