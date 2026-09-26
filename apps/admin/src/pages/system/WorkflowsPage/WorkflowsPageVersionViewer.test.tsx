import { beforeAll, describe, expect, it } from "@jest/globals";
import { fireEvent, screen, within } from "@testing-library/react";

import { setupReactFlowEnvironment } from "@/test/react-flow";

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

const openVersion = async (
  user: ReturnType<typeof renderWorkflows>["user"],
): Promise<HTMLElement> => {
  await user.click(screen.getByRole("tab", { name: "流程版本" }));
  const table = await screen.findByRole("table", { name: "流程版本" });
  await user.click(
    await within(table).findByRole("button", { name: "檢視 v1" }),
  );
  return screen.findByRole("region", { name: "檢視 v1(唯讀)" });
};

describe("流程管理:唯讀檢視已發布的版本", () => {
  it("「檢視 v1」:節點可選、屬性面板可看不可改、沒有存草稿;關閉後草稿的未存變更還在", async () => {
    const { user } = renderWorkflows();
    const canvas = await findCanvas();
    // 草稿先改一個名稱(不存)
    clickNode(canvas, "人資");
    fireEvent.change(
      within(propertiesPanel()).getByRole("textbox", { name: "名稱" }),
      { target: { value: "人資部" } },
    );

    const viewer = await openVersion(user);
    const versionCanvas = within(viewer).getByRole("region", {
      name: "v1 的流程圖",
    });
    await within(versionCanvas).findByRole("group", { name: "直屬主管" });
    clickNode(versionCanvas, "人資");
    const panel = within(viewer).getByRole("region", { name: "屬性(唯讀)" });
    expect(within(panel).getByRole("textbox", { name: "名稱" })).toBeDisabled();
    expect(
      within(panel).queryByRole("button", { name: "刪除此關" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "存草稿" })).toBeNull();
    // 已經有草稿:不能以這一版開新草稿,只提示
    expect(
      within(viewer).queryByRole("button", { name: "以 v1 為基底開新草稿" }),
    ).toBeNull();
    expect(
      within(viewer).getByText(
        "已經有草稿了:要以這一版為基底,請先發布或刪除目前的草稿。",
      ),
    ).toBeInTheDocument();

    await user.click(within(viewer).getByRole("button", { name: "關閉檢視" }));

    expect(screen.queryByRole("region", { name: "檢視 v1(唯讀)" })).toBeNull();
    expect(screen.getByText("有未存的變更")).toBeInTheDocument();
    expect(
      within(propertiesPanel()).getByRole("textbox", { name: "名稱" }),
    ).toHaveValue("人資部");
  });

  it("沒有草稿時:唯讀檢視旁「以 v1 為基底開新草稿」", async () => {
    const options = defaultDesignOptions();
    const { user, world } = renderWorkflows({
      world: {
        ...options,
        workflows: (options.workflows ?? []).map((workflow) => ({
          ...workflow,
          hasDraft: false,
        })),
        versions: {
          leave_review: (options.versions?.leave_review ?? []).filter(
            (item) => item.version !== null,
          ),
        },
      },
    });
    await screen.findByRole("button", { name: "開新草稿" });
    const viewer = await openVersion(user);

    await user.click(
      within(viewer).getByRole("button", { name: "以 v1 為基底開新草稿" }),
    );

    expect(world.inputs.createDraft).toEqual([
      { workflowKey: "leave_review", baseVersion: 1 },
    ]);
    expect(
      await screen.findByRole("region", { name: "流程圖" }),
    ).toBeInTheDocument();
  });
});
