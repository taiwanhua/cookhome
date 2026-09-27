import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";

import { renderFormsPage } from "@/pages/system/FormsPage/forms-page-test-support";
import { authWorld } from "@/test/msw/auth-handlers";
import { superAdminModules } from "@/test/msw/module-fixtures";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

/** 主題斷點(MUI 預設,`packages/ui` 的 theme 沒改):lg 1200、xl 1536。 */
const LG = 1200;
const XL = 1536;
/**
 * 內容區宣告的 CSS(emotion 插進 `<style>` 的規則原文)。jsdom 的 `getComputedStyle` 不套 `@media`
 * 也不算 `calc()`,所以直接讀宣告:非手機版面(`@media (min-width:600px)`)那條的 `min-width`。
 */
const contentMinWidth = (): string => {
  const classes = [...screen.getByTestId("shell-content").classList];
  const rules = [...document.styleSheets].flatMap((sheet) => [
    ...sheet.cssRules,
  ]);
  return rules
    .filter((rule) => rule.cssText.startsWith("@media (min-width:600px)"))
    .map((rule) => rule.cssText)
    .filter((text) => classes.some((name) => text.includes(`.${name} `)))
    .join("\n");
};

describe("殼的內容區最小寬度(主題斷點;視窗更窄時由內容區水平捲動)", () => {
  it("殼層預設以 lg 為準,收合側欄後重算;水平捲動只在 <main>,外框不捲", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: superAdminModules })
        .handlers,
    );
    const { user } = renderApp({ path: "/overview" });
    const nav = await screen.findByRole("navigation", { name: "主選單" });

    // 斷點 − 側欄(30 單位)− 左右內距(8 單位)
    const expanded = contentMinWidth();
    expect(expanded).toContain(`${String(LG)}px`);
    expect(expanded).toContain("30 * var(--mui-spacing)");

    await user.click(within(nav).getByRole("button", { name: "收合側欄" }));
    // 收合後側欄只剩 8 單位,最小寬度跟著變大(視窗 ≥ 斷點時仍放得下,不多出捲軸)
    const collapsed = contentMinWidth();
    expect(collapsed).toContain(`${String(LG)}px`);
    expect(collapsed).not.toContain("30 * var(--mui-spacing)");
    // 側欄(8 單位)與左右內距(8 單位)各一次
    expect(collapsed.split("(8 * var(--mui-spacing))")).toHaveLength(3);
    // 水平捲動只發生在 <main>:它自己 overflow: auto,殼的外框 overflow: hidden(document 不捲)
    const main = screen.getByRole("main");
    expect(globalThis.getComputedStyle(main).overflow).toBe("auto");
    const frame = main.parentElement?.parentElement ?? document.body;
    expect(globalThis.getComputedStyle(frame).overflow).toBe("hidden");
  });

  it("側欄收合時模組樹那一格不捲動(不出 x 捲軸),展開時才垂直捲動", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: superAdminModules })
        .handlers,
    );
    const { user } = renderApp({ path: "/overview" });
    const nav = await screen.findByRole("navigation", { name: "主選單" });
    const content = within(nav).getByTestId("side-nav-content");

    // 展開:選單長時這一格垂直捲動
    expect(globalThis.getComputedStyle(content).overflowY).toBe("auto");

    await user.click(within(nav).getByRole("button", { name: "收合側欄" }));
    // 收合:`overflow-y: auto` 會連帶讓 x 方向也捲(圖示格比欄內寬多 1px),一律裁在欄內
    const collapsed = globalThis.getComputedStyle(content);
    expect(collapsed.overflowY).not.toBe("auto");
    expect(collapsed.overflowX).not.toBe("auto");
    expect(collapsed.overflow).toBe("hidden");
  });

  it("表單管理(設計器頁)宣告 xl", async () => {
    renderFormsPage();

    await screen.findByRole("navigation", { name: "主選單" });
    expect(contentMinWidth()).toContain(`${String(XL)}px`);
  });
});
