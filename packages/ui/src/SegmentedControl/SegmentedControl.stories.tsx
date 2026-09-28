import type { Meta, StoryObj } from "@storybook/react-vite";

import { DarkModeIcon } from "../icons/DarkModeIcon";
import { LightModeIcon } from "../icons/LightModeIcon";
import { SystemModeIcon } from "../icons/SystemModeIcon";
import { SegmentedControl } from "./SegmentedControl";

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  args: {
    value: "system",
    options: [
      { value: "system", label: "跟隨系統", icon: <SystemModeIcon /> },
      { value: "light", label: "亮", icon: <LightModeIcon /> },
      { value: "dark", label: "暗", icon: <DarkModeIcon /> },
    ],
    "aria-label": "外觀",
    // Figma `Draft/AdminUserMenu` 278:77 裡分段按鈕的寬度(選單 260 扣掉內距)
    sx: { width: 220 },
    onChange: () => {
      // 受控元件:story 只看外觀,不真的換選項
    },
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Figma 275:88:帶圖示的三段(外觀),選中「跟隨系統」。 */
export const WithIcons: Story = {};

export const LastSelected: Story = { args: { value: "dark" } };

/** Figma 275:103:純文字兩段(語言)。 */
export const TextOnly: Story = {
  args: {
    value: "zh-TW",
    options: [
      { value: "zh-TW", label: "繁體中文" },
      { value: "en", label: "English" },
    ],
    "aria-label": "語言",
  },
};
