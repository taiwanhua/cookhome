import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tag } from "./Tag";

const meta = {
  title: "Components/Tag",
  component: Tag,
  args: { label: "標籤" },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grey: Story = { args: { tone: "grey", label: "停用" } };
export const Primary: Story = { args: { tone: "primary", label: "群組" } };
export const Success: Story = { args: { tone: "success", label: "啟用" } };
export const Warning: Story = { args: { tone: "warning", label: "隱藏頁" } };
export const Danger: Story = { args: { tone: "error", label: "組織外" } };

/** 可關閉:用於已選項目的移除(所屬組織、角色)。 */
export const Deletable: Story = {
  args: {
    tone: "primary",
    label: "客服",
    onDelete: () => {
      // story 只示範外觀,不需要真的移除
    },
  },
};
