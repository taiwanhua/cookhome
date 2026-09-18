import { describe, expect, it, jest } from "@jest/globals";

import { clickElement, mount, requireElement } from "../test-support/mount";
import { Tag } from "./Tag";

describe("Tag", () => {
  it("渲染標籤文字", () => {
    const { container, unmount } = mount(<Tag label="系統內建" />);

    expect(container.textContent).toContain("系統內建");

    unmount();
  });

  it("每個色調都渲染得出來", () => {
    const { container, unmount } = mount(
      <>
        <Tag tone="grey" label="停用" />
        <Tag tone="primary" label="群組" />
        <Tag tone="success" label="啟用" />
        <Tag tone="warning" label="隱藏頁" />
        <Tag tone="error" label="組織外" />
      </>,
    );

    expect(container.querySelectorAll(".MuiChip-root")).toHaveLength(5);

    unmount();
  });

  it("有 onDelete 時出現關閉鈕,點下去會回報", () => {
    const onDelete = jest.fn();
    const { container, unmount } = mount(
      <Tag label="客服" onDelete={onDelete} />,
    );

    clickElement(requireElement(container, ".MuiChip-deleteIcon"));

    expect(onDelete).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("沒有 onDelete 就不渲染關閉鈕", () => {
    const { container, unmount } = mount(<Tag label="客服" />);

    expect(container.querySelector(".MuiChip-deleteIcon")).toBeNull();

    unmount();
  });
});
