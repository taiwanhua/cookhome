import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  cssRulesMatching,
  declaredValue,
  emotionClassOf,
} from "../test/css-rules";
import { DataTable, type DataTableColumn } from "./DataTable";
import type { CellRenderContext } from "./cell-render-context";

interface Order {
  id: string;
  customer: string;
  amount: number;
  note: string | null;
}

const rows: Order[] = [
  { id: "o1", customer: "王小明", amount: 300, note: "少冰" },
  { id: "o2", customer: "陳小華", amount: 120, note: null },
  { id: "o3", customer: "林大同", amount: 560, note: "外帶" },
];

const customerColumn: DataTableColumn<Order> = {
  key: "customer",
  header: "顧客",
  accessor: "customer",
  isSortable: true,
};
const amountColumn: DataTableColumn<Order> = {
  key: "amount",
  header: "金額",
  accessor: "amount",
  isSortable: true,
};
const columns: DataTableColumn<Order>[] = [
  customerColumn,
  amountColumn,
  { key: "note", header: "備註", accessor: "note" },
];

const getRowKey = (row: Order) => row.id;

/**
 * jsdom 不算版面,所有元素的 offsetHeight / offsetWidth 都是 0,虛擬捲動會以為
 * 捲動容器「看得到 0 列」。測試期間給一個固定的視窗大小(600 高 ≈ 11 列 medium)。
 */
const VIEWPORT = { offsetHeight: 600, offsetWidth: 1000 } as const;
const originals = Object.fromEntries(
  Object.keys(VIEWPORT).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
  ]),
);

beforeAll(() => {
  for (const [key, value] of Object.entries(VIEWPORT)) {
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get: () => value,
    });
  }
});

afterAll(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor !== undefined) {
      Object.defineProperty(HTMLElement.prototype, key, descriptor);
    }
  }
});

/** 表身的資料列(扣掉虛擬捲動的留白列)依序的第一格文字。 */
const firstCellTexts = () =>
  screen
    .getAllByRole("row")
    .filter((row) => row.dataset.index !== undefined)
    .map((row) => row.querySelector("td")?.textContent);

/** 含這段文字的最近一層元素(`tr` / `td`);找不到就讓測試失敗。 */
const closestOf = (text: string, selector: "tr" | "td"): HTMLElement => {
  const found = screen.getByText(text).closest<HTMLElement>(selector);
  if (found === null) {
    throw new Error(`「${text}」不在 ${selector} 裡`);
  }
  return found;
};

/** 某一格身上 emotion 實際產生的規則(TEST-09)。 */
const cellRulesOf = (text: string) =>
  cssRulesMatching(`.${emotionClassOf(closestOf(text, "td"))}`);

/** 表頭各欄的文字(補位欄 aria-hidden,不在其中)。 */
const headerTexts = () =>
  screen.getAllByRole("columnheader").map((cell) => cell.textContent);

