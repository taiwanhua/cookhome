import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ModuleSidebarType } from "@repo/graphql";

import {
  type TestModule,
  authWorld,
  overviewModule,
} from "@/test/msw/auth-handlers";
import {
  orgDetails,
  orgUsers,
  rootTree,
  tenantModuleOptions,
  tenantTree,
} from "@/test/msw/org-fixtures";
import {
  type OrgWorldOptions,
  orgWorld,
} from "@/test/msw/org-manager-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import { ORG_MANAGER_PERMISSIONS } from "./org-manager-permissions";

const OWN_PERMISSIONS = [
  ORG_MANAGER_PERMISSIONS.view,
  ORG_MANAGER_PERMISSIONS.createChild,
  ORG_MANAGER_PERMISSIONS.edit,
  ORG_MANAGER_PERMISSIONS.toggleEnabled,
  ORG_MANAGER_PERMISSIONS.move,
  ORG_MANAGER_PERMISSIONS.delete,
];

const TENANT_OPS_PERMISSIONS = [
  ORG_MANAGER_PERMISSIONS.provision,
  ORG_MANAGER_PERMISSIONS.transferOwner,
  ORG_MANAGER_PERMISSIONS.setVisibility,
];

const USER_VIEW_PERMISSION = "system.user-manager.view";

const modulesWith = (permissions: readonly string[]): TestModule[] => [
  overviewModule,
  {
    id: "m-system",
    key: "system",
    name: "系統管理",
    parentId: null,
    sidebarType: ModuleSidebarType.Group,
    order: 1,
    route: "/system",
    permissions: [],
  },
  {
    id: "m-org",
    key: "system.org-manager",
    name: "組織管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 1,
    route: "/system/org-manager",
    permissions: permissions.filter((key) => !key.includes("tenant-ops")),
  },
  {
    id: "m-tenant-ops",
    key: "system.org-manager.tenant-ops",
    name: "租戶作業",
    parentId: "m-org",
    sidebarType: ModuleSidebarType.Hidden,
    order: 1,
    route: null,
    permissions: permissions.filter((key) => key.includes("tenant-ops")),
  },
  {
    id: "m-user",
    key: "system.user-manager",
    name: "使用者管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 2,
    route: "/system/user-manager",
    permissions: permissions.includes(USER_VIEW_PERMISSION)
      ? [USER_VIEW_PERMISSION]
      : [],
  },
];

const renderPage = ({
  permissions = [
    ...OWN_PERMISSIONS,
    ...TENANT_OPS_PERMISSIONS,
    USER_VIEW_PERMISSION,
  ],
  world = {},
}: {
  permissions?: readonly string[];
  world?: OrgWorldOptions;
} = {}) => {
  const fake = orgWorld({
    orgTree: rootTree,
    orgs: orgDetails,
    users: orgUsers,
    moduleOptions: tenantModuleOptions,
    ...world,
  });
  server.use(
    ...fake.handlers,
    ...authWorld({
      hasRefreshCookie: true,
      modules: modulesWith(permissions),
    }).handlers,
  );
  return { ...renderApp({ path: "/system/org-manager" }), fake };
};

/** 樹與資料區都有組織名稱(側欄的組織切換器也是),查詢一律先收斂到其中一邊。 */
const orgTree = () => screen.getByRole("tree", { name: "組織樹" });
const detail = () => screen.getByRole("region", { name: "組織資料" });

/** 節點自己的標籤(不含子孫:treeitem 的 textContent 會把整棵子樹串進來)。 */
const labelOf = (item: Element) =>
  item.querySelector(".MuiTreeItem-label")?.textContent ?? "";

const treeItem = (name: string) =>
  within(orgTree())
    .getAllByRole("treeitem")
    .find((item) => labelOf(item).startsWith(name));

const treeLabel = (name: string) => {
  const item = treeItem(name);
  return item === undefined ? undefined : labelOf(item);
};

/**
 * 樹是先渲染骨架、資料後到的;載入完成時 MUI 會換掉整個樹根元素,
 * 所以每次輪詢都要重新查(抓住舊的那顆會永遠等不到)。
 */
const waitForTree = async () => {
  await waitFor(() => {
    expect(within(orgTree()).getByText("A-1 內容組")).toBeInTheDocument();
  });
};

/**
 * 點一個節點。MUI 的樹**點內容區等於同時選取與展開 / 收合**(預設的 expansionTrigger),
 * 所以點過的節點會收起來 — 測試不要在點完某個節點之後再去找它的子節點。
 */
const clickNode = async (
  actor: { click: (element: Element) => Promise<void> },
  name: string,
) => {
  await actor.click(await within(orgTree()).findByText(name));
};

/**
 * `jest-fixed-jsdom` 補回來的 `URL` 是 Node 的:`createObjectURL` 只收 Node 的 Blob,
 * 餵 jsdom 的 File 會丟型別錯,讓 `UploadField` 的預覽在 render 期整個炸掉。
 * 預覽不是這一頁要驗的行為,測試期間給一個固定網址即可。
 */
const realUrlMethods = {
  createObjectURL: URL.createObjectURL.bind(URL),
  revokeObjectURL: URL.revokeObjectURL.bind(URL),
};

beforeAll(() => {
  URL.createObjectURL = () => "blob:logo-preview";
  URL.revokeObjectURL = () => {
    // 預覽網址是假的,不用釋放
  };
});

afterAll(() => {
  URL.createObjectURL = realUrlMethods.createObjectURL;
  URL.revokeObjectURL = realUrlMethods.revokeObjectURL;
});

describe("組織管理頁(/system/org-manager)", () => {
  it("根組織視角:樹以根組織為根、租戶與停用各自帶標籤,預設選中樹根", async () => {
    renderPage();

    await waitForTree();
    expect(treeLabel("租戶 A")).toBe("租戶 A租戶");
    expect(treeLabel("A-2 台北分店")).toBe("A-2 台北分店停用");
    // 可見範圍外的節點顯示但不可選(ADR-0005)
    expect(treeItem("租戶 B")?.getAttribute("aria-disabled")).toBe("true");
    // 預設選中的樹根是根組織 → 它是系統組織,停用與刪除都停用
    expect(await within(detail()).findByText("啟用中")).toBeInTheDocument();
    expect(
      within(detail()).getByRole("button", { name: "停用" }),
    ).toBeDisabled();
    expect(
      within(detail()).getByRole("button", { name: "刪除" }),
    ).toBeDisabled();
  });

  it("租戶視角:樹根是租戶頂層、沒有租戶標籤,也沒有開通租戶按鈕", async () => {
    renderPage({
      permissions: OWN_PERMISSIONS,
      world: { orgTree: tenantTree },
    });

    await waitForTree();
    expect(treeLabel("租戶 A")).toBe("租戶 A");
    expect(
      screen.queryByRole("button", { name: "開通租戶" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "+ 子組織" }),
    ).toBeInTheDocument();
  });

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

  it("編輯彈窗:租戶頂層 + 持 tenant-ops 才有擁有者與可見範圍兩欄", async () => {
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

  it("編輯彈窗:沒有 tenant-ops 權限時,租戶頂層也看不到那兩欄", async () => {
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
