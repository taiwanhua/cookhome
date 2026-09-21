import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tabs } from "./Tabs";

const items = [
  { value: "matrix", label: "權限設定" },
  { value: "users", label: "分配使用者" },
] as const;

describe("Tabs", () => {
  it("畫出一列 tab,選中的那個 aria-selected 為 true", () => {
    render(
      <Tabs
        value="matrix"
        items={items}
        aria-label="角色分頁"
        onChange={noop}
      />,
    );

    expect(
      screen.getByRole("tablist", { name: "角色分頁" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "權限設定" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "分配使用者" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("點另一個 tab 回報它的 value(受控:自己不會換頁籤)", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Tabs value="matrix" items={items} onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "分配使用者" }));

    expect(onChange).toHaveBeenCalledWith("users");
    // 受控:沒有重新渲染就還是停在原本那個
    expect(screen.getByRole("tab", { name: "權限設定" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("disabled 的 tab 點下去不回報", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = jest.fn();
    render(
      <Tabs
        value="matrix"
        items={[
          items[0],
          { value: "users", label: "分配使用者", disabled: true },
        ]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "分配使用者" }));

    expect(screen.getByRole("tab", { name: "分配使用者" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  /** 資料換掉的瞬間 `value` 可能指到不存在的頁籤 —— 這時整列都不選中,而不是 MUI 警告。 */
  it("value 不在 items 裡時沒有任何 tab 被選中", () => {
    render(<Tabs value="gone" items={items} onChange={noop} />);

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });
});

const noop = () => {
  // 受控元件必給 onChange;這幾個案子不驗回報
};
