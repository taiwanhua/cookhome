import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  cssRulesMatching,
  declaredValue,
  emotionClassOf,
} from "../test/css-rules";
import { IconButton } from "./IconButton";

const label = "關閉";

describe("IconButton", () => {
  it("以 aria-label 當無障礙名稱,點擊會回報", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <IconButton aria-label={label} size="small" onClick={onClick}>
        <span>×</span>
      </IconButton>,
    );

    await user.click(screen.getByRole("button", { name: label }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled 時點擊不觸發 onClick", async () => {
    // MUI 對停用的 ButtonBase 下 pointer-events: none,user-event 預設會先擋下點擊(TEST-09)
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClick = jest.fn();
    render(
      <IconButton aria-label={label} disabled onClick={onClick}>
        <span>×</span>
      </IconButton>,
    );

    await user.click(screen.getByRole("button", { name: label }));

    expect(screen.getByRole("button", { name: label })).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  /**
   * #260:呼叫端常給 `sx={{ color: … }}`(AppBar 的「?」就是),
   * 那個值不可以把停用色蓋掉 —— 停用的圖示鈕必須看得出來是灰的。
   */
  it("呼叫端的 sx.color 蓋不掉停用色", () => {
    render(
      <IconButton aria-label={label} disabled sx={{ color: "text.secondary" }}>
        <span>×</span>
      </IconButton>,
    );
    const ownClass = `.${emotionClassOf(screen.getByRole("button", { name: label }))}`;

    const baseColor = declaredValue(
      cssRulesMatching(ownClass).filter(
        (rule) => rule.selectorText === ownClass,
      ),
      "color",
    );
    const disabledColor = declaredValue(
      cssRulesMatching(`${ownClass}.Mui-disabled`),
      "color",
    );

    expect(disabledColor).not.toBeNull();
    expect(disabledColor).not.toBe(baseColor);
  });
});
