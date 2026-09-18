import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Collapse } from "./Collapse";

describe("Collapse", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <Collapse in>
          <p>子項</p>
        </Collapse>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
