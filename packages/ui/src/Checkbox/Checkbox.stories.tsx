import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./Checkbox";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  args: { slotProps: { input: { "aria-label": "開放此模組" } } },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { indeterminate: true } };
/** 防越權下放:授權人沒有的權限灰化。 */
export const DisabledUnchecked: Story = { args: { disabled: true } };
/** wildcard 隱含勾選:已被上層「全部(*)」涵蓋,不可取消。 */
export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
};
