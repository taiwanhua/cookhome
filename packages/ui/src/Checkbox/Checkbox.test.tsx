import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Checkbox } from "./Checkbox";

const label = "開放此模組";

describe("Checkbox", () => {
  it("渲染出一個 checkbox,預設未勾選", () => {
    render(<Checkbox slotProps={{ input: { "aria-label": label } }} />);

    expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
  });

  it("點擊會切換勾選並回報 onChange", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <Checkbox
        slotProps={{ input: { "aria-label": label } }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: label }));

    expect(screen.getByRole("checkbox", { name: label })).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("disabled 時點擊不觸發 onChange", async () => {
    // MUI 的 disabled 勾選框是 pointer-events: none,user-event 預設會直接擋下點擊;
    // 這裡要驗的是「真的點下去也不會有事」,所以關掉該檢查
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = jest.fn();
    render(
      <Checkbox
        disabled
        slotProps={{ input: { "aria-label": label } }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: label }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("indeterminate 會渲染半選的方框", () => {
    const { container } = render(
      <Checkbox indeterminate slotProps={{ input: { "aria-label": "全部" } }} />,
    );

    expect(
      container.querySelector('[data-checkbox-box="indeterminate"]'),
    ).toBeInTheDocument();
  });
});
