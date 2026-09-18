import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Typography } from ".";

describe("Typography", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Typography variant="h4">標題</Typography>);
      root.unmount();
    }).not.toThrow();
  });
});
