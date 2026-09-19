import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { Table, type TableColumn } from "./Table";

interface DemoRow {
  id: string;
  name: string;
  account: string;
}

const columns: TableColumn<DemoRow>[] = [
  {
    key: "name",
    header: "姓名",
    render: (row) => row.name,
    isEmphasized: true,
  },
  { key: "account", header: "帳號", render: (row) => row.account },
];

const rows: DemoRow[] = [
  { id: "u1", name: "王小明", account: "ming" },
  { id: "u2", name: "陳小華", account: "hua" },
];

const getRowKey = (row: DemoRow) => row.id;

describe("Table", () => {
  it("有資料時渲染表頭與每一列", () => {
    render(<Table columns={columns} rows={rows} getRowKey={getRowKey} />);

    expect(screen.getByText("姓名")).not.toBeNull();
    expect(screen.getByText("帳號")).not.toBeNull();
    expect(screen.getByText("王小明")).not.toBeNull();
    expect(screen.getByText("陳小華")).not.toBeNull();
  });

  it("沒有資料時顯示空狀態文案", () => {
    render(<Table columns={columns} rows={[]} getRowKey={getRowKey} />);

    expect(screen.getByText("目前沒有資料")).not.toBeNull();
  });

  it("空狀態文案可由呼叫端指定", () => {
    render(
      <Table
        columns={columns}
        rows={[]}
        getRowKey={getRowKey}
        emptyMessage="找不到符合條件的使用者"
      />,
    );

    expect(screen.getByText("找不到符合條件的使用者")).not.toBeNull();
  });

  it("載入中時顯示載入指示,且不渲染任何資料列", () => {
    render(
      <Table columns={columns} rows={rows} getRowKey={getRowKey} isLoading />,
    );

    expect(screen.getByLabelText("載入中")).not.toBeNull();
    expect(screen.queryByText("王小明")).toBeNull();
  });

  it("載入中時不顯示空狀態文案", () => {
    render(
      <Table columns={columns} rows={[]} getRowKey={getRowKey} isLoading />,
    );

    expect(screen.queryByText("目前沒有資料")).toBeNull();
  });

  /** #183:容器比 `minWidth` 窄時要橫向捲,而不是把欄位擠成折行。 */
  it("minWidth 給到表格上,未給時不設限", () => {
    const { container: withMin } = render(
      <Table
        columns={columns}
        rows={rows}
        getRowKey={getRowKey}
        minWidth={832}
      />,
    );
    expect(
      globalThis.getComputedStyle(withMin.querySelector("table") as HTMLElement)
        .minWidth,
    ).toBe("832px");

    const { container: withoutMin } = render(
      <Table columns={columns} rows={rows} getRowKey={getRowKey} />,
    );
    expect(
      globalThis.getComputedStyle(
        withoutMin.querySelector("table") as HTMLElement,
      ).minWidth,
    ).toBe("");
  });
});
