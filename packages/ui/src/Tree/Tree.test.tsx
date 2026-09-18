import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

import { type TreeNode, Tree } from "./Tree";

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

  it("勾選模式下 disabled 節點的核取方塊為停用", () => {
    render(
      <Tree items={items} checkboxSelection multiSelect defaultExpandedIds={["root"]} />,
    );

    const kaohsiungCheckbox = screen
      .getAllByRole("treeitem")
      .find((item) => item.textContent === "高雄分店")
      ?.querySelector("input[type='checkbox']:disabled");

    expect(kaohsiungCheckbox).not.toBeNull();
  });
});
