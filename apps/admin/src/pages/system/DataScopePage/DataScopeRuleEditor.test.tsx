import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import {
  chooseOption,
  comboboxAt,
  editor,
  renderPage,
  waitForEditor,
} from "./data-scope-test-support";

/** 每個測試都從「加一條新規則」開始:新規則預設是第一個欄位(狀態,enum)的一條條件列。 */
const startRule = async (actor: { click: (element: Element) => Promise<void> }) => {
  await waitForEditor("示範項目(demo_items_one)");
  await actor.click(screen.getByRole("button", { name: "+ 新增規則" }));
};

describe("條件樹編輯器(資料範圍)", () => {
  it("目錄驅動:換欄位就換掉運算子清單與值的控制項", async () => {
    const { user: actor } = renderPage();
    await startRule(actor);

    // enum 欄位:運算子是屬於 / 不屬於,值是種子宣告的固定選項
    expect(comboboxAt("欄位")).toHaveTextContent("狀態");
    expect(comboboxAt("條件")).toHaveTextContent("屬於");
    await actor.click(comboboxAt("值"));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["草稿", "已發布"]);
    await actor.keyboard("{Escape}");

    // 換成日期欄位:運算子變成之間 / 之前 / 之後,值換成日期輸入(「之間」兩格)
    await chooseOption(actor, comboboxAt("欄位"), "建立時間");
    expect(comboboxAt("條件")).toHaveTextContent("之間");
    // MUI X 的日期欄位把 label 連到多個節點(欄位容器與各個區段),所以用 getAll
    expect(within(editor()).getAllByLabelText("起日").length).toBeGreaterThan(0);
    expect(within(editor()).getAllByLabelText("迄日").length).toBeGreaterThan(0);

    await chooseOption(actor, comboboxAt("條件"), "之後");
    expect(within(editor()).getAllByLabelText("值").length).toBeGreaterThan(0);
    expect(within(editor()).queryAllByLabelText("迄日")).toHaveLength(0);

    // 換成使用者欄位:值的下拉多了動態值
    await chooseOption(actor, comboboxAt("欄位"), "建立者");
    expect(comboboxAt("條件")).toHaveTextContent("屬於");
    await actor.click(comboboxAt("值"));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toContain("【操作者本人】");
  });

  it("套用對象:角色與使用者是清單多選,組織用組織樹", async () => {
    const { user: actor } = renderPage();
    await startRule(actor);

    await chooseOption(actor, comboboxAt("套用對象"), "角色");
    await actor.click(comboboxAt("對象"));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["客服", "編輯"]);
    await actor.keyboard("{Escape}");

    await chooseOption(actor, comboboxAt("套用對象"), "組織");
    expect(
      await within(editor()).findByRole("tree", { name: "組織" }),
    ).toBeInTheDocument();
  });

  it("動態值【操作者本人】存成佔位符,送出的 payload 與正本形狀一致", async () => {
    const { user: actor, fake } = renderPage();
    await startRule(actor);

    await chooseOption(actor, comboboxAt("套用對象"), "角色");
    await chooseOption(actor, comboboxAt("對象"), "客服");
    await actor.keyboard("{Escape}");
    await chooseOption(actor, comboboxAt("欄位"), "建立者");
    await chooseOption(actor, comboboxAt("值"), "【操作者本人】");
    await actor.keyboard("{Escape}");
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.saveDataScopeRule).toHaveLength(1);
    });
    expect(fake.inputs.saveDataScopeRule[0]).toEqual({
      collection: "demo_items_one",
      combineOp: "OR",
      rules: [
        {
          audience: { type: "ROLE", ids: ["role-support"] },
          filter: {
            op: "AND",
            children: [
              {
                field: "createdBy",
                cond: "in",
                value: { kind: "dynamic", ref: "current-user" },
              },
            ],
          },
        },
      ],
    });
  });

  it("巢狀群組最多三層:第三層不再給「+ 群組」,送出的 filter 也是三層", async () => {
    const { user: actor, fake } = renderPage();
    await startRule(actor);

    await chooseOption(actor, comboboxAt("值"), "草稿");
    await actor.keyboard("{Escape}");

    // 第二層
    await actor.click(screen.getAllByRole("button", { name: "+ 群組" })[0]);
    await chooseOption(actor, comboboxAt("值", 1), "已發布");
    await actor.keyboard("{Escape}");
    // 第三層:子群組的「+ 群組」在 DOM 上排在根群組的前面(根的動作列在所有子節點之後)
    await actor.click(screen.getAllByRole("button", { name: "+ 群組" })[0]);
    await chooseOption(actor, comboboxAt("值", 2), "草稿");
    await actor.keyboard("{Escape}");

    expect(within(editor()).getAllByRole("combobox", { name: "群組組合" })).toHaveLength(2);
    // 第三層的群組不再給「+ 群組」(UI 上限三層),但「+ 條件」還在
    expect(screen.getAllByRole("button", { name: "+ 群組" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "+ 條件" })).toHaveLength(3);

    await actor.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() => {
      expect(fake.inputs.saveDataScopeRule).toHaveLength(1);
    });
    expect(fake.inputs.saveDataScopeRule[0]?.rules[0]?.filter).toEqual({
      op: "AND",
      children: [
        {
          field: "status",
          cond: "in",
          value: { kind: "static", values: ["draft"] },
        },
        {
          op: "AND",
          children: [
            {
              field: "status",
              cond: "in",
              value: { kind: "static", values: ["published"] },
            },
            {
              op: "AND",
              children: [
                {
                  field: "status",
                  cond: "in",
                  value: { kind: "static", values: ["draft"] },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("本地驗證先擋:沒填值就按儲存不會送出,錯誤標在那一列", async () => {
    const { user: actor, fake } = renderPage();
    await startRule(actor);

    await actor.click(screen.getByRole("button", { name: "儲存" }));

    expect(
      await within(editor()).findByText("請填一個有效的值。"),
    ).toBeInTheDocument();
    expect(fake.inputs.saveDataScopeRule).toHaveLength(0);
  });

  it("api 的 RULE_INVALID 標到 path 指到的那一列,不是第一列", async () => {
    const { user: actor, fake } = renderPage({
      world: {
        failures: {
          SaveDataScopeRule: {
            code: "RULE_INVALID",
            extensions: {
              path: "rules[0].filter.children[1].value.values[0]",
              reason: "VALUE_INVALID",
            },
          },
        },
      },
    });
    await startRule(actor);

    await chooseOption(actor, comboboxAt("值"), "草稿");
    await actor.keyboard("{Escape}");
    await actor.click(screen.getByRole("button", { name: "+ 條件" }));
    await chooseOption(actor, comboboxAt("欄位", 1), "建立者");
    await chooseOption(actor, comboboxAt("值", 1), "【操作者本人】");
    await actor.keyboard("{Escape}");

    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.saveDataScopeRule).toHaveLength(1);
    });
    // 錯誤只出現一次,而且是在 children[1](建立者)那一列,不是第一列(狀態)
    expect(
      await within(editor()).findByText("請填一個有效的值。"),
    ).toBeInTheDocument();
    expect(within(editor()).getAllByText("請填一個有效的值。")).toHaveLength(1);
    expect(comboboxAt("值", 1)).toHaveAttribute("aria-invalid", "true");
    expect(comboboxAt("值", 0)).not.toHaveAttribute("aria-invalid", "true");
    expect(
      within(editor()).getByText(
        "規則不合法,請依畫面上標出的位置修正後再儲存。",
      ),
    ).toBeInTheDocument();
  });

  it("儲存成功後左清單的「已設規則」亮起來(該 collection 的規則被失效重查)", async () => {
    const { user: actor } = renderPage();
    await startRule(actor);

    await chooseOption(actor, comboboxAt("值"), "草稿");
    await actor.keyboard("{Escape}");
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(
        within(screen.getByRole("list", { name: "資料目標" })).getAllByRole(
          "button",
        )[0],
      ).toHaveTextContent("已設規則");
    });
  });
});
