import type { Meta, StoryObj } from "@storybook/react-vite";

import { SelectField } from "./SelectField";

const branches = [
  { value: "org-1", label: "台北分店" },
  { value: "org-2", label: "高雄分店" },
  { value: "org-3", label: "台中分店(管理範圍外)", disabled: true },
];

const meta = {
  title: "Components/SelectField",
  component: SelectField,
  args: {
    label: "分店",
    value: "org-1",
    options: branches,
    onChange: () => {
      // 受控元件:story 只看外觀,不真的換值
    },
    sx: { width: 280 },
  },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 表單下拉:Figma Draft/Select 70:219 的 outlined 變體(浮動標籤 + 外框)。 */
export const Default: Story = {};

export const WithHelper: Story = {
  args: { helperText: "角色的管轄邊界,建立後不可改" },
};

export const ErrorState: Story = {
  args: { error: true, helperText: "請選擇分店" },
};

export const Disabled: Story = { args: { disabled: true } };

export const Small: Story = { args: { size: "small" } };

/** 空值項(「未指定」「全部」):放進 `options` 並開 `displayEmpty`,標籤釘在上緣。 */
export const DisplayEmpty: Story = {
  args: {
    value: "",
    displayEmpty: true,
    options: [{ value: "", label: "未指定" }, ...branches],
  },
};

/** 多選:選項前帶勾選框,收合時預設串起選到的文字。 */
export const Multiple: Story = {
  render: (args) => (
    <SelectField
      multiple
      label={args.label}
      options={args.options}
      sx={args.sx}
      value={["org-1", "org-2"]}
      onChange={() => {
        // 受控元件:story 只看外觀,不真的換值
      }}
    />
  ),
};
