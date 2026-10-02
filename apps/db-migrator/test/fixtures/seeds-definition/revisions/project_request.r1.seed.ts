/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "form-definition",
  key: "project_request",
  revision: "r1",
  name: "專案申請單",
  changelog: "初版:${不會被執行} 與 `反引號` 都只是文字",
  desiredStatus: "published",
  moduleKey: "project-form",
  tabLabelTemplate: "{{title}}",
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
        key: "applicant",
        label: "申請人",
        type: "reference",
        widget: {
          kind: "referencePicker",
        },
        valueSource: {
          kind: "input",
        },
        source: {
          provider: "user",
          labelField: "name",
          filter: {
            enabled: true,
          },
        },
        default: {
          kind: "expression",
          expr: {
            var: "ctx.user.id",
          },
        },
      },
      {
        key: "gender",
        label: "性別",
        type: "select",
        widget: {
          kind: "dropdown",
        },
        valueSource: {
          kind: "input",
        },
        options: {
          kind: "fieldCategory",
          key: "gender",
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
        visibleWhen: {
          "==": [
            {
              var: "applicant",
            },
            {
              var: "ctx.user.id",
            },
          ],
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
                  fieldKey: "applicant",
                  span: 6,
                },
                {
                  fieldKey: "gender",
                  span: 6,
                },
              ],
            },
            {
              cols: [
                {
                  fieldKey: "amount",
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
      amount: "amount",
    },
    prefills: [],
  },
} satisfies SeedSet;
