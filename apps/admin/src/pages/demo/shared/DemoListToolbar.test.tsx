import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";

import { defaultLocale, messages } from "@repo/i18n";
import { AppThemeProvider } from "@repo/ui/app-theme-provider";
import { defaultBrand } from "@repo/ui/theme";

import { SAMPLE_ONE_I18N } from "../demo-sample-one-config";
import { DemoListToolbar } from "./DemoListToolbar";

const noop = () => {
  // 回呼在本測試不觸發
};

/** 元素宣告的 CSS(emotion 插進 `<style>` 的規則原文,含 `& > :not(style) ~ :not(style)` 這類子選擇器) */
const declaredCss = (element: Element): string => {
  const classes = [...element.classList];
  return [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .map((rule) => rule.cssText)
    .filter((text) => classes.some((name) => text.includes(`.${name}`)))
    .join("\n");
};

describe("DemoListToolbar(示範模組列表的過濾條件列)", () => {
  it("不換行的列也用 gap 排欄距(主題預設 useFlexGap),不對子元素下 margin", () => {
    render(
      <IntlProvider locale={defaultLocale} messages={messages[defaultLocale]}>
        <AppThemeProvider brand={defaultBrand}>
          <DemoListToolbar
            i18nNamespace={SAMPLE_ONE_I18N}
            keyword=""
            onKeywordChange={noop}
            option={null}
            onOptionChange={noop}
            canCreate
            onCreate={noop}
          />
        </AppThemeProvider>
      </IntlProvider>,
    );

    const row = screen.getByRole("textbox").closest(".MuiStack-root");
    expect(row).not.toBeNull();
    const css = declaredCss(row ?? document.body);
    expect(css).not.toContain("flex-wrap");
    expect(css).toMatch(/(^|[\s;{])gap:/);
    // margin 模式會對所有直接子元素下 margin: 0、第二個起下 margin-left
    expect(css).not.toMatch(/margin/);
  });
});
