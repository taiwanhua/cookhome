/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "form-definition",
  key: "update_ticket",
  revision: "r1",
  name: "工單",
  changelog: "初版:只有主旨",
  desiredStatus: "published",
  moduleKey: "project-form",
  tabLabelTemplate: null,
  definition: {
    fields: [
      {
        key: "title",
        label: "主旨",
        type: "text",
        widget: {
          kind: "textField",
        },
        valueSource: {
          kind: "input",
        },
        rules: {
          required: true,
          maxLength: 50,
        },
      },
    ],
    layout: {
      sections: [
        {
          key: "basic",
          title: "基本資料",
          rows: [
            {
              cols: [
                {
                  fieldKey: "title",
                  span: 12,
                },
              ],
            },
          ],
        },
      ],
    },
    summaryMap: {
      title: "title",
    },
    prefills: [],
  },
} satisfies SeedSet;
