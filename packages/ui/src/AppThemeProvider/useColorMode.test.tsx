import { afterEach, describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

import { defaultBrand } from "../theme";
import { AppThemeProvider } from "./AppThemeProvider";
import { useColorMode } from "./useColorMode";

const STORAGE_KEY = "test-color-mode";

/** 顯示目前外觀,按鈕換成暗色。 */
const Probe = () => {
  const { mode, setMode } = useColorMode();
  return (
    <button
      type="button"
      onClick={() => {
        setMode("dark");
      }}
    >
      {mode}
    </button>
  );
};

const renderWithTheme = () =>
  render(
    <AppThemeProvider brand={defaultBrand} modeStorageKey={STORAGE_KEY}>
      <Probe />
    </AppThemeProvider>,
  );

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("useColorMode", () => {
  it("預設跟隨系統;選「暗」後 <html> 換成暗色 class,並記在指定的 localStorage key", () => {
    renderWithTheme();
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("system");

    fireEvent.click(button);

    expect(button).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("重新掛載時讀回存過的外觀", () => {
    localStorage.setItem(STORAGE_KEY, "light");

    renderWithTheme();

    expect(screen.getByRole("button")).toHaveTextContent("light");
    expect(document.documentElement).toHaveClass("light");
  });
});
