import { describe, expect, it, jest } from "@jest/globals";

import { FormControlLabel } from "../FormControlLabel/FormControlLabel";
import { clickElement, mount, requireInput } from "../test-support/mount";
import { Radio } from "./Radio";
import { RadioGroup } from "./RadioGroup";

const renderGroup = (onChange: (event: unknown, value: string) => void) =>
  mount(
    <RadioGroup name="activation" defaultValue="email" onChange={onChange}>
      <FormControlLabel value="email" control={<Radio />} label="寄啟用信" />
      <FormControlLabel
        value="password"
        control={<Radio />}
        label="設定初始密碼"
      />
    </RadioGroup>,
  );

describe("Radio", () => {
  it("渲染出 radio input", () => {
    const { container, unmount } = mount(
      <Radio slotProps={{ input: { "aria-label": "寄啟用信" } }} />,
    );

    expect(requireInput(container).type).toBe("radio");

    unmount();
  });

  it("RadioGroup 以 defaultValue 決定預設選取項", () => {
    const { container, unmount } = renderGroup(jest.fn());

    const [first, second] = [...container.querySelectorAll("input")];
    expect(first?.checked).toBe(true);
    expect(second?.checked).toBe(false);

    unmount();
  });

  it("點第二個選項會換選並回報新的值", () => {
    const onChange = jest.fn();
    const { container, unmount } = renderGroup(onChange);

    const [first, second] = [...container.querySelectorAll("input")];
    if (second === undefined) {
      throw new Error("測試找不到第二個選項");
    }
    clickElement(second);

    expect(second.checked).toBe(true);
    expect(first?.checked).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    unmount();
  });
});
