import { describe, expect, it } from "@jest/globals";

import { Checkbox } from "../Checkbox/Checkbox";
import {
  clickElement,
  mount,
  requireElement,
  requireInput,
} from "../test-support/mount";
import { FormControlLabel } from "./FormControlLabel";

describe("FormControlLabel", () => {
  it("把標籤文字渲染在控制項旁", () => {
    const { container, unmount } = mount(
      <FormControlLabel control={<Checkbox />} label="開放此模組" />,
    );

    expect(container.textContent).toContain("開放此模組");

    unmount();
  });

  it("點標籤文字等於點控制項", () => {
    const { container, unmount } = mount(
      <FormControlLabel control={<Checkbox />} label="開放此模組" />,
    );

    clickElement(requireElement(container, ".MuiFormControlLabel-label"));

    expect(requireInput(container).checked).toBe(true);

    unmount();
  });
});
