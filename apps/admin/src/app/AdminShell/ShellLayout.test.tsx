import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";

import { renderFormsPage } from "@/pages/system/FormsPage/forms-page-test-support";
import { authWorld } from "@/test/msw/auth-handlers";
import { superAdminModules } from "@/test/msw/module-fixtures";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import { shellContentMinWidth } from "./shell-geometry";

/** 主題斷點(MUI 預設,`packages/ui` 的 theme 沒改):lg 1200、xl 1536。 */
const LG = 1200;
const XL = 1536;
/** 測試用的 spacing:1 單位 = 8px(與 theme 相同),回 px 字串以便換算。 */
const spacing = (units: number) => `${String(units * 8)}px`;
const SPACING_PX = 8;
const NAV_PX = 30 * SPACING_PX;
const NAV_COLLAPSED_PX = 8 * SPACING_PX;
const MAIN_PADDING_PX = 4 * SPACING_PX;

/** `calc(Apx - Bpx - Cpx)` → A − B − C。 */
const pxOf = (expression: string): number => {
  const [first = 0, ...rest] = expression
    .replace("calc(", "")
    .replace(")", "")
    .split(" - ")
    .map((part) => Number.parseFloat(part));
  return rest.reduce((total, value) => total - value, first);
};

/**
 * 視窗寬 `viewport` 時,`<main>` 會不會水平捲:內容區可用寬 = 視窗 − 側欄 − 內距,
 * 比內容最小寬度窄就捲(`<main>` 的 `overflow: auto`)。
 */
const mainScrollsAt = (
  viewport: number,
  breakpoint: number,
  isNavCollapsed: boolean,
): boolean => {
  const nav = isNavCollapsed ? NAV_COLLAPSED_PX : NAV_PX;
  const available = viewport - nav - MAIN_PADDING_PX * 2;
  return (
    available < pxOf(shellContentMinWidth(breakpoint, spacing, isNavCollapsed))
  );
};

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
  it("一般頁(lg):1100px 視窗要捲、1300px 不捲;設計器頁(xl):1300px 要捲、1600px 不捲", () => {
    expect(mainScrollsAt(1100, LG, false)).toBe(true);
    expect(mainScrollsAt(1300, LG, false)).toBe(false);
    expect(mainScrollsAt(1300, XL, false)).toBe(true);
    expect(mainScrollsAt(1600, XL, false)).toBe(false);
  });

  it("側欄收合時最小寬度跟著重算:收合前後都是「視窗 ≥ 斷點就不捲」,不會因為側欄變窄多出捲軸", () => {
    for (const isNavCollapsed of [false, true]) {
      expect(mainScrollsAt(LG, LG, isNavCollapsed)).toBe(false);
      expect(mainScrollsAt(LG - 1, LG, isNavCollapsed)).toBe(true);
    }
    expect(pxOf(shellContentMinWidth(LG, spacing, true))).toBe(
      LG - NAV_COLLAPSED_PX - MAIN_PADDING_PX * 2,
    );
  });

  it("殼層預設以 lg 為準,收合側欄後重算;document 本身沒有水平捲軸", async () => {
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
    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  it("表單管理(設計器頁)宣告 xl", async () => {
    renderFormsPage();

    await screen.findByRole("navigation", { name: "主選單" });
    expect(contentMinWidth()).toContain(`${String(XL)}px`);
  });
});
