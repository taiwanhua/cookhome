import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

import { Tree, type TreeNode } from "./Tree";

const items: TreeNode[] = [
  {
    id: "root",
    label: "CookHome",
    children: [
      { id: "org-1", label: "台北分店" },
      { id: "org-2", label: "高雄分店", disabled: true },
    ],
  },
];

/** 節點左側的展開箭頭;不可展開的節點沒有。 */
const arrowOf = (label: string) =>
  screen
    .getAllByRole("treeitem")
    .find((item) => item.textContent.startsWith(label))
    ?.querySelector(".MuiTreeItem-iconContainer svg") ?? null;

/** 以標籤開頭找一列;找不到就讓測試直接失敗(比 optional chaining 的空斷言好讀)。 */
const rowOf = (label: string): HTMLElement => {
  const row = screen
    .getAllByRole("treeitem")
    .find((item) => item.textContent.startsWith(label));
  if (row === undefined) {
    throw new Error(`找不到「${label}」這一列`);
  }
  return row;
};

/** 某一列自己的核取方塊(DOM 上是該列的第一個 input)。 */
const checkboxOf = (label: string): HTMLInputElement => {
  const checkbox = rowOf(label).querySelector<HTMLInputElement>(
    "input[type='checkbox']",
  );
  if (checkbox === null) {
    throw new Error(`「${label}」這一列沒有核取方塊`);
  }
  return checkbox;
};

