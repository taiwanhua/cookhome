import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "../Checkbox/Checkbox";
import { Switch } from "../Switch/Switch";
import { FormControlLabel } from "./FormControlLabel";

const meta = {
  title: "Components/FormControlLabel",
  component: FormControlLabel,
  args: { control: <Checkbox />, label: "開放此模組" },
} satisfies Meta<typeof FormControlLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCheckbox: Story = {};
export const WithSwitch: Story = {
  args: { control: <Switch />, label: "啟用" },
};
export const LabelBefore: Story = { args: { labelPlacement: "start" } };
export const Disabled: Story = { args: { disabled: true } };
