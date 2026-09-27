import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import {
  clickNode,
  detail,
  renderPage,
  stubObjectUrl,
  waitForTree,
} from "./org-manager-test-support";

stubObjectUrl();

const SLUG_HINT =
  "小寫英文開頭,只能用小寫英文、數字、底線,長度 2–20;客製表單的代碼會以它當後綴。";
const SLUG_INVALID =
  "格式不符:小寫英文開頭,只能用小寫英文、數字、底線,長度 2–20。";

/** 打開開通彈窗,先把短碼以外的必填欄位填好。 */
const openAndFill = async (actor: {
  click: (el: Element) => Promise<void>;
  type: (el: Element, text: string) => Promise<void>;
}) => {
  await waitForTree();
  await actor.click(await screen.findByRole("button", { name: "開通租戶" }));
  await screen.findByRole("checkbox", { name: "系統管理" });
  await actor.type(screen.getByLabelText("租戶名稱 *"), "租戶 D");
  await actor.type(
    screen.getByLabelText("首任租戶管理員 Email *"),
    "admin@tenant-d.tw",
  );
};

/**
 * 開通彈窗的租戶短碼(`orgs.slug`,格式 `^[a-z][a-z0-9_]{1,19}$`,前後端同一條:
 * `@repo/domain/form` 的 `isValidOrgSlug`)。與 `OrgManagerPage.test.tsx` 同一頁、同一組夾具,
 * 分檔只是為了行數上限(REACT-07)。
 */
describe("組織管理頁:開通彈窗的租戶短碼", () => {
  it("沒填短碼時顯示格式說明、開通按不下去", async () => {
    const { user: actor } = renderPage();
    await openAndFill(actor);

    expect(screen.getByText(SLUG_HINT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "開通" })).toBeDisabled();
  });

  it("格式不符:欄位標錯、顯示格式錯誤提示,開通按不下去;改對了才送得出去", async () => {
    const { user: actor, fake } = renderPage();
    await openAndFill(actor);

    const slugField = screen.getByLabelText("租戶短碼 *");
    await actor.type(slugField, "Tenant-D");
    expect(slugField).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(SLUG_INVALID)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "開通" })).toBeDisabled();

    await actor.clear(slugField);
    await actor.type(slugField, "tenant_d");
    expect(slugField).not.toHaveAttribute("aria-invalid", "true");
    await actor.click(screen.getByRole("button", { name: "開通" }));
    await waitFor(() => {
      expect(fake.inputs.provisionTenant).toHaveLength(1);
    });
    expect(fake.inputs.provisionTenant[0]?.slug).toBe("tenant_d");
  });

  it("短碼已被別的租戶用(api 回 VALIDATION_FAILED、fields 含 slug)→ 標回短碼欄", async () => {
    const { user: actor } = renderPage({
      world: {
        failures: {
          ProvisionTenant: {
            code: "VALIDATION_FAILED",
            extensions: { fields: ["slug"] },
          },
        },
      },
    });
    await openAndFill(actor);

    const slugField = screen.getByLabelText("租戶短碼 *");
    await actor.type(slugField, "tenant_a");
    await actor.click(screen.getByRole("button", { name: "開通" }));

    expect(
      await screen.findByText("這個短碼已被其他租戶使用,請換一個。"),
    ).toBeInTheDocument();
    expect(slugField).toHaveAttribute("aria-invalid", "true");
  });
});

describe("組織管理頁:編輯租戶頂層的短碼(根組織專屬)", () => {
  it("改短碼:格式不符不能儲存;改成合法值後隨 updateOrg 一起送出", async () => {
    const { user: actor, fake } = renderPage();
    await waitForTree();
    await clickNode(actor, "租戶 A");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );

    const slugField = await screen.findByLabelText("租戶短碼 *");
    expect(slugField).toHaveValue("tenant_a");
    await actor.clear(slugField);
    await actor.type(slugField, "A");
    expect(screen.getByText(SLUG_INVALID)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "儲存" })).toBeDisabled();

    await actor.clear(slugField);
    await actor.type(slugField, "tenant_a2");
    await actor.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() => {
      expect(fake.inputs.updateOrg).toHaveLength(1);
    });
    expect(fake.inputs.updateOrg[0]?.slug).toBe("tenant_a2");
  });
});
