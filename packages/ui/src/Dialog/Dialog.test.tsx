import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("open 時把標題、內文與動作渲染進 portal", () => {
    render(
      <Dialog open title="刪除角色" actions={<Button>刪除</Button>}>
        確定要刪除「客服」?
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("刪除角色");
    expect(dialog).toHaveTextContent("確定要刪除「客服」?");
    expect(screen.getByRole("button", { name: "刪除" })).toBeInTheDocument();
  });

  it("open=false 時不渲染任何彈窗", () => {
    render(
      <Dialog open={false} title="刪除角色">
        確定要刪除「客服」?
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("點動作插槽的按鈕會觸發其 onClick", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(
      <Dialog
        open
        title="刪除角色"
        actions={<Button onClick={onConfirm}>刪除</Button>}
      >
        確定要刪除「客服」?
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "刪除" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
