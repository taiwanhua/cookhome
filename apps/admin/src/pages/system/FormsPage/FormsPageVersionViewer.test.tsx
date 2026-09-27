import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { FormVersionStatus } from "@repo/graphql";

import {
  SHOPPING_FORM_KEY,
  formFragment,
  shoppingDefinition,
  versionFragment,
} from "@/test/msw/form-fixtures";

import { preloadFormsPage, renderFormsPage } from "./forms-page-test-support";

preloadFormsPage();

const openVersion = async (
  user: ReturnType<typeof renderFormsPage>["user"],
) => {
  await user.click(await screen.findByRole("tab", { name: "表單版本" }));
  const table = await screen.findByRole("table", { name: "版本清單" });
  await user.click(
    await within(table).findByRole("button", { name: "檢視 v1" }),
  );
  return screen.findByRole("region", { name: "檢視 v1(唯讀)" });
};

describe("表單管理:唯讀檢視已發布的版本", () => {
  it("版本面板點「檢視」:設計器唯讀打開那一版,照樣標示、不能改不能存,預覽可以算", async () => {
    const { user } = renderFormsPage();
    const viewer = await openVersion(user);

    // 回到設計頁籤,但換成唯讀檢視:沒有元件面板、沒有存草稿、沒有屬性面板
    expect(screen.queryByRole("region", { name: "元件" })).toBeNull();
    expect(screen.queryByRole("button", { name: "存草稿" })).toBeNull();
    const total = await within(viewer).findByRole("button", {
      name: "選取欄位「總價」(total)",
    });
    expect(within(total).getByText("計算欄位")).toBeInTheDocument();
    await user.click(total);
    expect(screen.queryByRole("textbox", { name: "顯示名稱" })).toBeNull();
    // 已經有草稿:不能以這一版開新草稿,只提示
    expect(
      within(viewer).queryByRole("button", { name: "以 v1 為基底開新草稿" }),
    ).toBeNull();

    await user.click(within(viewer).getByRole("tab", { name: "預覽" }));
    const preview = await within(viewer).findByRole("region", { name: "預覽" });
    expect(
      within(preview).queryByRole("button", { name: "以後端重算" }),
    ).toBeNull();
    await user.type(
      within(preview).getByRole("textbox", { name: "數量" }),
      "2",
    );
    await user.type(
      within(preview).getByRole("textbox", { name: "單價" }),
      "15",
    );
    expect(
      await within(preview).findByDisplayValue("30 元"),
    ).toBeInTheDocument();

    await user.click(within(viewer).getByRole("button", { name: "關閉檢視" }));
    expect(
      await screen.findByRole("region", { name: "元件" }),
    ).toBeInTheDocument();
  });

  it("沒有草稿時旁邊有「以此為基底開新草稿」", async () => {
    const { user, world } = renderFormsPage({
      forms: [formFragment({ hasDraft: false })],
      versions: {
        [SHOPPING_FORM_KEY]: [
          versionFragment(shoppingDefinition(), {
            id: `ver-${SHOPPING_FORM_KEY}-1`,
            version: 1,
            status: FormVersionStatus.Published,
          }),
        ],
      },
    });
    const viewer = await openVersion(user);

    await user.click(
      within(viewer).getByRole("button", { name: "以 v1 為基底開新草稿" }),
    );
    await waitFor(() => {
      expect(world.inputs.createFormVersionDraft).toEqual([
        { formKey: SHOPPING_FORM_KEY, baseVersion: 1 },
      ]);
    });
  });
});
