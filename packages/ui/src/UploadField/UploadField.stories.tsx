import type { Meta, StoryObj } from "@storybook/react-vite";

import { UploadField } from "./UploadField";

const meta = {
  title: "Components/UploadField",
  component: UploadField,
  args: {
    label: "商標(選填)",
    hint: "PNG / JPG,建議正方形,2MB 以內",
    accept: ["image/png", "image/jpeg"],
    maxSize: 2 * 1024 * 1024,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof UploadField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 空狀態:點擊或拖放選檔 */
export const Empty: Story = {};

export const WithoutHint: Story = { args: { hint: undefined } };

export const Disabled: Story = { args: { isDisabled: true } };

/** 只收 PDF,示範 accept 換成別的型別 */
export const PdfOnly: Story = {
  args: {
    label: "附件",
    hint: "PDF,10MB 以內",
    accept: [".pdf"],
    maxSize: 10 * 1024 * 1024,
  },
};
