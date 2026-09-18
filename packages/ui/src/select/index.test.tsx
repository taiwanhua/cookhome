import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { Select } from ".";
import { MenuItem } from "../menu";

describe("Select", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <Select
          variant="standard"
          value="org-1"
          inputProps={{ "aria-label": "當前組織" }}
        >
          <MenuItem value="org-1">CookHome</MenuItem>
        </Select>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
