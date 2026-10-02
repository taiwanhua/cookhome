/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "form-definition",
  key: "update_legacy",
  revision: "r1",
  name: "舊版登記表",
  changelog: "初版(之後的版本不再登記這張表)",
  desiredStatus: "published",
  moduleKey: "project-form",
  tabLabelTemplate: null,
  definition: {
    fields: [
      {
        key: "subject",
        label: "事由",
        type: "text",
        widget: {
          kind: "textField",
        },
        valueSource: {
          kind: "input",
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
                  fieldKey: "subject",
                  span: 12,
                },
              ],
            },
          ],
        },
      ],
    },
    summaryMap: {
      title: "subject",
    },
    prefills: [],
  },
} satisfies SeedSet;
