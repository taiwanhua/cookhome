import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from ".";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "按鈕" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Contained: Story = {};
export const Outlined: Story = { args: { variant: "outlined" } };
export const Text: Story = { args: { variant: "text" } };
export const Disabled: Story = { args: { disabled: true } };
export const Large: Story = { args: { size: "large", children: "大尺寸按鈕" } };
