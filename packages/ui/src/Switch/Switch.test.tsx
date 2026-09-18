import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Switch } from "./Switch";

const label = "啟用";

describe("Switch", () => {
  it("渲染出一個開關,預設關閉", () => {
    render(<Switch slotProps={{ input: { "aria-label": label } }} />);

    expect(screen.getByRole("switch", { name: label })).not.toBeChecked();
  });

  it("點擊會打開並回報 onChange", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <Switch
        slotProps={{ input: { "aria-label": label } }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("switch", { name: label }));

    expect(screen.getByRole("switch", { name: label })).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("受控模式下值由外部決定,點擊不會自行翻轉", async () => {
    const user = userEvent.setup();
    render(
      <Switch
        checked
        slotProps={{ input: { "aria-label": label } }}
        onChange={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("switch", { name: label }));

    expect(screen.getByRole("switch", { name: label })).toBeChecked();
  });
});
