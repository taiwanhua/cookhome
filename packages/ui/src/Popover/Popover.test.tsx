import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Popover } from "./Popover";

const anchorPosition = { top: 100, left: 100 };

describe("Popover", () => {
  it("open 時把內容渲染進 portal", () => {
    render(
      <Popover
        open
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
      >
        <button type="button">項目 1</button>
      </Popover>,
    );

    expect(screen.getByRole("button", { name: "項目 1" })).toBeInTheDocument();
  });

  it("open=false 時不渲染內容", () => {
    render(
      <Popover
        open={false}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
      >
        <button type="button">項目 1</button>
      </Popover>,
    );

    expect(
      screen.queryByRole("button", { name: "項目 1" }),
    ).not.toBeInTheDocument();
  });

  it("點浮層內的項目會觸發它的 onClick", async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(
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

    await user.click(screen.getByRole("button", { name: "項目 1" }));

    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
