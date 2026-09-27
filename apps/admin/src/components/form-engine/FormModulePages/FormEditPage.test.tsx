import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { SHOPPING_ROUTES, submissionFragment } from "@/test/msw/form-fixtures";

import {
  defaultRuntimeOptions,
  renderShopping,
  shoppingForm,
} from "./form-module-test-support";

const EDIT_PATH = `${SHOPPING_ROUTES.editPage}/sub-1`;

describe("表單模組編輯頁(預設組裝)", () => {
  it("已完成的單:「儲存修改」帶 expectedEditVersion 與 expectedRevision,送整張表單的值", async () => {
    const { user, world } = renderShopping({
      path: EDIT_PATH,
      world: {
        ...defaultRuntimeOptions(),
        submissions: [submissionFragment()],
      },
    });

    const qty = await screen.findByRole("textbox", { name: "數量" });
    await user.clear(qty);
    await user.type(qty, "5");
    await user.click(screen.getByRole("button", { name: "儲存修改" }));

    await waitFor(() => {
      expect(world.inputs.updateFormSubmission).toHaveLength(1);
    });
    expect(world.inputs.updateFormSubmission[0]).toMatchObject({
      id: "sub-1",
      expectedEditVersion: 2,
      expectedRevision: 1,
      values: { item: "雞蛋", qty: "5", unit_price: "30" },
    });
    // 沒有欄位級 edit 的欄位(內部備註)原樣送回,api 視為沒動
    expect(world.inputs.updateFormSubmission[0]?.values).toHaveProperty(
      "internal_note",
      null,
    );
  });

  it("別人先改過(editVersion 不符)→ 提示「已被別人更新,請重新載入」", async () => {
    const { user } = renderShopping({
      path: EDIT_PATH,
      world: {
        ...defaultRuntimeOptions(),
        submissions: [submissionFragment()],
        failures: {
          UpdateFormSubmission: {
            code: "CONFLICT",
            extensions: { reason: "EDIT_VERSION_MISMATCH" },
          },
        },
      },
    });

    await user.type(await screen.findByRole("textbox", { name: "品項" }), "!");
    await user.click(screen.getByRole("button", { name: "儲存修改" }));

    expect(
      await screen.findByText("這筆資料已被別人更新,請重新載入。", {
        selector: ".MuiAlert-message",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新載入" }),
    ).toBeInTheDocument();
  });

  it("沒有欄位級 edit 的欄位:看得到但唯讀,附說明", async () => {
    renderShopping({
      path: EDIT_PATH,
      world: {
        ...defaultRuntimeOptions(),
        submissions: [submissionFragment()],
      },
    });

    const internal = await screen.findByRole("textbox", { name: "內部備註" });
    expect(internal).toBeDisabled();
    expect(
      screen.getByText("你看得到這個欄位,但沒有修改它的權限。"),
    ).toBeInTheDocument();
  });

  it("頁籤模板的系統佔位符:編輯頁的頁籤標題也套 {{form}} / {{applicant}}", async () => {
    renderShopping({
      path: EDIT_PATH,
      world: {
        ...defaultRuntimeOptions(),
        moduleForms: [
          { ...shoppingForm, tabLabelTemplate: "{{applicant}} 的{{form}}" },
        ],
        submissions: [submissionFragment()],
      },
    });

    const tabs = await screen.findByRole("tablist", { name: "路由頁籤" });
    expect(await within(tabs).findByText(/小華 的購物單/)).toBeInTheDocument();
  });
});
