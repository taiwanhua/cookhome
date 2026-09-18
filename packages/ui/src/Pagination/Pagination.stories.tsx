import type { Meta, StoryObj } from "@storybook/react-vite";

import { Pagination } from "./Pagination";

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  args: { count: 10, page: 3 },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: "small" } };
export const WithFirstLastButtons: Story = {
  args: { showFirstButton: true, showLastButton: true },
};
export const SinglePage: Story = { args: { count: 1, page: 1 } };
export const Disabled: Story = { args: { disabled: true } };
