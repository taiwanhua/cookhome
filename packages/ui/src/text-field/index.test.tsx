import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { TextField } from ".";

describe("TextField", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<TextField label="食譜名稱" />);
      root.unmount();
    }).not.toThrow();
  });
});
