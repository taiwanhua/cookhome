import type { Meta, StoryObj } from "@storybook/react-vite";

import { Box } from "../Box/Box";
import { Badge } from "./Badge";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: { badgeContent: 3 },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 行內(頁籤文字右側):主色。 */
export const Primary: Story = { args: { color: "primary", badgeContent: 3 } };

/** 行內:灰底(次要的數字)。 */
export const Default: Story = { args: { color: "default", badgeContent: 12 } };

/** 超過 99 顯示 `99+`。 */
export const OverMax: Story = { args: { color: "primary", badgeContent: 120 } };

/** 圓點(收合的側欄只標「有待辦」)。 */
export const Dot: Story = {
  args: { color: "primary", variant: "dot" },
  render: (args) => (
    <Badge {...args}>
      <Box sx={{ width: 24, height: 24, bgcolor: "grey.200" }} />
    </Badge>
  ),
};

/** 頁籤文字旁的樣子。 */
export const NextToText: Story = {
  args: { color: "primary", badgeContent: 5 },
  render: (args) => (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      待我審核
      <Badge {...args} />
    </Box>
  ),
};
