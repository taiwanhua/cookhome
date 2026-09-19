import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tag } from "../Tag/Tag";
import { type TreeNode, Tree } from "./Tree";

const items: TreeNode[] = [
  {
    id: "root",
    label: "CookHome",
    children: [
      {
        id: "org-1",
        label: "台北分店",
        children: [
          { id: "org-1-1", label: "內場" },
          { id: "org-1-2", label: "外場" },
        ],
      },
      { id: "org-2", label: "高雄分店" },
      { id: "org-3", label: "台中分店(可見範圍外)", disabled: true },
    ],
  },
];

const meta = {
  title: "Components/Tree",
  component: Tree,
  args: {
    items,
    defaultExpandedIds: ["root", "org-1"],
    "aria-label": "組織樹",
  },
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 選取模式(單選):組織管理頁的主樹 */
export const SingleSelect: Story = {
  args: { defaultSelectedIds: ["org-1"] },
};

/** 選取模式(多選) */
export const MultiSelect: Story = {
  args: { multiSelect: true, defaultSelectedIds: ["org-1-1", "org-2"] },
};

/** 勾選模式:選擇所屬組織彈窗 */
export const CheckboxSelection: Story = {
  args: {
    checkboxSelection: true,
    multiSelect: true,
    defaultSelectedIds: ["org-2"],
  },
};

/** 標籤槽位:停用的組織在名稱右側掛一個 `Tag`(Figma Draft/OrgTreeItem 的 ShowTag) */
export const WithLabelSuffix: Story = {
  args: {
    items: [
      {
        id: "root",
        label: "CookHome",
        children: [
          {
            id: "org-1",
            label: "台北分店",
            labelSuffix: <Tag tone="grey" label="租戶" />,
          },
          {
            id: "org-2",
            label: "高雄分店",
            labelSuffix: <Tag tone="error" label="停用" />,
          },
        ],
      },
    ],
  },
};

export const Collapsed: Story = { args: { defaultExpandedIds: [] } };

export const Loading: Story = { args: { isLoading: true } };
