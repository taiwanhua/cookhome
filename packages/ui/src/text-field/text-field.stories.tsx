import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextField } from ".";

const meta = {
  title: "Components/TextField",
  component: TextField,
  args: { label: "食譜名稱" },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHelper: Story = {
  args: { helperText: "給這道菜取個名字" },
};
export const ErrorState: Story = {
  args: { error: true, helperText: "名稱不可為空" },
};
export const Disabled: Story = { args: { disabled: true } };
