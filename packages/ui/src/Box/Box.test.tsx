import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Box } from "./Box";

describe("Box", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Box component="main">內容</Box>);
      root.unmount();
    }).not.toThrow();
  });
});
