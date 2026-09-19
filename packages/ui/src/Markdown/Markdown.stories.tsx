import type { Meta, StoryObj } from "@storybook/react-vite";

import { Markdown } from "./Markdown";

const meta = {
  title: "Components/Markdown",
  component: Markdown,
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Draft/HelpDialog 95:235 的內文:模組說明 help.md 的典型形狀(小節標題 + 段落 + 清單)。 */
export const ModuleHelp: Story = {
  args: {
    children: [
      "## 這個模組做什麼",
      "",
      "角色是一組權限的集合,由單一組織擁有並自行管理;把角色授予使用者,他就取得對應的功能。",
      "",
      "## 常用操作",
      "",
      "- **建立/編輯角色**:選擇所屬組織、名稱與描述。",
      String.raw`- **權限設定**:逐項勾選,或勾「全部(\*)」。`,
      "- **分配使用者**:僅能選擇此角色所屬組織**或其下層組織**的使用者。",
    ].join("\n"),
  },
};

/** GFM 表格(remark-gfm):規範文件常用。 */
export const Table: Story = {
  args: {
    children: [
      "| 權限 | 說明 |",
      "| --- | --- |",
      "| 檢視 | 看得到這個頁面 |",
      "| 編輯 | 可以修改既有資料 |",
    ].join("\n"),
  },
};

/** raw HTML 不被渲染(沒掛 rehype-raw):下面的 `<b>` 不會變成粗體,也不會進 DOM。 */
export const RawHtmlIsDropped: Story = {
  args: {
    children: '這行安全。\n\n<b id="raw">這段 raw HTML 會被丟掉</b>',
  },
};
