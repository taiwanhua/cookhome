import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { findSnackbarAlert, querySnackbar } from "@/test/snackbar";

import { renderPage, rowOf } from "./user-manager-test-support";

/**
 * 操作結果提示(#376):使用者管理頁的成功與失敗各一案。
 * 「一律跳一則」的規則在 `docs/standards/react/data-fetching.md` DATA-06。
 */
describe("使用者管理頁的操作結果提示", () => {
  it("停用成功 → 跳「已停用這位使用者。」", async () => {
    const { user: actor, fake } = renderPage();

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "停用" }),
    );
    // 一開始不該有提示(還沒送出)
    expect(querySnackbar()).toBeNull();
    await actor.click(
      screen.getByRole("button", { name: "停用", hidden: false }),
    );

    await waitFor(() => {
      expect(fake.inputs.setUserEnabled).toHaveLength(1);
    });
    expect(await findSnackbarAlert()).toEqual({
      text: "已停用這位使用者。",
      severity: "success",
    });
  });

  it("停用失敗 → 跳失敗提示,彈窗內原本那一條錯誤仍然留著", async () => {
    const { user: actor } = renderPage({
      world: { failures: { SetUserEnabled: "OWNER_PROTECTED" } },
    });

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "停用" }),
    );
    await actor.click(
      screen.getByRole("button", { name: "停用", hidden: false }),
    );

    const message = "頂層組織的擁有者受保護,這個動作被拒絕。";
    expect(await findSnackbarAlert()).toEqual({
      text: message,
      severity: "error",
    });
    // Snackbar 不取代彈窗內的錯誤顯示:兩者並存(DATA-06)。只比全頁文字數不準 ——
    // 彈窗開著時 provider 另有一份補念的 live region(#430),所以直接在彈窗裡找那一條
    expect(within(screen.getByRole("dialog")).getByText(message)).toBeVisible();
  });
});
