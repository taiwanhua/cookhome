import { beforeAll, describe, expect, it } from "@jest/globals";
import { fireEvent, screen, within } from "@testing-library/react";

import { workflowFragment } from "@/test/msw/workflow-fixtures";
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

describe("流程管理:清單與設計器", () => {
  it("左欄列出流程(客製 / 版本 / 綁定表單);右欄的流程圖畫出每一關", async () => {
    renderWorkflows({
      world: {
        ...defaultDesignOptions(),
        workflows: [
          workflowFragment({
            boundForms: [
              { formKey: "sick_leave", formName: "病假單", moduleKey: "leave" },
            ],
          }),
        ],
      },
    });

    const list = await screen.findByRole("list", { name: "流程清單" });
    expect(within(list).getByText("請假審核")).toBeInTheDocument();
    expect(within(list).getByText("客製")).toBeInTheDocument();
    expect(within(list).getByText("第 1 版")).toBeInTheDocument();
    expect(within(list).getByText("綁定表單:病假單")).toBeInTheDocument();
    const canvas = await findCanvas();
    expect(
      within(canvas).getByRole("group", { name: "人資" }),
    ).toBeInTheDocument();
  });

  // 審核者來源四種分三案驗(一案走完四種 + 存草稿,在全套並行的 CI 上會超過單一測試的 15 秒)
  it("點關卡 → 屬性面板;角色與主管(第幾層)都能選", async () => {
    const { user } = renderWorkflows();
    const canvas = await findCanvas();

    clickNode(canvas, "人資");
    const panel = propertiesPanel();
    const kind = within(panel).getByRole("combobox", { name: "審核者來源" });

    // 角色(客製流程:選本租戶的角色)
    await user.click(within(panel).getByRole("combobox", { name: "角色" }));
    await user.click(await screen.findByRole("option", { name: "人資" }));
    // 主管 → 第 2 層
    await user.click(kind);
    await user.click(await screen.findByRole("option", { name: "主管" }));
    await user.click(within(panel).getByRole("combobox", { name: "第幾層" }));
    await user.click(await screen.findByRole("option", { name: "第 2 層" }));

    expect(
      within(panel).getByRole("combobox", { name: "第幾層" }),
    ).toHaveTextContent("第 2 層");
  });

  it("指定使用者:客製流程可以選,出現使用者選擇器", async () => {
    const { user } = renderWorkflows();
    const canvas = await findCanvas();

    clickNode(canvas, "人資");
    const panel = propertiesPanel();
    await user.click(
      within(panel).getByRole("combobox", { name: "審核者來源" }),
    );
    await user.click(await screen.findByRole("option", { name: "指定使用者" }));

    expect(
      within(panel).getByRole("combobox", { name: "使用者" }),
    ).toBeInTheDocument();
  });

  it("表單欄位:從檢查用表單只列使用者引用欄;存草稿帶 expectedDraftRevision、整份定義與檢查用表單", async () => {
    const { user, world } = renderWorkflows();
    const canvas = await findCanvas();
    await user.click(screen.getByRole("combobox", { name: "檢查用表單" }));
    await user.click(await screen.findByRole("option", { name: "病假單" }));

    clickNode(canvas, "人資");
    const panel = propertiesPanel();
    await user.click(
      within(panel).getByRole("combobox", { name: "審核者來源" }),
    );
    await user.click(await screen.findByRole("option", { name: "表單欄位" }));
    await user.click(within(panel).getByRole("combobox", { name: "欄位" }));
    expect(
      screen.queryByRole("option", { name: "天數" }),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "代理主管" }));

    await user.click(screen.getByRole("button", { name: "存草稿" }));

    expect(await findSnackbarAlert()).toEqual({
      severity: "success",
      text: "已存草稿",
    });
    expect(world.inputs.saveDraft).toHaveLength(1);
    const [saved] = world.inputs.saveDraft;
    expect(saved.expectedDraftRevision).toBe(1);
    expect(saved.definition.edges ?? null).toBeNull();
    expect(saved.definition.steps[1]).toMatchObject({
      key: "hr",
      assignee: { kind: "field", formKey: "sick_leave", fieldKey: "approver" },
    });
    expect(saved.definition.checkFormKey).toBe("sick_leave");
  });

  it("共用流程不能選「指定使用者」,角色只能填佔位", async () => {
    const { user } = renderWorkflows({
      world: {
        ...defaultDesignOptions(),
        workflows: [workflowFragment({ isShared: true, ownerOrgId: null })],
      },
    });
    const canvas = await findCanvas();

    clickNode(canvas, "人資");
    const panel = propertiesPanel();
    expect(
      within(panel).getByRole("textbox", { name: "角色佔位" }),
    ).toHaveValue("人資");
    await user.click(
      within(panel).getByRole("combobox", { name: "審核者來源" }),
    );
    expect(
      await screen.findByRole("option", { name: "指定使用者" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("草稿已被別人更新 → 存草稿回 CONFLICT,提示並可重新載入", async () => {
    const { user } = renderWorkflows({
      world: {
        ...defaultDesignOptions(),
        failures: {
          SaveWorkflowVersionDraft: {
            code: "CONFLICT",
            extensions: { reason: "DRAFT_REVISION_MISMATCH" },
          },
        },
      },
    });
    const canvas = await findCanvas();
    clickNode(canvas, "人資");
    await user.click(
      within(propertiesPanel()).getByRole("button", { name: "在後面加一關" }),
    );

    await user.click(screen.getByRole("button", { name: "存草稿" }));

    expect(
      await screen.findByText("草稿已被別人更新,請重新載入。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新載入" }),
    ).toBeInTheDocument();
  });

  it("檢查器即時跑:錯誤定位到關卡,點一下選中那一關", async () => {
    const { user } = renderWorkflows();
    const canvas = await findCanvas();
    // 客製流程的角色關卡沒選角色 → ROLE_ID_MISSING(domain 的檢查器)
    const issues = await screen.findByRole("region", { name: "檢查結果" });
    const issue = await within(issues).findByText(/人資/, {
      selector: ".MuiListItemText-secondary",
    });

    await user.click(issue);

    expect(
      within(propertiesPanel()).getByRole("textbox", { name: "名稱" }),
    ).toHaveValue("人資");
    expect(
      within(canvas).getByRole("group", { name: "人資" }),
    ).toBeInTheDocument();
  });

  it("鍵盤:聚焦節點按 Enter 就選中,屬性面板打開", async () => {
    renderWorkflows();
    const canvas = await findCanvas();
    const node = canvas.querySelector<HTMLElement>(
      '.react-flow__node[data-id="hr"]',
    );
    if (node === null) {
      throw new Error("找不到人資節點");
    }

    node.focus();
    fireEvent.keyDown(node, { key: "Enter" });

    expect(
      await within(propertiesPanel()).findByRole("textbox", { name: "名稱" }),
    ).toHaveValue("人資");
  });

  it("表單超過一頁(100 筆)→ 提示清單已截斷", async () => {
    renderWorkflows({ catalog: { formsTotal: 150 } });
    await findCanvas();

    expect(
      await screen.findByText("表單或角色超過 100 筆,清單已截斷,請縮小範圍。"),
    ).toBeInTheDocument();
  });
});
