import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FormControlLabel } from "../FormControlLabel/FormControlLabel";
import { Radio } from "./Radio";
import { RadioGroup } from "./RadioGroup";

const byEmail = "寄啟用信";
const byPassword = "設定初始密碼";

const renderGroup = (onChange?: () => void) =>
  render(
    <RadioGroup name="activation" defaultValue="email" onChange={onChange}>
      <FormControlLabel value="email" control={<Radio />} label={byEmail} />
      <FormControlLabel
        value="password"
        control={<Radio />}
        label={byPassword}
      />
    </RadioGroup>,
  );

describe("Radio", () => {
  it("渲染出 radio", () => {
    render(<Radio slotProps={{ input: { "aria-label": byEmail } }} />);

    expect(screen.getByRole("radio", { name: byEmail })).toBeInTheDocument();
  });

  it("RadioGroup 以 defaultValue 決定預設選取項", () => {
    renderGroup();

    expect(screen.getByRole("radio", { name: byEmail })).toBeChecked();
    expect(screen.getByRole("radio", { name: byPassword })).not.toBeChecked();
  });

  it("點第二個選項會換選並回報 onChange", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderGroup(onChange);

    await user.click(screen.getByRole("radio", { name: byPassword }));

    expect(screen.getByRole("radio", { name: byPassword })).toBeChecked();
    expect(screen.getByRole("radio", { name: byEmail })).not.toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