describe("Tree", () => {
  it("依 items 渲染節點,展開後看得到子節點", () => {
    render(<Tree items={items} defaultExpandedIds={["root"]} />);

    expect(screen.getByText("CookHome")).not.toBeNull();
    expect(screen.getByText("台北分店")).not.toBeNull();
    expect(screen.getByText("高雄分店")).not.toBeNull();
  });

  it("disabled 的節點標記為 aria-disabled,點擊不會改變選取", () => {
    const handleChange = jest.fn();
    render(
      <Tree
        items={items}
        defaultExpandedIds={["root"]}
        onSelectedIdsChange={handleChange}
      />,
    );

    const disabledItem = screen
      .getAllByRole("treeitem")
      .find((item) => item.textContent === "高雄分店");

    expect(disabledItem?.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByText("高雄分店"));

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("單選模式選到節點時回傳只有一個 id 的陣列", () => {
    const handleChange = jest.fn();
    render(
      <Tree
        items={items}
        defaultExpandedIds={["root"]}
        onSelectedIdsChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByText("台北分店"));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0]?.[0]).toEqual(["org-1"]);
  });

  it("勾選模式每個節點都有核取方塊,勾選後回報 id", () => {
    const handleChange = jest.fn();
    render(
      <Tree
        items={items}
        checkboxSelection
        multiSelect
        defaultExpandedIds={["root"]}
        onSelectedIdsChange={handleChange}
      />,
    );

    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    expect(checkboxes).toHaveLength(3);

    const taipeiCheckbox = screen
      .getAllByRole("treeitem")
      .find((item) => item.textContent === "台北分店")
      ?.querySelector("input[type='checkbox']");
    if (taipeiCheckbox === null || taipeiCheckbox === undefined) {
      throw new Error("找不到台北分店的核取方塊");
    }

    fireEvent.click(taipeiCheckbox);

    expect(handleChange.mock.calls[0]?.[0]).toEqual(["org-1"]);
  });

  it("labelSuffix 渲染在節點標籤旁,沒給的節點不受影響", () => {
    render(
      <Tree
        items={[
          {
            id: "root",
            label: "CookHome",
            children: [
              { id: "org-1", label: "台北分店" },
              {
                id: "org-2",
                label: "高雄分店",
                labelSuffix: <span>停用</span>,
              },
            ],
          },
        ]}
        defaultExpandedIds={["root"]}
      />,
    );

    const labels = screen
      .getAllByRole("treeitem")
      .map((item) => item.textContent);

    expect(labels).toContain("高雄分店停用");
    expect(labels).toContain("台北分店");
  });

  it("有 labelSuffix 的節點照樣可以被選取", () => {
    const handleChange = jest.fn();
    render(
      <Tree
        items={[
          { id: "org-2", label: "高雄分店", labelSuffix: <span>停用</span> },
        ]}
        onSelectedIdsChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByText("高雄分店"));

    expect(handleChange.mock.calls[0]?.[0]).toEqual(["org-2"]);
  });

  /**
   * 呼叫端的資料來源常常對葉節點回 `children: []`(api 的 `orgTree` 就是),
   * 那不該讓節點長出展開箭頭(#186 ③)。
   */
  it("children 是空陣列的節點不可展開,沒有展開箭頭", () => {
    render(
      <Tree
        items={[
          { id: "leaf", label: "台北分店", children: [] },
          {
            id: "parent",
            label: "內容組",
            children: [{ id: "c", label: "小組" }],
          },
        ]}
        // 呼叫端可能把全部 id 都放進展開清單(OrgTreePicker 的「預設整棵展開」)
        expandedIds={["leaf", "parent"]}
      />,
    );

    expect(arrowOf("台北分店")).toBeNull();
    expect(arrowOf("內容組")).not.toBeNull();
  });

  it("勾選模式下 disabled 節點的核取方塊為停用", () => {
    render(
      <Tree
        items={items}
        checkboxSelection
        multiSelect
        defaultExpandedIds={["root"]}
      />,
    );

    const kaohsiungCheckbox = screen
      .getAllByRole("treeitem")
      .find((item) => item.textContent === "高雄分店")
      ?.querySelector("input[type='checkbox']:disabled");

    expect(kaohsiungCheckbox).not.toBeNull();
  });

  it("indeterminateIds 的節點顯示部分勾選,並對輔助技術標成 mixed", () => {
    render(
      <Tree
        items={items}
        checkboxSelection
        multiSelect
        defaultExpandedIds={["root"]}
        selectedIds={["org-1"]}
        indeterminateIds={["root"]}
      />,
    );

    expect(rowOf("CookHome").getAttribute("aria-checked")).toBe("mixed");
    expect(checkboxOf("CookHome").dataset.indeterminate).toBe("true");

    // 完全勾選與完全未勾選的列不受影響
    expect(rowOf("台北分店").getAttribute("aria-checked")).toBe("true");
    expect(checkboxOf("台北分店").dataset.indeterminate).toBe("false");
  });

  it("disabledCheckIds 的節點勾選框停用、切不動,但仍可展開", () => {
    const handleChange = jest.fn();
    render(
      <Tree
        items={items}
        checkboxSelection
        multiSelect
        selectedIds={["root"]}
        disabledCheckIds={["root"]}
        onSelectedIdsChange={handleChange}
      />,
    );

    expect(checkboxOf("CookHome").disabled).toBe(true);

    fireEvent.click(checkboxOf("CookHome"));
    expect(handleChange).not.toHaveBeenCalled();

    // 鍵盤也繞不過去(MUI 的空白鍵不看勾選框的 disabled)
    fireEvent.focus(rowOf("CookHome"));
    fireEvent.keyDown(rowOf("CookHome"), { key: " " });
    expect(handleChange).not.toHaveBeenCalled();

    // 勾選框停用 ≠ 整列 disabled:展開箭頭照樣有用
    const iconContainer = rowOf("CookHome").querySelector(
      ".MuiTreeItem-iconContainer",
    );
    if (iconContainer === null) {
      throw new Error("找不到展開箭頭");
    }
    fireEvent.click(iconContainer);

    expect(screen.getByText("台北分店")).not.toBeNull();
  });

  it("actions 渲染在列尾,點了不會變成選取或展開這一列", () => {
    const handleAction = jest.fn();
    const handleSelectedIdsChange = jest.fn();
    const handleExpandedIdsChange = jest.fn();
    render(
      <Tree
        items={[
          {
            id: "demo",
            label: "示範群組",
            labelSuffix: <span>demo</span>,
            actions: (
              <button type="button" onClick={handleAction}>
                清空整組
              </button>
            ),
            children: [{ id: "demo.one", label: "示範模組1" }],
          },
        ]}
        checkboxSelection
        multiSelect
        onSelectedIdsChange={handleSelectedIdsChange}
        onExpandedIdsChange={handleExpandedIdsChange}
      />,
    );

    expect(rowOf("示範群組").textContent).toBe("示範群組demo清空整組");

    fireEvent.click(screen.getByRole("button", { name: "清空整組" }));

    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(handleSelectedIdsChange).not.toHaveBeenCalled();
    expect(handleExpandedIdsChange).not.toHaveBeenCalled();
  });
});
