import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ORG_MANAGER_PERMISSIONS } from "./org-manager-permissions";
import {
  OWN_PERMISSIONS,
  USER_VIEW_PERMISSION,
  clickNode,
  detail,
  renderPage,
  stubObjectUrls,
  waitForTree,
} from "./org-manager-test-support";

let restoreObjectUrls: () => void;

beforeAll(() => {
  restoreObjectUrls = stubObjectUrls();
});

afterAll(() => {
  restoreObjectUrls();
});

describe("組織管理頁(/system/org-manager)", () => {
  it("只有檢視權限時,動作按鈕一個都不出現", async () => {
    renderPage({ permissions: [ORG_MANAGER_PERMISSIONS.view] });

    await waitForTree();
    for (const label of ["編輯", "停用", "刪除", "+ 子組織", "開通租戶"]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("選中租戶頂層時顯示商標與擁有者;一般組織沒有這兩列", async () => {
    const { user: actor } = renderPage();

    await waitForTree();

    // 先看一般組織:沒有商標、也沒有擁有者
    await clickNode(actor, "A-1 內容組");
    await waitFor(() => {
      expect(
        within(detail()).getByText("負責食譜內容產出與審核"),
      ).toBeInTheDocument();
    });
    expect(within(detail()).queryByText("擁有者")).not.toBeInTheDocument();

    // 再看租戶頂層:兩者都有
    await clickNode(actor, "租戶 A");
    expect(await within(detail()).findByText("何家華")).toBeInTheDocument();
    expect(screen.getByAltText("租戶 A 的商標")).toBeInTheDocument();
  });

  it("編輯彈窗:租戶頂層 + 持對應權限才有擁有者與可見範圍兩欄", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "租戶 A");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    expect(await screen.findByLabelText("擁有者")).toBeInTheDocument();
    const visibility = screen.getByRole("switch");
    expect(visibility).not.toBeChecked();

    await actor.click(visibility);
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.setOrgVisibility).toHaveLength(1);
    });
    expect(fake.inputs.setOrgVisibility[0]?.visibility).toBe("SUBTREE");
    // 名稱 / 描述沒動過就不送 updateOrg(api 不留空的審計紀錄)
    expect(fake.inputs.updateOrg).toHaveLength(0);
  });

  it("編輯彈窗:非租戶頂層沒有擁有者與可見範圍兩欄", async () => {
    const { user: actor } = renderPage();

    await waitForTree();
    await clickNode(actor, "A-1 內容組");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    expect(await screen.findByLabelText("名稱 *")).toBeInTheDocument();
    expect(screen.queryByLabelText("擁有者")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("編輯彈窗:兩筆權限都沒有時,租戶頂層也看不到那兩欄", async () => {
    const { user: actor } = renderPage({
      permissions: [...OWN_PERMISSIONS, USER_VIEW_PERMISSION],
    });

    await waitForTree();
    await clickNode(actor, "租戶 A");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    expect(await screen.findByLabelText("名稱 *")).toBeInTheDocument();
    expect(screen.queryByLabelText("擁有者")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("搬移:「上層組織」只給同租戶、非自己子樹的選項,送出打 moveOrg", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "A-2 台北分店");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    await actor.click(await screen.findByLabelText("上層組織(搬移)"));
    const options = screen
      .getAllByRole("option")
      .map((item) => item.textContent);
    expect(options).toContain("租戶 A / A-1 內容組");
    // 自己不能當自己的上層,根組織與別的租戶也不在同一個租戶裡
    expect(options).not.toContain("租戶 A / A-2 台北分店");
    expect(options).not.toContain("CookHome");

    await actor.click(
      screen.getByRole("option", { name: "租戶 A / A-1 內容組" }),
    );
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.moveOrg).toHaveLength(1);
    });
    expect(fake.inputs.moveOrg[0]).toEqual({
      id: "org-store",
      newParentId: "org-content",
    });
  });

  it("商標上傳:取簽名網址 → 直傳 → 把 objectPath 當 logoPath 送出", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "A-1 內容組");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    const picker = await screen.findByLabelText("商標(選填)");
    await actor.upload(
      picker,
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.updateOrg).toHaveLength(1);
    });
    expect(fake.inputs.createUploadUrl[0]?.contentType).toBe("image/png");
    expect(fake.uploadedFiles).toHaveLength(1);
    expect(fake.uploadedFiles[0]?.contentType).toBe("image/png");
    expect(fake.inputs.updateOrg[0]?.logoPath).toBe("org-logos/1.png");
  });

  it("刪除被拒:逐項列出原因並提示改用停用", async () => {
    const { user: actor } = renderPage({
      world: {
        failures: {
          DeleteOrg: {
            code: "ORG_NOT_DELETABLE",
            extensions: { reasons: ["HAS_CHILDREN", "HAS_MEMBERS"] },
          },
        },
      },
    });

    await waitForTree();
    await clickNode(actor, "A-1 內容組");
    await actor.click(
      await within(detail()).findByRole("button", { name: "刪除" }),
    );
    await actor.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "刪除" }),
    );

    expect(await screen.findByText("還有下層組織")).toBeInTheDocument();
    expect(screen.getByText("還有成員屬於這個組織")).toBeInTheDocument();
    expect(
      screen.getByText(
        "請改用「停用」— 停用會連同全部下層組織一起停用,資料照樣保留。",
      ),
    ).toBeInTheDocument();
  });

  it("停用確認:文案說明連動整棵子樹,確認後送出", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "A-1 內容組");
    await actor.click(
      await within(detail()).findByRole("button", { name: "停用" }),
    );

    expect(
      await screen.findByText(/與其全部下層組織將一併停用/),
    ).toBeInTheDocument();
    await actor.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "停用" }),
    );

    await waitFor(() => {
      expect(fake.inputs.setOrgEnabled).toHaveLength(1);
    });
    expect(fake.inputs.setOrgEnabled[0]).toEqual({
      id: "org-content",
      enabled: false,
    });
  });

  it("新增子組織:掛在目前選中的組織底下", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "A-1 內容組");
    await actor.click(await screen.findByRole("button", { name: "+ 子組織" }));

    await actor.type(await screen.findByLabelText("名稱 *"), "食譜小組");
    await actor.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      expect(fake.inputs.createChildOrg).toHaveLength(1);
    });
    expect(fake.inputs.createChildOrg[0]).toEqual({
      parentId: "org-content",
      name: "食譜小組",
      description: null,
    });
  });

  it("開通彈窗:預設全勾,取消群組連動下層、勾下層連動上層", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await actor.click(await screen.findByRole("button", { name: "開通租戶" }));

    const systemBox = await screen.findByRole("checkbox", { name: "系統管理" });
    const orgBox = screen.getByRole("checkbox", { name: "組織管理" });
    const userBox = screen.getByRole("checkbox", { name: "使用者管理" });
    expect(systemBox).toBeChecked();
    expect(orgBox).toBeChecked();

    await actor.click(systemBox);
    expect(orgBox).not.toBeChecked();
    expect(userBox).not.toBeChecked();

    await actor.click(orgBox);
    expect(systemBox).toBeChecked();
    expect(userBox).not.toBeChecked();

    await actor.type(screen.getByLabelText("租戶名稱 *"), "租戶 C");
    await actor.type(
      screen.getByLabelText("首任租戶管理員 Email *"),
      "admin@tenant-c.tw",
    );
    await actor.click(screen.getByRole("button", { name: "開通" }));

    await waitFor(() => {
      expect(fake.inputs.provisionTenant).toHaveLength(1);
    });
    const input = fake.inputs.provisionTenant[0];
    expect(input.moduleKeys).toEqual([
      "overview",
      "system",
      "system.org-manager",
    ]);
    // 帳號沒動過 → 預設帶入 Email
    expect(input.adminAccount).toBe("admin@tenant-c.tw");
    expect(input.adminEmail).toBe("admin@tenant-c.tw");
  });
});
