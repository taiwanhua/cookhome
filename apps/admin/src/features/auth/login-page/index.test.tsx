import { describe, expect, it } from "@jest/globals";
import { screen } from "@testing-library/react";

import { authHandlers, graphqlError } from "../../../test/msw/auth-handlers";
import { api, server } from "../../../test/msw/server";
import { renderApp } from "../../../test/render";

async function fillAndSubmit(
  user: ReturnType<typeof renderApp>["user"],
  account = "root",
  password = "secret-1234",
) {
  await user.type(screen.getByLabelText("帳號"), account);
  await user.type(screen.getByLabelText("密碼"), password);
  await user.click(screen.getByRole("button", { name: "登入" }));
}

describe("登入頁", () => {
  it("登入成功後轉到首頁並顯示使用者名稱", async () => {
    server.use(...authHandlers());
    const { user } = renderApp({ path: "/login" });

    await fillAndSubmit(user);

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("帶 next 時登入後回到原路徑", async () => {
    server.use(...authHandlers());
    const { user } = renderApp({ path: "/login?next=%2F%3Ftab%3Drecipes" });

    await fillAndSubmit(user);

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/?tab=recipes");
  });

  it("帳號或密碼錯誤只顯示統一文案", async () => {
    server.use(
      api.mutation("Login", () => graphqlError("INVALID_CREDENTIALS")),
      ...authHandlers(),
    );
    const { user } = renderApp({ path: "/login" });

    await fillAndSubmit(user, "nobody", "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "帳號或密碼錯誤",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("帳號停用顯示對應文案", async () => {
    server.use(
      api.mutation("Login", () => graphqlError("ACCOUNT_DISABLED")),
      ...authHandlers(),
    );
    const { user } = renderApp({ path: "/login" });

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "此帳號已停用,請聯絡系統管理員",
    );
  });

  it("嘗試次數過多顯示稍後再試", async () => {
    server.use(
      api.mutation("Login", () => graphqlError("TOO_MANY_ATTEMPTS")),
      ...authHandlers(),
    );
    const { user } = renderApp({ path: "/login" });

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "登入失敗次數過多,請稍後再試",
    );
  });
});
