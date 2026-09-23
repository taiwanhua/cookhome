import { beforeEach, describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { readStoredEntries, routeTabsStorageKey } from "@/lib/route-tabs";
import {
  SAMPLE_ONE_ROUTES,
  VIEW_ONLY,
  findRowOf,
  renderSampleOne,
} from "@/pages/demo/demo-sample-one-test-support";
import {
  SAMPLE_TWO_ROUTES,
  renderSampleTwo,
} from "@/pages/demo/demo-sample-two-test-support";
import { testUser } from "@/test/msw/auth-handlers";

const STORAGE_KEY = routeTabsStorageKey(testUser.id);
const VIEW_ONE = `${SAMPLE_ONE_ROUTES.viewPage}/demo-1`;
const EDIT_ONE = `${SAMPLE_ONE_ROUTES.editPage}/demo-1`;
const DETAIL_LABEL = "示範模組1 — 醬燒雞腿排";

const findTabList = async () =>
  screen.findByRole("tablist", { name: "路由頁籤" });

const tabLabels = (list: HTMLElement) =>
  within(list)
    .queryAllByRole("tab")
    .map((tab) => tab.textContent);

/** 頁籤列出現後,等它的標籤變成預期(子頁籤的標籤要等頁面的資料到了才會補上)。 */
const expectTabs = async (labels: string[]) => {
  const list = await findTabList();
  await waitFor(() => {
    expect(tabLabels(list)).toEqual(labels);
  });
};

beforeEach(() => {
  sessionStorage.clear();
});

/** 詳情子頁籤(#428;ADR-0011「頁籤兩種」):帶識別碼的隱藏頁每一筆各一個 tab,標籤「所屬模組名 — 項目名」由頁面提供。 */
describe("RouteTabs:詳情子頁籤(itemLabel)", () => {
  it("從列表點「檢視」:生成子頁籤、選中,資料到了顯示「示範模組1 — 項目名」", async () => {
    const { user } = renderSampleOne();
    const list = await findTabList();
    const row = await findRowOf("醬燒雞腿排");

    await user.click(
      within(row).getByRole("button", { name: "檢視「醬燒雞腿排」" }),
    );

    await waitFor(() => {
      expect(tabLabels(list)).toEqual(["示範模組1", DETAIL_LABEL]);
    });
    expect(
      within(list).getByRole("tab", { name: DETAIL_LABEL }),
    ).toHaveAttribute("aria-selected", "true");
    expect(readStoredEntries(STORAGE_KEY)).toEqual([
      { route: SAMPLE_ONE_ROUTES.list },
      { route: VIEW_ONE, itemLabel: "醬燒雞腿排" },
    ]);
  });

  it("詳情 → 編輯:同一筆的編輯頁另開一個子頁籤(以完整網址去重),項目資料已在快取也照樣帶到標籤", async () => {
    const { user } = renderSampleOne({ path: VIEW_ONE });
    const list = await findTabList();
    await screen.findByRole("heading", { name: "醬燒雞腿排" });

    await user.click(screen.getByRole("button", { name: "編輯" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(EDIT_ONE);
    });
    await waitFor(() => {
      expect(tabLabels(list)).toEqual([DETAIL_LABEL, DETAIL_LABEL]);
    });
    expect(readStoredEntries(STORAGE_KEY).map((entry) => entry.route)).toEqual([
      VIEW_ONE,
      EDIT_ONE,
    ]);
  });

  it("不同筆各一個子頁籤;直接開網址(沒經過列表)也生成", async () => {
    const first = renderSampleOne({ path: VIEW_ONE });
    await expectTabs([DETAIL_LABEL]);
    first.unmount();

    renderSampleOne({ path: `${SAMPLE_ONE_ROUTES.viewPage}/demo-2` });
    await expectTabs([DETAIL_LABEL, "示範模組1 — 涼拌小黃瓜"]);
  });

  it("關閉當前的子頁籤 → 切到相鄰(左邊的列表)", async () => {
    const { user } = renderSampleOne();
    const list = await findTabList();
    const row = await findRowOf("醬燒雞腿排");
    await user.click(
      within(row).getByRole("button", { name: "檢視「醬燒雞腿排」" }),
    );
    await waitFor(() => {
      expect(tabLabels(list)).toEqual(["示範模組1", DETAIL_LABEL]);
    });

    await user.click(
      within(list).getByRole("button", { name: `關閉 ${DETAIL_LABEL}` }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        SAMPLE_ONE_ROUTES.list,
      );
    });
    expect(tabLabels(list)).toEqual(["示範模組1"]);
    expect(readStoredEntries(STORAGE_KEY)).toEqual([
      { route: SAMPLE_ONE_ROUTES.list },
    ]);
  });

  it("重新整理後保留:標籤從 sessionStorage 讀回(不必再進那一頁);沒綁詳情頁了就剔除", async () => {
    const first = renderSampleOne({ path: VIEW_ONE });
    await expectTabs([DETAIL_LABEL]);
    first.unmount();

    // 重新載入落在列表:子頁籤與它的標籤都還在
    const second = renderSampleOne();
    await expectTabs([DETAIL_LABEL, "示範模組1"]);
    second.unmount();

    // 角色改了、不再綁詳情頁:重新載入後子頁籤被剔除(與路由防守同一條判斷)
    renderSampleOne({ permissions: VIEW_ONLY, pages: ["list"] });
    await expectTabs(["示範模組1"]);
  });

  it("既有存檔格式相容:只有 `route` 的舊紀錄照常讀回,子頁籤沒有標籤時先顯示網址對上的模組名", async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { route: SAMPLE_ONE_ROUTES.list },
        { route: `${SAMPLE_ONE_ROUTES.viewPage}/demo-2` },
      ]),
    );

    renderSampleOne();

    await expectTabs(["示範模組1", "示範項目詳情"]);
  });

  it("示範模組2 的詳情頁同樣接上:「示範模組2 — 項目名」", async () => {
    renderSampleTwo({ path: `${SAMPLE_TWO_ROUTES.viewPage}/demo-two-1` });

    await expectTabs(["示範模組2 — 對照組項目A"]);
  });
});