describe("DataTable", () => {
  describe("渲染簽章 render(ctx)", () => {
    it("ctx 帶 value / row / rows / index / column", () => {
      const renderAmount = jest.fn(
        (ctx: CellRenderContext<Order>) => `NT$ ${String(ctx.value)}`,
      );
      const withRender: DataTableColumn<Order>[] = [
        customerColumn,
        { ...amountColumn, render: renderAmount },
      ];
      render(
        <DataTable columns={withRender} rows={rows} getRowKey={getRowKey} />,
      );

      expect(screen.getByText("NT$ 120")).not.toBeNull();
      const second = renderAmount.mock.calls.find(
        ([ctx]) => ctx.row.id === "o2",
      )?.[0];
      expect(second).toMatchObject({ value: 120, index: 1, rows });
      expect(second?.column).toBe(withRender[1]);
    });

    it("沒給 render 時直接顯示 value;空值不顯示", () => {
      render(<DataTable columns={columns} rows={rows} getRowKey={getRowKey} />);

      expect(screen.getByText("少冰")).not.toBeNull();
      const secondRow = closestOf("陳小華", "tr");
      expect(within(secondRow).getAllByRole("cell")[2]?.textContent).toBe("");
    });

    it("accessor 可以是函式", () => {
      const derived: DataTableColumn<Order>[] = [
        {
          key: "label",
          header: "標籤",
          accessor: (row) => `${row.customer}(${String(row.amount)})`,
        },
      ];
      render(<DataTable columns={derived} rows={rows} getRowKey={getRowKey} />);

      expect(screen.getByText("王小明(300)")).not.toBeNull();
    });
  });

  describe("排序", () => {
    it("點表頭排序鈕回報新排序,依升冪 → 降冪 → 不排序輪替", async () => {
      const onSortChange = jest.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={getRowKey}
          onSortChange={onSortChange}
        />,
      );
      const amount = screen.getByRole("button", { name: "金額" });

      await userEvent.click(amount);
      expect(onSortChange).toHaveBeenLastCalledWith({
        key: "amount",
        direction: "asc",
      });
      expect(firstCellTexts()).toEqual(["陳小華", "王小明", "林大同"]);

      await userEvent.click(amount);
      expect(onSortChange).toHaveBeenLastCalledWith({
        key: "amount",
        direction: "desc",
      });
      expect(firstCellTexts()).toEqual(["林大同", "王小明", "陳小華"]);

      await userEvent.click(amount);
      expect(onSortChange).toHaveBeenLastCalledWith(null);
      expect(firstCellTexts()).toEqual(["王小明", "陳小華", "林大同"]);
    });

    it("受控時照 sort prop 排,表頭標 aria-sort;ctx 的 rows / index 是顯示順序", () => {
      const seen: [string, number, string | undefined][] = [];
      const withRender: DataTableColumn<Order>[] = [
        {
          ...customerColumn,
          render: ({ row, rows: shown, index }) => {
            seen.push([row.id, index, shown[index]?.id]);
            return row.customer;
          },
        },
        amountColumn,
      ];
      render(
        <DataTable
          columns={withRender}
          rows={rows}
          getRowKey={getRowKey}
          sort={{ key: "amount", direction: "desc" }}
        />,
      );

      expect(firstCellTexts()).toEqual(["林大同", "王小明", "陳小華"]);
      expect(
        screen
          .getByRole("columnheader", { name: /^金額/ })
          .getAttribute("aria-sort"),
      ).toBe("descending");
      expect(seen.slice(0, 3)).toEqual([
        ["o3", 0, "o3"],
        ["o1", 1, "o1"],
        ["o2", 2, "o2"],
      ]);
    });

    it("沒標 isSortable 的欄沒有排序鈕", () => {
      render(<DataTable columns={columns} rows={rows} getRowKey={getRowKey} />);

      expect(screen.queryByRole("button", { name: "備註" })).toBeNull();
    });
  });

  describe("欄位固定", () => {
    const pinned: DataTableColumn<Order>[] = [
      { key: "note", header: "備註", accessor: "note", width: 120 },
      {
        key: "amount",
        header: "金額",
        accessor: "amount",
        width: 100,
        pinned: "right",
      },
      {
        key: "customer",
        header: "顧客",
        accessor: "customer",
        width: 140,
        pinned: "left",
      },
    ];

    it("左固定排最前、右固定排最後,補位欄在右固定欄之前", () => {
      const { container } = render(
        <DataTable columns={pinned} rows={rows} getRowKey={getRowKey} />,
      );

      expect(headerTexts()).toEqual(["顧客", "備註", "金額"]);
      const headCells = container.querySelectorAll("thead th");
      expect(headCells[2]?.getAttribute("aria-hidden")).toBe("true");
      const firstRow = closestOf("王小明", "tr");
      expect(
        [...firstRow.querySelectorAll("td")].map((cell) => cell.textContent),
      ).toEqual(["王小明", "少冰", "", "300"]);
    });

    it("固定欄是 sticky、貼齊對應邊,與捲動區相鄰的那一欄有分隔陰影", () => {
      render(<DataTable columns={pinned} rows={rows} getRowKey={getRowKey} />);
      const left = cellRulesOf("王小明");
      expect(declaredValue(left, "position")).toBe("sticky");
      expect(declaredValue(left, "left")).toBe("0");
      expect(declaredValue(left, "box-shadow")).toContain("inset -1px 0 0");

      const right = cellRulesOf("300");
      expect(declaredValue(right, "position")).toBe("sticky");
      expect(declaredValue(right, "right")).toBe("0");
      expect(declaredValue(right, "box-shadow")).toContain("inset 1px 0 0");

      expect(declaredValue(cellRulesOf("少冰"), "position")).toBeNull();
    });
  });

  describe("欄寬", () => {
    it("鍵盤調整後回報新寬度,把手的 aria-valuenow 跟著變", () => {
      const onColumnWidthsChange = jest.fn();
      render(
        <DataTable
          columns={[{ ...customerColumn, width: 200 }]}
          rows={rows}
          getRowKey={getRowKey}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = screen.getByRole("separator", {
        name: "調整「顧客」欄寬",
      });
      expect(handle.getAttribute("aria-valuenow")).toBe("200");

      fireEvent.keyDown(handle, { key: "ArrowRight" });

      expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ customer: 216 });
      expect(handle.getAttribute("aria-valuenow")).toBe("216");
    });

    it("拖拉把手改變欄寬,不低於 minWidth", () => {
      const onColumnWidthsChange = jest.fn();
      render(
        <DataTable
          columns={[{ ...customerColumn, width: 200, minWidth: 120 }]}
          rows={rows}
          getRowKey={getRowKey}
          onColumnWidthsChange={onColumnWidthsChange}
        />,
      );
      const handle = screen.getByRole("separator");

      fireEvent.mouseDown(handle, { clientX: 300 });
      fireEvent.mouseMove(document, { clientX: 350 });
      fireEvent.mouseUp(document, { clientX: 350 });
      expect(handle.getAttribute("aria-valuenow")).toBe("250");

      fireEvent.mouseDown(handle, { clientX: 300 });
      fireEvent.mouseMove(document, { clientX: 0 });
      fireEvent.mouseUp(document, { clientX: 0 });
      expect(handle.getAttribute("aria-valuenow")).toBe("120");
      expect(onColumnWidthsChange).toHaveBeenCalled();
    });

    it("受控欄寬以 columnWidths 為準", () => {
      render(
        <DataTable
          columns={[{ ...customerColumn, width: 200 }]}
          rows={rows}
          getRowKey={getRowKey}
          columnWidths={{ customer: 320 }}
        />,
      );

      expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe(
        "320",
      );
    });
  });

  describe("虛擬捲動", () => {
    it("一萬列只渲染可視範圍附近的列", () => {
      const many: Order[] = Array.from({ length: 10_000 }, (_, index) => ({
        id: `o${String(index)}`,
        customer: `顧客 ${String(index)}`,
        amount: index,
        note: null,
      }));
      render(
        <DataTable
          columns={columns}
          rows={many}
          getRowKey={getRowKey}
          aria-label="訂單"
        />,
      );

      const rendered = firstCellTexts();
      expect(rendered[0]).toBe("顧客 0");
      expect(rendered.length).toBeGreaterThan(5);
      expect(rendered.length).toBeLessThan(40);
      expect(screen.queryByText("顧客 9999")).toBeNull();
      expect(
        screen
          .getByRole("table", { name: "訂單" })
          .getAttribute("aria-rowcount"),
      ).toBe("10001");
    });
  });

  describe("狀態", () => {
    it("沒有資料時顯示空狀態文案", () => {
      render(<DataTable columns={columns} rows={[]} getRowKey={getRowKey} />);

      expect(screen.getByText("目前沒有資料")).not.toBeNull();
    });

    it("載入中顯示載入指示、不渲染資料列、不顯示空狀態", () => {
      render(
        <DataTable
          columns={columns}
          rows={[]}
          getRowKey={getRowKey}
          isLoading
        />,
      );

      expect(screen.getByLabelText("載入中")).not.toBeNull();
      expect(screen.queryByText("目前沒有資料")).toBeNull();
    });

    it("onRowClick 回報被點的那一列", async () => {
      const onRowClick = jest.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={getRowKey}
          onRowClick={onRowClick}
        />,
      );

      await userEvent.click(screen.getByText("陳小華"));

      expect(onRowClick).toHaveBeenCalledWith(rows[1]);
    });
  });
});
