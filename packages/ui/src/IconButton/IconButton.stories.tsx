import type { Meta, StoryObj } from "@storybook/react-vite";

import { CloseIcon } from "../icons/CloseIcon";
import { HelpIcon } from "../icons/HelpIcon";
import { IconButton } from "./IconButton";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  args: {
    "aria-label": "關閉",
    children: <CloseIcon fontSize="small" />,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 路由頁籤的關閉鈕。 */
export const Default: Story = {};

export const Small: Story = { args: { size: "small" } };

/** AppBar 的「?」說明鈕(#197):呼叫端用 `sx` 指定平時的顏色。 */
export const Secondary: Story = {
  args: {
    "aria-label": "模組說明",
    children: <HelpIcon fontSize="small" />,
    sx: { color: "text.secondary" },
  },
};

/**
 * 停用(#260):即使呼叫端給了 `sx.color`,停用色照樣蓋得過去 ——
 * `.Mui-disabled` 的 specificity 比 `sx` 產生的單一類別高一級。
 */
export const Disabled: Story = {
  args: {
    "aria-label": "模組說明",
    children: <HelpIcon fontSize="small" />,
    sx: { color: "text.secondary" },
    disabled: true,
  },
};
