import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react";

import { authWorld } from "@/test/msw/auth-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

const fillPasswords = async (
  user: ReturnType<typeof renderApp>["user"],
  password: string,
  confirm = password,
) => {
  await user.type(screen.getByLabelText("新密碼"), password);
  await user.type(screen.getByLabelText("確認新密碼"), confirm);
};

describe("設定新密碼頁(/set-password?token=…;啟用信與重設信共用)", () => {
  it("設定成功後持回傳的登入 token 直接進入後台(不需再登入)", async () => {
    const world = authWorld({ validActionTokens: ["token-1"] });
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/set-password?token=token-1" });

    await fillPasswords(user, "new-secret-1");
    await user.click(screen.getByRole("button", { name: "設定並登入" }));

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    expect(world.calls.setPassword).toBe(1);
    expect(world.calls.login).toBe(0);
  });

  it("密碼不符規則即時提示(不足 8 碼 / 純數字)且不送出", async () => {
    const world = authWorld();
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/set-password?token=token-1" });

    await fillPasswords(user, "1234567");

    expect(screen.getByText("至少 8 碼")).toBeInTheDocument();
    expect(screen.getByText("不可為純數字")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "設定並登入" }));

    expect(world.calls.setPassword).toBe(0);
    expect(screen.getByTestId("location")).toHaveTextContent("/set-password");
  });

  it("兩次輸入不一致時提示且不送出", async () => {
    const world = authWorld();
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/set-password?token=token-1" });

    await fillPasswords(user, "new-secret-1", "new-secret-2");
    await user.click(screen.getByRole("button", { name: "設定並登入" }));

    expect(screen.getByText("兩次輸入的密碼不一致")).toBeInTheDocument();
    expect(world.calls.setPassword).toBe(0);
  });

  it("token 逾期 / 已用(ACTION_TOKEN_INVALID)→ 連結失效頁,一鍵重新申請導向忘記密碼", async () => {
    const world = authWorld({ validActionTokens: [] });
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/set-password?token=stale" });

    await fillPasswords(user, "new-secret-1");
    await user.click(screen.getByRole("button", { name: "設定並登入" }));

    expect(await screen.findByText(/連結已失效/)).toBeInTheDocument();
    expect(screen.queryByLabelText("新密碼")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新申請重設連結" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/forgot-password",
      );
    });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("網址沒有 token 時直接顯示連結失效頁", async () => {
    server.use(...authWorld().handlers);
    renderApp({ path: "/set-password" });

    expect(await screen.findByText(/連結已失效/)).toBeInTheDocument();
    expect(screen.queryByLabelText("新密碼")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新申請重設連結" }),
    ).toBeInTheDocument();
  });
});
