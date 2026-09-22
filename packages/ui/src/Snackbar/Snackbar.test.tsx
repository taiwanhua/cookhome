import { describe, expect, it, jest } from "@jest/globals";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Snackbar } from "./Snackbar";

describe("Snackbar", () => {
  it("open 時把訊息渲染成 alert", () => {
    render(
      <Snackbar
        open
        message="已儲存"
        closeLabel="關閉"
        onClose={() => {
          // 這個案子不驗關閉
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("已儲存");
  });

  it("open=false 時什麼都不渲染", () => {
    render(
      <Snackbar
        open={false}
        message="已儲存"
        closeLabel="關閉"
        onClose={() => {
          // 這個案子不驗關閉
        }}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("severity=error 時是錯誤語氣(MUI 的 colorError class)", () => {
    render(
      <Snackbar
        open
        severity="error"
        message="沒有權限執行這個動作。"
        closeLabel="關閉"
        onClose={() => {
          // 這個案子不驗關閉
        }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("MuiAlert-colorError");
    expect(alert).toHaveClass("MuiAlert-filled");
  });

  it("按關閉鈕會回報 onClose", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Snackbar open message="已儲存" closeLabel="關閉" onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: "關閉" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /** 預設 4 秒自動關;呼叫端收到 onClose 後才把這一則從佇列移除。 */
  it("預設 4 秒後自動回報 onClose", () => {
    jest.useFakeTimers();
    try {
      const onClose = jest.fn();
      render(
        <Snackbar open message="已儲存" closeLabel="關閉" onClose={onClose} />,
      );

      act(() => {
        jest.advanceTimersByTime(3999);
      });
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("autoHideDuration=null 時不會自己關(只能手動關)", () => {
    jest.useFakeTimers();
    try {
      const onClose = jest.fn();
      render(
        <Snackbar
          open
          message="已送出,等待處理"
          closeLabel="關閉"
          autoHideDuration={null}
          onClose={onClose}
        />,
      );

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(onClose).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
