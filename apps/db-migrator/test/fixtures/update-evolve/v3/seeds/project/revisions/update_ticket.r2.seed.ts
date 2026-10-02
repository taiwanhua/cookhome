/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

/** 這一版引用的欄位類別(版本 1 還不存在)與表單模組:以當時的普通種子快照當前置。 */
export const requiresSeeds = [
  "project/revisions/ticket-priority.c1.seed.ts",
  "project/revisions/project-form-module.m1.seed.ts",
];

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "form-definition",
  key: "update_ticket",
  revision: "r2",
  name: "工單",
  changelog: "第二版:加上優先度",
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
        key: "priority",
        label: "優先度",
        type: "select",
        widget: {
          kind: "dropdown",
        },
        valueSource: {
          kind: "input",
        },
        options: {
          kind: "fieldCategory",
          key: "ticket-priority",
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
                  span: 8,
                },
                {
                  fieldKey: "priority",
                  span: 4,
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
