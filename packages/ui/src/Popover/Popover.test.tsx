import { describe, expect, it, jest } from "@jest/globals";

import { clickElement, mount, requireElement } from "../test-support/mount";
import { Popover } from "./Popover";

const anchorPosition = { top: 100, left: 100 };

describe("Popover", () => {
  it("open 時把內容渲染進 portal", () => {
    const { unmount } = mount(
      <Popover
        open
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
      >
        <button type="button">項目 1</button>
      </Popover>,
    );

    expect(
      requireElement(document.body, ".MuiPopover-paper").textContent,
    ).toContain("項目 1");

    unmount();
  });

  it("open=false 時不渲染內容", () => {
    const { unmount } = mount(
      <Popover
        open={false}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
      >
        <button type="button">項目 1</button>
      </Popover>,
    );

    expect(document.body.querySelector(".MuiPopover-paper")).toBeNull();

    unmount();
  });

  it("點浮層內的項目會觸發它的 onClick", () => {
    const onPick = jest.fn();
    const { unmount } = mount(
      <Popover
        open
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
      >
        <button type="button" onClick={onPick}>
          項目 1
        </button>
      </Popover>,
    );

    clickElement(requireElement(document.body, "button"));
    expect(onPick).toHaveBeenCalledTimes(1);

    unmount();
  });
});
