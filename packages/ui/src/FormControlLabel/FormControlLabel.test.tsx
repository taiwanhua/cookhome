import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppThemeProvider } from "../AppThemeProvider/AppThemeProvider";
import { Checkbox } from "../Checkbox/Checkbox";
import {
  cssRulesMatching,
  declaredValue,
  emotionClassOf,
} from "../test/css-rules";
import { cookhomeBrand } from "../theme/brands/cookhome";
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
  it("主題把左邊 margin 歸零(左緣對齊同一欄的輸入框),右邊 16px 照舊", () => {
    render(
      <AppThemeProvider brand={cookhomeBrand}>
        <FormControlLabel control={<Checkbox />} label={label} />
      </AppThemeProvider>,
    );

    const root = screen.getByText(label).closest(".MuiFormControlLabel-root");
    expect(root).not.toBeNull();
    const rules = cssRulesMatching(emotionClassOf(root ?? document.body));
    expect(declaredValue(rules, "margin-left")).toBe("0");
    expect(declaredValue(rules, "margin-right")).toBe("16px");
  });
});
