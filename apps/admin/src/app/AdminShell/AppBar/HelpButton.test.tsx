import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { setHelpFiles } from "@/test/help-registry";
import { authWorld } from "@/test/msw/auth-handlers";
import {
  sampleTwoModules,
  superAdminModules,
} from "@/test/msw/module-fixtures";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

/**
 * AppBar 的「?」模組說明(#197)。內容來自 build 時打包的 `src/md/module-help/*.help.md`;
 * jest 沒有 `import.meta.glob`,測試看到的是 `src/test/help-registry.ts` 的假 registry
 * (jest.config.mjs 的 moduleNameMapper),所以斷言針對「有 / 沒有說明」的行為,不是 md 正本的字句。
 */
describe("模組說明「?」", () => {
  it("模組路由有對應的 help.md:點開彈窗,標題帶模組名,內文是渲染後的 Markdown", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: superAdminModules })
        .handlers,
    );

    // 用還沒有真頁面的模組(佔位頁),測試就不必連帶餵該頁的 GraphQL handler
    const { user } = renderApp({ path: "/system/role-manager" });
    const banner = await screen.findByRole("banner");
    const help = await within(banner).findByRole("button", {
      name: "模組說明",
    });
    expect(help).toBeEnabled();

    await user.click(help);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("模組說明 — 角色管理");
    // 內文是 Markdown 渲染的結果,不是原始碼:`##` 變成 heading、`-` 變成清單
    expect(
      within(dialog).getByRole("heading", { name: "這個模組做什麼" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
    expect(dialog).not.toHaveTextContent("## 這個模組做什麼");
    // 標題已經寫了模組名,內文不再重複一次 `# 組織管理`
    expect(
      within(dialog).queryByRole("heading", { level: 1 }),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "關閉" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("模組路由沒有對應的 help.md:按鈕 disabled,hover 提示「此頁尚無說明」", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    const { user } = renderApp({ path: "/demo/sample-two/edit-page" });
    const banner = await screen.findByRole("banner");
    const help = await within(banner).findByRole("button", {
      name: "模組說明",
    });

    expect(help).toBeDisabled();
    // 提示改用 @repo/ui 的 Tooltip(#240):停用的按鈕收不到 hover,
    // 事件載體是 Tooltip 自己包的外層 span
    const hintCarrier = help.parentElement;
    if (hintCarrier === null) {
      throw new Error("「?」按鈕沒有被 Tooltip 包起來");
    }
    await user.hover(hintCarrier);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "此頁尚無說明",
    );
  });

  it("非模組路由(側欄一頁都進不去 → 無權限頁)不顯示「?」", async () => {
    server.use(...authWorld({ hasRefreshCookie: true, modules: [] }).handlers);

    renderApp({ path: "/" });
    await screen.findByRole("heading", { name: "沒有權限進入此頁面" });

    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "模組說明",
      }),
    ).not.toBeInTheDocument();
  });

  it("help.md 換一份(模擬新增模組說明)就換一份內容,對照表以檔名的模組 key 為準", async () => {
    setHelpFiles({
      "/src/md/module-help/demo.sample-two.help.md":
        "# 示範模組2\n\n## 這個模組做什麼\n\n示範用的假模組。",
    });
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    const { user } = renderApp({ path: "/demo/sample-two" });
    const banner = await screen.findByRole("banner");

    await user.click(
      await within(banner).findByRole("button", { name: "模組說明" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("模組說明 — 示範模組2");
    expect(dialog).toHaveTextContent("示範用的假模組。");
  });
});
