/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "form-definition",
  key: "reset_order",
  revision: "r2",
  name: "訂購單",
  changelog: "第二版:備註不再有欄位級權限(該權限退役)",
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
      {
        key: "amount",
        label: "金額",
        type: "number",
        precision: 0,
        widget: {
          kind: "number",
        },
        valueSource: {
          kind: "input",
        },
        permission: {
          show: true,
          edit: true,
        },
      },
      {
        key: "note",
        label: "備註",
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
                  fieldKey: "title",
                  span: 12,
                },
              ],
            },
            {
              cols: [
                {
                  fieldKey: "amount",
                  span: 6,
                },
                {
                  fieldKey: "note",
                  span: 6,
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
