/* eslint-disable @repo/no-raw-model-query -- 退役權限清理的跨租戶計數:必須數到**全部**租戶的提交(含操作者可見範圍 / 資料範圍規則之外的),少算就會把還有草稿在用的權限刪掉;只回計數、不回任何提交內容;到期條件:無 */
import type { Model } from "mongoose";

import type { FormSubmission } from "./schemas/form-submission.schema";

/** 某張表單的某幾個版本,被多少提交用到(依狀態分)。 */
export interface FormSubmissionUsage {
  /** 草稿(6b 起含審核中):有任何一筆就擋下刪除。 */
  draftCount: number;
  draftVersions: number[];
  /** 已完成:要使用者確認才刪。 */
  completedCount: number;
  completedVersions: number[];
}

interface UsageRow {
  _id: { status: string; version: number };
  count: number;
}

/**
 * 退役權限清理(Spec 6a §6「root 清理」)的三層檢查要的計數。
 *
 * 為什麼不經 `BaseRepository`:那一層一定套可見範圍與資料範圍規則(ADR-0005 / ADR-0008),
 * 這裡的判斷卻必須 fail-closed —— 任何一筆沒被數到的草稿都會讓權限被誤刪、那一欄就只剩 root 看得到。
 * 所以直接對 collection 聚合,只回數字與版本號,不把任何一筆提交交給呼叫端。
 */
export class FormSubmissionUsageCounter {
  constructor(private readonly model: Model<FormSubmission>) {}

  async usageOf(
    formKey: string,
    versions: readonly number[],
  ): Promise<FormSubmissionUsage> {
    const usage: FormSubmissionUsage = {
      draftCount: 0,
      draftVersions: [],
      completedCount: 0,
      completedVersions: [],
    };
    if (versions.length === 0) {
      return usage;
    }
    const rows = await this.model
      .aggregate<UsageRow>([
        {
          $match: {
            formKey,
            version: { $in: [...versions] },
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: { status: "$status", version: "$version" },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    const drafts = new Set<number>();
    const completed = new Set<number>();
    for (const row of rows) {
      if (row._id.status === "completed") {
        usage.completedCount += row.count;
        completed.add(row._id.version);
      } else {
        // 草稿與日後的審核中都算「還在填 / 還在審」:擋下
        usage.draftCount += row.count;
        drafts.add(row._id.version);
      }
    }
    usage.draftVersions = [...drafts].toSorted((a, b) => a - b);
    usage.completedVersions = [...completed].toSorted((a, b) => a - b);
    return usage;
  }
}
