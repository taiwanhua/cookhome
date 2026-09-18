import type { Meta, StoryObj } from "@storybook/react-vite";

import { type TableColumn, Table } from "./Table";

interface DemoUser {
  id: string;
  name: string;
  account: string;
  org: string;
}

const columns: TableColumn<DemoUser>[] = [
  { key: "name", header: "姓名", render: (row) => row.name, isEmphasized: true },
  { key: "account", header: "帳號", render: (row) => row.account },
  { key: "org", header: "所屬組織", render: (row) => row.org },
];

const rows: DemoUser[] = [
  { id: "u1", name: "王小明", account: "ming", org: "台北分店" },
  { id: "u2", name: "陳小華", account: "hua", org: "高雄分店" },
  { id: "u3", name: "林大同", account: "tong", org: "總部" },
];

const meta = {
  title: "Components/Table",
  component: Table,
  args: {
    columns,
    rows,
    getRowKey: (row: DemoUser) => row.id,
    "aria-label": "使用者清單",
  },
} satisfies Meta<typeof Table<DemoUser>>;

export default meta;
// 泛型元件:Story 直接綁在實例化過的 Table<DemoUser> 上,args 才保有 DemoUser 型別
type Story = StoryObj<typeof Table<DemoUser>>;

export const Default: Story = {};
export const Compact: Story = { args: { size: "small" } };
export const Clickable: Story = {
  args: {
    onRowClick: (row: DemoUser) => {
      globalThis.console.log("row clicked", row.id);
    },
  },
};
export const Empty: Story = { args: { rows: [] } };
export const EmptyWithCustomMessage: Story = {
  args: { rows: [], emptyMessage: "找不到符合條件的使用者" },
};
export const Loading: Story = { args: { isLoading: true } };
