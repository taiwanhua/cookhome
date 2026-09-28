import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { AppThemeProvider } from "../AppThemeProvider/AppThemeProvider";
import {
  cssRulesMatching,
  declaredValue,
  emotionClassOf,
} from "../test/css-rules";
import { cookhomeBrand } from "../theme/brands/cookhome";
import { Stack } from "./Stack";

/** Stack 自己與它對直接子元素下的規則(`.css-… > :not(style) ~ :not(style)` 這類)都含它的 emotion 類別 */
const rulesOfStack = (testId: string) =>
  cssRulesMatching(emotionClassOf(screen.getByTestId(testId)));

const MARGIN_PROPERTIES = [
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
] as const;

describe("Stack", () => {
  it("主題預設用 gap 排間距:不換行的列也一樣,不對子元素下 margin", () => {
    render(
      <AppThemeProvider brand={cookhomeBrand}>
        <Stack data-testid="row" direction="row" spacing={2}>
          <span>一</span>
          <span>二</span>
        </Stack>
      </AppThemeProvider>,
    );

    const rules = rulesOfStack("row");
    expect(declaredValue(rules, "gap")).not.toBeNull();
    for (const property of MARGIN_PROPERTIES) {
      expect(declaredValue(rules, property)).toBeNull();
    }
  });

  it("呼叫端明寫 useFlexGap={false} 才回到 margin 模式(上一案斷言得出差異)", () => {
    render(
      <AppThemeProvider brand={cookhomeBrand}>
        <Stack
          data-testid="legacy"
          direction="row"
          spacing={2}
          useFlexGap={false}
        >
          <span>一</span>
          <span>二</span>
        </Stack>
      </AppThemeProvider>,
    );

    const rules = rulesOfStack("legacy");
    expect(declaredValue(rules, "gap")).toBeNull();
    expect(declaredValue(rules, "margin-left")).not.toBeNull();
  });
});
