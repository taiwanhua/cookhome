import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Button } from ".";

describe("Button", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Button>儲存</Button>);
      root.unmount();
    }).not.toThrow();
  });
});
