import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs } from "./Tabs";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  args: {
    value: "matrix",
    items: [
      { value: "matrix", label: "權限設定" },
      { value: "users", label: "分配使用者" },
    ],
    "aria-label": "角色分頁",
    onChange: () => {
      // 受控元件:story 只看外觀,不真的換頁籤
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Figma `Draft/Tabs` 252:14:選中的那格主色底線,整列下方一條分隔線。 */
export const Default: Story = {};

export const SecondSelected: Story = { args: { value: "users" } };

/** 切不過去的頁籤(權限不足、資料還沒到)。 */
export const WithDisabled: Story = {
  args: {
    items: [
      { value: "matrix", label: "權限設定" },
      { value: "users", label: "分配使用者", disabled: true },
    ],
  },
};

/** `value` 指到不存在的頁籤時整列都不選中(資料剛換掉的瞬間)。 */
export const NoneSelected: Story = { args: { value: "gone" } };
