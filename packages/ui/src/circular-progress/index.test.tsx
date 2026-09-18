import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { CircularProgress } from ".";

describe("CircularProgress", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<CircularProgress aria-label="載入中" />);
      root.unmount();
    }).not.toThrow();
  });
});
