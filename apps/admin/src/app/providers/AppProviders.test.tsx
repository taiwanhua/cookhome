import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";

import { projectPublic } from "@repo/project-config/public";

import { authHandlers, authWorld } from "@/test/msw/auth-handlers";
import { server } from "@/test/msw/server";
import { primaryMainOf } from "@/test/primary-color";
import { renderApp } from "@/test/render";

/**
 * 正式接線(專案設定 → 字典 / 主題):畫面上的品牌名與主色就是目前專案設定的值。
 * 這裡不寫任何專案的字面值,換專案不必改本檔。固定值的對照組:
 * `AppProviders.legacy-project.test.tsx`(CookHome 原輸出)、`AppProviders.alt-project.test.tsx`(替代品牌)。
 */
describe("AppProviders:品牌名與主色來自目前的專案設定", () => {
  const brandName = projectPublic.brand.name;

  it("登入頁顯示品牌名,頁腳帶同一個品牌名", async () => {
    server.use(...authHandlers());

    renderApp({ path: "/login" });

    expect(
      await screen.findByRole("heading", { name: brandName }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `© ${String(new Date().getFullYear())} ${brandName} · 僅供授權人員使用`,
      ),
    ).toBeInTheDocument();
  });

  it("沒有當前組織時,側欄頂部退回品牌名", async () => {
    server.use(...authWorld({ hasRefreshCookie: true, orgs: [] }).handlers);

    renderApp({ path: "/" });
    const nav = await screen.findByRole("navigation", { name: "主選單" });

    expect(within(nav).getByText(brandName)).toBeInTheDocument();
  });

  it("主題主色是專案設定的 primary", async () => {
    server.use(...authHandlers());

    renderApp({ path: "/login" });
    await screen.findByRole("heading", { name: brandName });

    expect(primaryMainOf(document)?.toUpperCase()).toBe(
      projectPublic.brand.primary.toUpperCase(),
    );
  });
});
