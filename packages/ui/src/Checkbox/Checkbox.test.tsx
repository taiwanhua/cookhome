import { describe, expect, it, jest } from "@jest/globals";

import { clickElement, mount, requireInput } from "../test-support/mount";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("渲染出一個 checkbox input,預設未勾選", () => {
    const { container, unmount } = mount(
      <Checkbox slotProps={{ input: { "aria-label": "開放此模組" } }} />,
    );

    const input = requireInput(container);
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);

    unmount();
  });

  it("點擊會切換勾選並帶出 onChange 的新值", () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <Checkbox
        slotProps={{ input: { "aria-label": "開放此模組" } }}
        onChange={onChange}
      />,
    );

    const input = requireInput(container);
    clickElement(input);

    expect(input.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("disabled 時點擊不觸發 onChange", () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <Checkbox
        disabled
        slotProps={{ input: { "aria-label": "開放此模組" } }}
        onChange={onChange}
      />,
    );

    clickElement(requireInput(container));

    expect(onChange).not.toHaveBeenCalled();

    unmount();
  });

  it("indeterminate 會渲染半選的方框", () => {
    const { container, unmount } = mount(
      <Checkbox
        indeterminate
        slotProps={{ input: { "aria-label": "全部(*)" } }}
      />,
    );

    expect(
      container.querySelector('[data-checkbox-box="indeterminate"]'),
    ).not.toBeNull();

    unmount();
  });
});
