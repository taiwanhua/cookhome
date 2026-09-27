import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { autocompleteOption } from "@/test/autocomplete";

import {
  clickNode,
  detail,
  renderPage,
  waitForTree,
} from "./org-manager-test-support";

/** 選一個組織,等資料區換成它。 */
const selectOrg = async (name: string) => {
  const rendered = renderPage();
  await waitForTree();
  await clickNode(rendered.user, name);
  await within(detail()).findByText(name);
  return rendered;
};

/**
 * 組織的「主管」欄(6b `org_manager`;審核流程的主管來源):詳情列出、編輯彈窗多選本租戶使用者、
 * 只有真的改了才送 `setOrgManagers`(整組取代)。規則正本 `docs/modules/org-manager.md`「主管」。
 */
describe("組織管理:主管欄", () => {
  it("詳情列出主管(設定順序、停用的標註);沒設的顯示「未設定」;根組織沒有這一列", async () => {
    const { user: actor } = await selectOrg("A-1 內容組");
    expect(
      await within(detail()).findByText("王小明、離職者(已停用)"),
    ).toBeInTheDocument();

    await clickNode(actor, "A-1-1 編輯組");
    await within(detail()).findByText("A-1-1 編輯組");
    expect(await within(detail()).findByText("未設定")).toBeInTheDocument();

    await clickNode(actor, "CookHome");
    await within(detail()).findByText("CookHome");
    expect(within(detail()).queryByText("主管")).toBeNull();
  });

  it("編輯彈窗:移除一位、加入一位 → 送整組名單;詳情立刻換成新名單", async () => {
    const { user: actor, fake } = await selectOrg("A-1 內容組");
    await within(detail()).findByText("王小明、離職者(已停用)");
    await actor.click(within(detail()).getByRole("button", { name: "編輯" }));
    const dialog = screen.getByRole("dialog");

    const field = within(dialog).getByRole("combobox", { name: "主管" });
    await waitFor(() => {
      expect(field).toBeEnabled();
    });
    expect(within(dialog).getByText("王小明(user-new)")).toBeInTheDocument();
    expect(within(dialog).getByText("離職者(user-off)")).toBeInTheDocument();

    // 候選只有本租戶啟用中的人;Backspace 移除最後一位(離職者)再加陳大文
    await actor.click(field);
    await actor.keyboard("{Backspace}");
    await actor.click(autocompleteOption("陳大文"));
    await actor.click(within(dialog).getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.setOrgManagers).toEqual([
        { orgId: "org-content", userIds: ["user-new", "user-extra"] },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(
      await within(detail()).findByText("王小明、陳大文"),
    ).toBeInTheDocument();
    // 其他欄位沒動就不打它們的 mutation
    expect(fake.inputs.updateOrg).toEqual([]);
  });

  it("沒碰主管欄就不送 setOrgManagers(只改名稱時只打 updateOrg)", async () => {
    const { user: actor, fake } = await selectOrg("A-1 內容組");
    await within(detail()).findByText("王小明、離職者(已停用)");
    await actor.click(within(detail()).getByRole("button", { name: "編輯" }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "名稱" });
    await actor.clear(name);
    await actor.type(name, "A-1 內容二組");
    await actor.click(within(dialog).getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.updateOrg).toHaveLength(1);
    });
    expect(fake.inputs.setOrgManagers).toEqual([]);
  });

  it("送出失敗時在彈窗內顯示錯誤,彈窗不關", async () => {
    const rendered = renderPage({
      world: { failures: { SetOrgManagers: { code: "VALIDATION_FAILED" } } },
    });
    await waitForTree();
    await clickNode(rendered.user, "A-1 內容組");
    await within(detail()).findByText("王小明、離職者(已停用)");
    await rendered.user.click(
      within(detail()).getByRole("button", { name: "編輯" }),
    );
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByRole("combobox", { name: "主管" });
    await waitFor(() => {
      expect(field).toBeEnabled();
    });
    await rendered.user.click(field);
    await rendered.user.click(autocompleteOption("陳大文"));
    await rendered.user.click(
      within(dialog).getByRole("button", { name: "儲存" }),
    );

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
