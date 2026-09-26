import { beforeAll, describe, expect, it } from "@jest/globals";
import { fireEvent, screen, within } from "@testing-library/react";

import { setupReactFlowEnvironment } from "@/test/react-flow";
import { findSnackbarAlert } from "@/test/snackbar";

import {
  clickNode,
  defaultDesignOptions,
  findCanvas,
  propertiesPanel,
  renderWorkflows,
} from "./workflows-page-test-support";

setupReactFlowEnvironment();

beforeAll(async () => {
  // 懶載入頁面的依賴鏈(React Flow、dagre、檢查器)先載好,不算進 findBy* 的等待(TEST-08)
  await import("./WorkflowsPage");
});

const versionsTable = async (
  user: ReturnType<typeof renderWorkflows>["user"],
): Promise<HTMLElement> => {
  await user.click(screen.getByRole("tab", { name: "流程版本" }));
  return screen.findByRole("table", { name: "流程版本" });
};

describe("流程管理:刪除草稿", () => {
  it("版本面板「刪除草稿」→ 確認跳窗 → 刪除帶草稿修訂號;設計頁籤回到「開新草稿」", async () => {
    const { user, world } = renderWorkflows();
    await findCanvas();
    const table = await versionsTable(user);

    await user.click(
      await within(table).findByRole("button", { name: "刪除草稿" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "刪除草稿" });
    // 取消不刪
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(world.inputs.deleteDraft).toHaveLength(0);

    await user.click(within(table).getByRole("button", { name: "刪除草稿" }));
    const confirm = await screen.findByRole("dialog", { name: "刪除草稿" });
    await user.click(within(confirm).getByRole("button", { name: "刪除" }));

    expect(await findSnackbarAlert()).toEqual({
      severity: "success",
      text: "已刪除草稿",
    });
    expect(world.inputs.deleteDraft).toEqual([
      { workflowKey: "leave_review", expectedDraftRevision: 1 },
    ]);
    await user.click(screen.getByRole("tab", { name: "流程設計" }));
    expect(
      await screen.findByRole("button", { name: "開新草稿" }),
    ).toBeInTheDocument();
  });

  it("設計器有未存的變更:確認跳窗提醒改動也會丟掉", async () => {
    const { user } = renderWorkflows();
    const canvas = await findCanvas();
    clickNode(canvas, "人資");
    fireEvent.change(
      within(propertiesPanel()).getByRole("textbox", { name: "名稱" }),
      { target: { value: "人資部" } },
    );
    const table = await versionsTable(user);

    await user.click(within(table).getByRole("button", { name: "刪除草稿" }));

    const dialog = await screen.findByRole("dialog", { name: "刪除草稿" });
    expect(
      within(dialog).getByText("設計器裡還有未存的變更,也會一起丟掉。"),
    ).toBeInTheDocument();
  });

  it("草稿已被別人更新(修訂號不符)→ 提示重新載入,草稿還在", async () => {
    const options = defaultDesignOptions();
    const { user, world } = renderWorkflows({
      world: {
        ...options,
        failures: {
          DeleteWorkflowVersionDraft: {
            code: "CONFLICT",
            extensions: { reason: "DRAFT_REVISION_MISMATCH" },
          },
        },
      },
    });
    await findCanvas();
    const table = await versionsTable(user);
    await user.click(
      await within(table).findByRole("button", { name: "刪除草稿" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "刪除草稿" });

    await user.click(within(dialog).getByRole("button", { name: "刪除" }));

    expect(await findSnackbarAlert()).toEqual({
      severity: "error",
      text: "草稿已被別人更新,請重新載入。",
    });
    expect(world.inputs.deleteDraft).toHaveLength(1);
  });
});
