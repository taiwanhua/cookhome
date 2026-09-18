import { describe, expect, it, jest } from "@jest/globals";

import { clickElement, mount, requireInput } from "../test-support/mount";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("渲染出一個 checkbox 型別的開關 input", () => {
    const { container, unmount } = mount(
      <Switch slotProps={{ input: { "aria-label": "啟用" } }} />,
    );

    const input = requireInput(container);
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);

    unmount();
  });

  it("點擊會切換開關並回報 onChange", () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <Switch
        slotProps={{ input: { "aria-label": "啟用" } }}
        onChange={onChange}
      />,
    );

    const input = requireInput(container);
    clickElement(input);

    expect(input.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("受控模式下值由外部決定,點擊不會自行翻轉", () => {
    const { container, unmount } = mount(
      <Switch
        checked
        slotProps={{ input: { "aria-label": "啟用" } }}
        onChange={jest.fn()}
      />,
    );

    const input = requireInput(container);
    clickElement(input);

    expect(input.checked).toBe(true);

    unmount();
  });
});
