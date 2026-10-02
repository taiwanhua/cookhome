import { describe, expect, it } from "@jest/globals";
import { screen } from "@testing-library/react";

import {
  authHandlers,
  authWorld,
  graphqlError,
} from "@/test/msw/auth-handlers";
import { api, server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

describe("忘記密碼頁(/forgot-password)", () => {
  it("送出 Email 後顯示已寄出,不透露帳號是否存在(不存在的 Email 畫面相同)", async () => {
    const world = authWorld();
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/forgot-password" });

    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "寄送重設密碼連結" }));

    expect(await screen.findByText(/重設密碼連結已寄出/)).toBeInTheDocument();
    expect(world.resetRequests).toEqual(["nobody@example.com"]);
    expect(screen.getByRole("button", { name: "重新寄送" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "返回登入" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("已寄出後可再次寄送同一個 Email", async () => {
    const world = authWorld();
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/forgot-password" });

    await user.type(screen.getByLabelText("Email"), "ming@cookhome.online");
    await user.click(screen.getByRole("button", { name: "寄送重設密碼連結" }));
    await user.click(await screen.findByRole("button", { name: "重新寄送" }));

    expect(world.resetRequests).toEqual([
      "ming@cookhome.online",
      "ming@cookhome.online",
    ]);
  });

  it("寄送失敗(非預期錯誤)顯示稍後再試", async () => {
    server.use(
      api.mutation("RequestPasswordReset", () =>
        graphqlError("UNAUTHENTICATED", "boom"),
      ),
      ...authHandlers(),
    );
    const { user } = renderApp({ path: "/forgot-password" });

    await user.type(screen.getByLabelText("Email"), "ming@cookhome.online");
    await user.click(screen.getByRole("button", { name: "寄送重設密碼連結" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "寄送失敗,請稍後再試",
    );
  });
});
