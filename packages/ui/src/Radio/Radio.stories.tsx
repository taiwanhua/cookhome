import type { Meta, StoryObj } from "@storybook/react-vite";

import { FormControlLabel } from "../FormControlLabel/FormControlLabel";
import { Radio } from "./Radio";
import { RadioGroup } from "./RadioGroup";

const meta = {
  title: "Components/Radio",
  component: Radio,
  args: { slotProps: { input: { "aria-label": "寄啟用信" } } },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};
export const Selected: Story = { args: { checked: true, readOnly: true } };
export const Disabled: Story = { args: { disabled: true } };

/** 群組:新增使用者的「啟用方式」。 */
export const InGroup: Story = {
  render: () => (
    <RadioGroup name="activation" defaultValue="email">
      <FormControlLabel value="email" control={<Radio />} label="寄啟用信" />
      <FormControlLabel
        value="password"
        control={<Radio />}
        label="設定初始密碼"
      />
    </RadioGroup>
  ),
};
