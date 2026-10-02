/* eslint-disable unicorn/filename-case -- 定義快照的檔名固定為 <key>.<revision>.seed.ts,表單 / 流程 key 是底線格式;到期條件:匯出檔名規則或 key 格式改變時移除 */
import type { SeedSet } from "@repo/domain/seed";

// 匯出的種子快照:不要手改內容或重新排版。
// prettier-ignore
export const seed = {
  kind: "workflow-definition",
  key: "reset_review",
  revision: "r1",
  name: "訂購審核流程",
  changelog: "初版",
  desiredStatus: "published",
  checkFormKey: "reset_order",
  definition: {
    steps: [
      {
        key: "boss",
        name: "直屬主管",
        assignee: {
          kind: "manager",
          level: 1,
        },
        mode: "any",
      },
    ],
  },
} satisfies SeedSet;
