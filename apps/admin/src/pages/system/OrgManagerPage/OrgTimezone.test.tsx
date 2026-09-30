import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { orgDetails, tenantTree } from "@/test/msw/org-fixtures";

import {
  OWN_PERMISSIONS,
  SET_TIMEZONE_PERMISSION,
  clickNode,
  detail,
  renderPage,
  stubObjectUrl,
  waitForTree,
} from "./org-manager-test-support";

stubObjectUrl();

const UNSET = "未設定(使用預設 Asia/Taipei)";

/** 打開租戶頂層「租戶 A」的編輯彈窗(租戶視角:樹根就是租戶 A)。 */
const openTenantEdit = async (actor: {
  click: (element: Element) => Promise<void>;
}) => {
  await waitForTree();
  await clickNode(actor, "租戶 A");
  await actor.click(
    await within(detail()).findByRole("button", { name: "編輯" }),
  );
  return screen.findByRole("combobox", { name: "時區" });
};

/**
 * 編輯彈窗的「時區」欄(根組織與租戶頂層;權限 `system.org-manager.set-timezone`)。
 * 選項是瀏覽器 `Intl.supportedValuesOf("timeZone")` 的完整清單;儲存走同一個彈窗的儲存流程。
 */
describe("組織管理頁:根組織與租戶頂層的時區", () => {
  it("選項是完整的 IANA 清單,輸入即過濾(含 Europe/London);沒設時說明退回預設時區", async () => {
    const { user: actor } = renderPage({
      permissions: [...OWN_PERMISSIONS, SET_TIMEZONE_PERMISSION],
      world: { orgTree: tenantTree },
    });

    const timezone = await openTenantEdit(actor);
    expect(timezone).toHaveValue("");
    expect(screen.getByText(UNSET)).toBeInTheDocument();

    await actor.click(timezone);
    await actor.type(timezone, "London");
    expect(
      await screen.findByRole("option", { name: "Europe/London" }),
    ).toBeInTheDocument();
  });

  it("選了時區按儲存:送 setOrgTimezone,重查後再開彈窗看得到新值", async () => {
    const { user: actor, fake } = renderPage({
      permissions: [...OWN_PERMISSIONS, SET_TIMEZONE_PERMISSION],
      world: { orgTree: tenantTree },
    });

    const timezone = await openTenantEdit(actor);
    await actor.click(timezone);
    await actor.type(timezone, "Europe/Lon");
    await actor.click(
      await screen.findByRole("option", { name: "Europe/London" }),
    );
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.setOrgTimezone).toHaveLength(1);
    });
    expect(fake.inputs.setOrgTimezone[0]).toEqual({
      orgId: "org-tenant-a",
      timezone: "Europe/London",
    });
    // 只動時區:其他 mutation 一支都不送
    expect(fake.inputs.updateOrg).toHaveLength(0);
    expect(fake.inputs.setOrgVisibility).toHaveLength(0);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const reopened = await openTenantEdit(actor);
    await waitFor(() => {
      expect(reopened).toHaveValue("Europe/London");
    });
  });

  it("根組織的編輯彈窗也有時區欄(沒有可見範圍開關),儲存送 setOrgTimezone", async () => {
    const { user: actor, fake } = renderPage();

    await waitForTree();
    await clickNode(actor, "CookHome");
    await actor.click(
      await within(detail()).findByRole("button", { name: "編輯" }),
    );
    const timezone = await screen.findByRole("combobox", { name: "時區" });
    // 可見範圍開關仍只給租戶頂層
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();

    await actor.click(timezone);
    await actor.type(timezone, "Europe/Lon");
    await actor.click(
      await screen.findByRole("option", { name: "Europe/London" }),
    );
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.setOrgTimezone).toHaveLength(1);
    });
    expect(fake.inputs.setOrgTimezone[0]).toEqual({
      orgId: "org-root",
      timezone: "Europe/London",
    });
  });

  it("沒有 set-timezone:時區欄唯讀顯示目前值,改不動", async () => {
    // 租戶 A 已設時區:唯讀時要看得到那個值,而不是「未設定」
    const { user: actor } = renderPage({
      permissions: OWN_PERMISSIONS,
      world: {
        orgTree: tenantTree,
        orgs: orgDetails.map((org) =>
          org.id === "org-tenant-a"
            ? { ...org, timezone: "Europe/London" }
            : org,
        ),
      },
    });

    const timezone = await openTenantEdit(actor);
    expect(timezone).toBeDisabled();
    expect(timezone).toHaveValue("Europe/London");
    expect(screen.queryByText(UNSET)).not.toBeInTheDocument();
  });
});
