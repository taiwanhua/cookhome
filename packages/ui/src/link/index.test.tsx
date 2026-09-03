import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Link } from ".";

describe("Link", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(<Link href="https://turborepo.dev">Turborepo Docs</Link>);
      root.unmount();
    }).not.toThrow();
  });
});
