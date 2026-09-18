import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { IconButton } from ".";

describe("IconButton", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <IconButton aria-label="關閉" size="small">
          <span>×</span>
        </IconButton>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
