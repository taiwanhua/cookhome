import type { Meta, StoryObj } from "@storybook/react-vite";

import { DateTimePicker } from "./DateTimePicker";

const meta = {
  title: "Components/DateTimePicker",
  component: DateTimePicker,
  args: {
    label: "開始時間",
    timezone: "Asia/Taipei",
  },
} satisfies Meta<typeof DateTimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 表單引擎的 `datetime` 欄位:值存 UTC,以租戶時區(此例台北)輸入與顯示。 */
export const Default: Story = {
  args: { value: "2026-03-01T01:30:00Z" },
};

export const Empty: Story = {
  args: { value: null },
};

/** 同一個時點換成東京時區顯示(+1 小時)。 */
export const OtherTimezone: Story = {
  args: { value: "2026-03-01T01:30:00Z", timezone: "Asia/Tokyo" },
};

/** 欄位的上下限(`rules.min` / `max`)。 */
export const WithRange: Story = {
  args: {
    value: "2026-03-10T02:00:00Z",
    minDateTime: "2026-03-01T00:00:00Z",
    maxDateTime: "2026-03-31T15:59:59Z",
  },
};

export const WithError: Story = {
  args: { value: null, error: true, helperText: "請選時間" },
};

export const Disabled: Story = {
  args: { value: "2026-03-01T01:30:00Z", disabled: true },
};

export const Small: Story = {
  args: { value: "2026-03-01T01:30:00Z", size: "small" },
};
