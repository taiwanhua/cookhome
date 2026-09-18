import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { AppThemeProvider } from ".";
import { cookhomeBrand } from "../theme";

describe("AppThemeProvider", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <AppThemeProvider brand={cookhomeBrand}>
          <span>內容</span>
        </AppThemeProvider>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
