import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Stack } from "./Stack";

describe("Stack", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <Stack spacing={2}>
          <span>一</span>
          <span>二</span>
        </Stack>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
