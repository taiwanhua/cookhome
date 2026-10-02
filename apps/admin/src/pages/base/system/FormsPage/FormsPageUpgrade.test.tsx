import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";

import { field, formFragment } from "@/test/msw/form-fixtures";
import {
  type FormUpgradeWorldOptions,
  formUpgradeWorld,
} from "@/test/msw/form-upgrade-handlers";
import { server } from "@/test/msw/server";

import { pickDay } from "./designer-batch-test-support";
import {
  FORMS_ALL,
  defaultDesignOptions,
  findDesigner,
  pickOption,
  preloadFormsPage,
  renderFormsPage,
} from "./forms-page-test-support";

preloadFormsPage();

/** 升級動的是提交資料:要表單所屬模組(示範表單)的 edit。 */
const WITH_DATA_EDIT = [...FORMS_ALL, "demo-form.edit"];

const UPGRADE = "將舊版資料升級到此版";

/** 補值欄位:單選(靜態選項)與日期各一。 */
const fillTargets = [
  field("priority", "優先順序", "select", {
    widget: { kind: "dropdown" },
    rules: { required: true },
    options: {
      kind: "static",
      items: [
        { value: "high", label: "高", order: 1, enabled: true },
        { value: "low", label: "低", order: 2, enabled: true },
      ],
    },
  }),
  field("due", "到貨日", "date", { widget: { kind: "datePicker" } }),
] as unknown as Record<string, unknown>[];

/** 預設的升級計畫:v1 三筆、兩個補值欄位。 */
const DEFAULT_UPGRADE: FormUpgradeWorldOptions = {
  plan: { groups: [{ fromVersion: 1, count: 3 }], fillTargets },
};

const renderUpgrade = (
  upgrade?: FormUpgradeWorldOptions,
  options = defaultDesignOptions(),
  permissions: readonly string[] = WITH_DATA_EDIT,
) => {
  const rendered = renderFormsPage(options, permissions);
  const world = formUpgradeWorld(upgrade ?? DEFAULT_UPGRADE);
  server.use(...world.handlers);
  return { ...rendered, upgradeWorld: world };
};

const openVersions = async (user: ReturnType<typeof renderUpgrade>["user"]) => {
  await findDesigner();
  await user.click(screen.getByRole("tab", { name: "表單版本" }));
  return screen.findByRole("table", { name: "版本清單" });
};

const openUpgrade = async (user: ReturnType<typeof renderUpgrade>["user"]) => {
  const table = await openVersions(user);
  await user.click(within(table).getByRole("button", { name: UPGRADE }));
  return screen.findByRole("dialog", { name: "將舊版資料升級到 v1" });
};

describe("表單管理:將舊版資料升級到此版", () => {
  it("第一步列出各舊版本的筆數", async () => {
    const { user } = renderUpgrade();

    const dialog = await openUpgrade(user);

    expect(await within(dialog).findByText("v1:3 筆")).toBeInTheDocument();
  });

  it("補值:單選欄位是單選下拉", async () => {
    const { user } = renderUpgrade();
    const dialog = await openUpgrade(user);

    await pickOption(user, "優先順序", "高", dialog);

    expect(
      within(dialog).getByRole("combobox", { name: "優先順序" }),
    ).toHaveTextContent("高");
  });

  it("補值:日期欄位是日期選擇器(不是文字框)", async () => {
    const { user } = renderUpgrade();
    const dialog = await openUpgrade(user);

    expect(
      await within(dialog).findByRole("group", { name: "到貨日" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("textbox", { name: "到貨日" }),
    ).toBeNull();
  });

  it("三步:補值 → 確認(筆數與補值摘要)→ 結果(升級與跳過的筆數、原因)", async () => {
    const { user, upgradeWorld } = renderUpgrade({
      plan: { groups: [{ fromVersion: 1, count: 3 }], fillTargets },
      result: {
        upgraded: [{ fromVersion: 1, count: 2 }],
        skipped: [{ reason: "EDIT_CONFLICT", count: 1 }],
      },
    });
    const dialog = await openUpgrade(user);
    await pickOption(user, "優先順序", "高", dialog);
    await pickDay(within(dialog).getByRole("group", { name: "到貨日" }), "26");

    await user.click(within(dialog).getByRole("button", { name: "下一步" }));
    expect(
      within(dialog).getByText(
        "將把 3 筆資料改為 v1,重算計算欄位與摘要;已完成的資料會多一筆修訂紀錄。",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/優先順序:/)).toHaveTextContent("高");

    await user.click(within(dialog).getByRole("button", { name: "開始升級" }));

    expect(await within(dialog).findByText("v1:2 筆")).toBeInTheDocument();
    expect(
      within(dialog).getByText("升級時正好被別人修改:1 筆"),
    ).toBeInTheDocument();
    const [input] = upgradeWorld.inputs.upgradeFormSubmissions;
    expect(input).toMatchObject({
      formKey: "shopping_list",
      targetVersion: 1,
      fills: { priority: "high" },
    });
    expect(input.fills.due).toMatch(/T16:00:00\.000Z$/);
    expect(input.clientRequestId).toEqual(expect.any(String));
  });

  it("沒有要升級的資料:不能下一步", async () => {
    const { user } = renderUpgrade({ plan: { groups: [], fillTargets: [] } });
    const dialog = await openUpgrade(user);

    await within(dialog).findByText("沒有需要升級的資料(都已是這一版)。");

    expect(
      within(dialog).getByRole("button", { name: "下一步" }),
    ).toBeDisabled();
  });

  it("本組織綁了流程:不顯示按鈕,改一行提示", async () => {
    const options = defaultDesignOptions();
    const { user } = renderUpgrade(undefined, {
      ...options,
      forms: [
        formFragment({
          workflowBinding: {
            workflowKey: "leave_flow",
            workflowName: "請假審核",
            isValid: true,
          },
        }),
      ],
    });

    const table = await openVersions(user);

    expect(within(table).queryByRole("button", { name: UPGRADE })).toBeNull();
    expect(
      screen.getByText("這張表單在本組織綁了審核流程,舊版資料不能升級到新版。"),
    ).toBeInTheDocument();
  });

  it("沒有表單所屬模組的 edit:不顯示按鈕", async () => {
    const { user } = renderUpgrade(
      undefined,
      defaultDesignOptions(),
      FORMS_ALL,
    );

    const table = await openVersions(user);

    expect(within(table).queryByRole("button", { name: UPGRADE })).toBeNull();
  });
});
