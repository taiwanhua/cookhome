/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

/** 當成 migration 的依賴時,引用的欄位類別與表單模組以快照當前置(目前 registry 只 import 下面的 seed)。 */
export const requiresSeeds = [
  "project/revisions/ticket-priority.c1.seed.ts",
  "project/revisions/project-form-module.m1.seed.ts",
];

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "form-definition",
  key: "update_ticket",
  revision: "r3",
  name: "工單",
  changelog: "第三版:加上備註",
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
                  span: 8,
                },
                {
                  fieldKey: "priority",
                  span: 4,
                },
              ],
            },
            {
              cols: [
                {
                  fieldKey: "note",
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
