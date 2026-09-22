import type { Meta, StoryObj } from "@storybook/react-vite";

import { Snackbar } from "./Snackbar";

const meta = {
  title: "Components/Snackbar",
  component: Snackbar,
  args: {
    open: true,
    closeLabel: "關閉",
    onClose: () => {
      // story 只看外觀:關閉由呼叫端(app 的 SnackbarProvider)接手
    },
  },
} satisfies Meta<typeof Snackbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 成功:新增 / 編輯 / 刪除送出後的預設回饋。 */
export const Success: Story = {
  args: {
    severity: "success",
    message: "已儲存",
  },
};

/** 失敗:文案來自各頁既有的錯誤解讀(`<ns>ErrorOf` + `errors.<code>`)。 */
export const Failure: Story = {
  args: {
    severity: "error",
    message: "沒有權限執行這個動作。",
  },
};

/** 長文案:一行放不下時 Alert 自己換行,關閉鈕維持垂直置中。 */
export const LongMessage: Story = {
  args: {
    severity: "error",
    message:
      "這個角色仍被 3 位使用者持有,請先解除授權後再刪除;若對象在管理範圍外,請聯絡該組織的管理員。",
  },
};

/** 不自動關閉(`autoHideDuration` 給 null):只能按關閉鈕。 */
export const NoAutoHide: Story = {
  args: {
    severity: "success",
    message: "已送出,等待處理",
    autoHideDuration: null,
  },
};
