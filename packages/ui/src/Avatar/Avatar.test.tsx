import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Avatar>何</Avatar>);
      root.unmount();
    }).not.toThrow();
  });
});
