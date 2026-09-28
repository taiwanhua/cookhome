import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DarkModeIcon } from "../icons/DarkModeIcon";
import { LightModeIcon } from "../icons/LightModeIcon";
import { SystemModeIcon } from "../icons/SystemModeIcon";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "system", label: "跟隨系統", icon: <SystemModeIcon /> },
  { value: "light", label: "亮", icon: <LightModeIcon /> },
  { value: "dark", label: "暗", icon: <DarkModeIcon /> },
] as const;

type Mode = (typeof options)[number]["value"];

describe("SegmentedControl", () => {
  it("一組有名字的按鈕,選中的那個 aria-pressed 為 true,其餘為 false", () => {
    const { container } = render(
      <SegmentedControl<Mode>
        value="light"
        options={options}
        aria-label="外觀"
        onChange={noop}
      />,
    );

    expect(screen.getByRole("group", { name: "外觀" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "亮" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const name of ["跟隨系統", "暗"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    // 圖示畫在文字前(每個選項一顆)
    expect(container.querySelectorAll("button svg")).toHaveLength(3);
  });

  it("點另一個選項回報它的 value(受控:自己不會換)", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SegmentedControl<Mode>
        value="system"
        options={options}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "暗" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("button", { name: "跟隨系統" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("再點已選的那個不回報(必定有一個選中,不會被取消)", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SegmentedControl<Mode>
        value="system"
        options={options}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "跟隨系統" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("鍵盤:整組一個 Tab 停點,左右鍵移動、Enter / Space 選取", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <>
        <SegmentedControl<Mode>
          value="light"
          options={options}
          onChange={onChange}
        />
        <button type="button">下一個</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "跟隨系統" })).toHaveFocus();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "暗" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("dark");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "跟隨系統" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("system");
    expect(onChange).toHaveBeenCalledTimes(2);

    // 整組只佔一個 Tab 停點
    await user.tab();
    expect(screen.getByRole("button", { name: "下一個" })).toHaveFocus();
  });

  it("沒有圖示的選項只畫文字", () => {
    const { container } = render(
      <SegmentedControl
        value="zh-TW"
        options={[
          { value: "zh-TW", label: "繁體中文" },
          { value: "en", label: "English" },
        ]}
        aria-label="語言"
        onChange={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(container.querySelector("button svg")).toBeNull();
  });
});

const noop = () => {
  // 受控元件必給 onChange;這幾個案子不驗回報
};
