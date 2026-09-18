import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Card } from "./Card";

describe("Card", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Card>內容</Card>);
      root.unmount();
    }).not.toThrow();
  });
});
