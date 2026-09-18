import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Checkbox } from "../Checkbox/Checkbox";
import { FormControlLabel } from "./FormControlLabel";

const label = "開放此模組";

describe("FormControlLabel", () => {
  it("標籤文字成為控制項的可及名稱", () => {
    render(<FormControlLabel control={<Checkbox />} label={label} />);

    expect(screen.getByRole("checkbox", { name: label })).toBeInTheDocument();
  });

  it("點標籤文字等於點控制項", async () => {
    const user = userEvent.setup();
    render(<FormControlLabel control={<Checkbox />} label={label} />);

    await user.click(screen.getByText(label));

    expect(screen.getByRole("checkbox", { name: label })).toBeChecked();
  });
});
