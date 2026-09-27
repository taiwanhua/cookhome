import type { Meta, StoryObj } from "@storybook/react-vite";

import { Box } from "../Box/Box";
import { Grid } from "./Grid";

const cell = (label: string) => (
  <Box
    sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1, textAlign: "center" }}
  >
    {label}
  </Box>
);

const meta = {
  title: "Components/Grid",
  component: Grid,
  args: { container: true, spacing: 2 },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 12 格:桌機 4 + 4 + 4,平板 6 + 6 + 12,手機一格一列。 */
export const Responsive: Story = {
  render: (args) => (
    <Grid {...args}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>{cell("甲")}</Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>{cell("乙")}</Grid>
      <Grid size={{ xs: 12, sm: 12, md: 4 }}>{cell("丙")}</Grid>
    </Grid>
  ),
};

/** 表單引擎的一列:span 3 + 9(平板 ×2 封頂 12、手機一律 12)。 */
export const FormRow: Story = {
  render: (args) => (
    <Grid {...args}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>{cell("span 3")}</Grid>
      <Grid size={{ xs: 12, sm: 12, md: 9 }}>{cell("span 9")}</Grid>
    </Grid>
  ),
};
