import { describe, expect, it } from "@jest/globals";
import { createRoot } from "react-dom/client";

import { List } from "./List";
import { ListItemButton } from "./ListItemButton";
import { ListItemIcon } from "./ListItemIcon";
import { ListItemText } from "./ListItemText";

describe("List", () => {
  it("renders without crashing", () => {
    expect(() => {
      const div = document.createElement("div");
      const root = createRoot(div);
      root.render(
        <List>
          <ListItemButton selected>
            <ListItemIcon>•</ListItemIcon>
            <ListItemText primary="組織管理" />
          </ListItemButton>
        </List>,
      );
      root.unmount();
    }).not.toThrow();
  });
});
