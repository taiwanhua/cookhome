import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { ChevronDownIcon, ChevronRightIcon, DotIcon } from ".";

describe("icons", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <>
          <ChevronDownIcon fontSize="small" />
          <ChevronRightIcon fontSize="small" />
          <DotIcon fontSize="small" />
        </>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
