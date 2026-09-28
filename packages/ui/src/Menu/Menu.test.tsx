import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LogoutIcon } from "../icons/LogoutIcon";
import { Menu } from "./Menu";
import { MenuItem } from "./MenuItem";
import { MenuItemIcon } from "./MenuItemIcon";
import { MenuList } from "./MenuList";

describe("Menu", () => {
  it("打開時畫出選單與項目,點項目回報", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <Menu open anchorEl={document.body}>
        <MenuItem onClick={onClick}>登出</MenuItem>
      </Menu>,
    );

    await user.click(screen.getByRole("menuitem", { name: "登出" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("關著時不畫選單", () => {
    render(
      <Menu open={false}>
        <MenuItem>登出</MenuItem>
      </Menu>,
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("MenuList + MenuItemIcon", () => {
  it("不帶浮層的選單:項目帶圖示,名稱只取文字;上下鍵在項目間移動", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MenuList autoFocusItem>
        <MenuItem>
          <MenuItemIcon>
            <LogoutIcon />
          </MenuItemIcon>
          登出
        </MenuItem>
        <MenuItem>登出所有裝置</MenuItem>
      </MenuList>,
    );

    const first = screen.getByRole("menuitem", { name: "登出" });
    expect(first).toHaveFocus();
    expect(first.querySelector(".MuiListItemIcon-root svg")).not.toBeNull();

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: "登出所有裝置" }),
    ).toHaveFocus();
    expect(container.querySelector("[role='menu']")).not.toBeNull();
  });
});
