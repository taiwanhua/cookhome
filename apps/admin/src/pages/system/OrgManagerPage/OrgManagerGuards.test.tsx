import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { tenantTree } from "@/test/msw/org-fixtures";

import {
  OWN_PERMISSIONS,
  clickNode,
  detail,
  renderPage,
  stubObjectUrl,
  treeLabel,
  waitForTree,
} from "./org-manager-test-support";

stubObjectUrl();

/**
 * #140 驗收收到的三個問題(#186 ②④⑤):既有商標、「租戶」標籤的歸屬、
 * 租戶頂層保護。跟 `OrgManagerPage.test.tsx` 同一頁、同一組夾具,分檔只是為了行數上限。
 */
describe("組織管理頁:標籤與租戶頂層保護", () => {
  it("租戶視角:子組織不會被誤標「租戶」(#186 ④)", async () => {
    renderPage({
      permissions: OWN_PERMISSIONS,
      world: { orgTree: tenantTree },
    });

    await waitForTree();
    // 樹根(租戶頂層)的 parentId 跟根組織視角一樣是 null,不能拿它當判準
    expect(treeLabel("A-1 內容組")).toBe("A-1 內容組");
    expect(treeLabel("A-2 台北分店")).toBe("A-2 台北分店停用");
  });

  it("租戶頂層保護:租戶內的人停用 / 刪除 / 搬移都停用並提示(#186 ⑤)", async () => {
    const { user: actor } = renderPage({
      permissions: OWN_PERMISSIONS,
      world: { orgTree: tenantTree },
    });

    await waitForTree();
    const disableButton = await within(detail()).findByRole("button", {
      name: "停用",
    });
    expect(disableButton).toBeDisabled();
    expect(disableButton).toHaveAttribute(
      "title",
      "頂層組織不可由組織內的人停用、搬移或刪除,需要時請聯絡系統管理員",
    );
    expect(
      within(detail()).getByRole("button", { name: "刪除" }),
    ).toBeDisabled();

    await actor.click(within(detail()).getByRole("button", { name: "編輯" }));
    expect(await screen.findByLabelText("上層組織(搬移)")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("編輯彈窗:一開啟就看得到既有商標;只改名稱不會把它清掉(#186 ②)", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "租戶 A");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    const preview = await screen.findByText("目前的商標");
    expect(preview).toBeInTheDocument();

    const nameField = screen.getByLabelText("名稱 *");
    await actor.clear(nameField);
    await actor.type(nameField, "租戶 A’");
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.updateOrg).toHaveLength(1);
    });
    // 沒碰商標欄就不送 logoPath(api 把 null 當成「清空」)
    expect(fake.inputs.updateOrg[0]).not.toHaveProperty("logoPath");
    expect(fake.inputs.createUploadUrl).toHaveLength(0);
  });
});
