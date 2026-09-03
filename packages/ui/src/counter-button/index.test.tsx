import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { CounterButton } from ".";

describe("CounterButton", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<CounterButton />);
      root.unmount();
    }).not.toThrow();
  });
});
