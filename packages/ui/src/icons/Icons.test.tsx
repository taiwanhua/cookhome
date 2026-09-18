import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { ChevronDownIcon } from "./ChevronDownIcon";
import { ChevronRightIcon } from "./ChevronRightIcon";
import { CloseIcon } from "./CloseIcon";
import { DotIcon } from "./DotIcon";

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
          <CloseIcon fontSize="small" />
        </>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
