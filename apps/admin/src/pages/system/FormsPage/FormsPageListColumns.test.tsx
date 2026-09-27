import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ModuleListColumnKind } from "@repo/graphql";

import { formFragment } from "@/test/msw/form-fixtures";

import {
  defaultDesignOptions,
  findDesigner,
  preloadFormsPage,
  renderFormsPage,
} from "./forms-page-test-support";

preloadFormsPage();

describe("表單管理:所屬模組的列表欄位配置入口", () => {
  it("root 在表單右欄打開同一個編輯器,註明影響整個模組;存的是該模組的配置", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();

    await user.click(screen.getByRole("button", { name: "列表欄位配置" }));
    const dialog = await screen.findByRole("dialog", {
      name: "列表欄位配置 — 購物清單",
    });
    expect(
      within(dialog).getByText(
        "此設定影響整個模組的列表:模組裡的每張表單共用同一份列表欄位。",
      ),
    ).toBeInTheDocument();
    await within(dialog).findByText(
      "目前沒有設定,列表使用預設欄(標題、日期)。",
    );
    await user.click(within(dialog).getByRole("button", { name: "+ 摘要槽" }));
    await user.click(within(dialog).getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(world.inputs.setModuleListColumns).toEqual([
        {
          moduleKey: "shopping-list",
          columns: [
            {
              kind: ModuleListColumnKind.Slot,
              key: "title",
              width: 180,
              order: 0,
            },
          ],
        },
      ]);
    });
  });

  it("站在租戶(表單有本租戶的啟用開關)看不到這個入口", async () => {
    renderFormsPage({
      ...defaultDesignOptions(),
      forms: [formFragment({ tenantEnabled: true })],
    });
    await findDesigner();

    expect(screen.queryByRole("button", { name: "列表欄位配置" })).toBeNull();
  });
});
