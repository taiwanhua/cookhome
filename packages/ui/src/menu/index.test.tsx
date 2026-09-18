import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Menu, MenuItem } from ".";

describe("Menu", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <Menu open={false}>
          <MenuItem>登出</MenuItem>
        </Menu>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
