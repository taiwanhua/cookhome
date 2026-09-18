import { describe, expect, it, jest } from "@jest/globals";

import { Button } from "../Button/Button";
import { clickElement, mount, requireElement } from "../test-support/mount";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("open 時把標題、內文與動作渲染進 portal", () => {
    const { unmount } = mount(
      <Dialog open title="刪除角色" actions={<Button>刪除</Button>}>
        確定要刪除「客服」?
      </Dialog>,
    );

    const dialog = requireElement(document.body, '[role="dialog"]');
    expect(dialog.textContent).toContain("刪除角色");
    expect(dialog.textContent).toContain("確定要刪除「客服」?");
    expect(dialog.textContent).toContain("刪除");

    unmount();
  });

  it("open=false 時不渲染任何彈窗", () => {
    const { unmount } = mount(
      <Dialog open={false} title="刪除角色">
        確定要刪除「客服」?
      </Dialog>,
    );

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    unmount();
  });

  it("點動作插槽的按鈕會觸發其 onClick", () => {
    const onConfirm = jest.fn();
    const { unmount } = mount(
      <Dialog
        open
        title="刪除角色"
        actions={<Button onClick={onConfirm}>刪除</Button>}
      >
        確定要刪除「客服」?
      </Dialog>,
    );

    clickElement(requireElement(document.body, "button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    unmount();
  });
});
