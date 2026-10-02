/**
 * update 流程的檢查點(正式執行只是放行)。
 *
 * 為什麼有它:update 沒有交易,一致性靠「每一步之前先記 journal,任何一步失敗就停在做到一半的樣子,
 * 下次依紀錄接續」。要驗每個故障窗口重跑後都收斂,測試必須能讓指定的那一步**真的**在半路停下
 * (丟錯,或直接結束程序模擬硬中止)—— 與 api 的 `SeedInstallHooks` 同一個理由。
 *
 * 各檢查點都在它名字所指的那筆寫入**之後**:
 * - `migration-preparing`:已記 preparing,尚未安裝任何依賴
 * - `dependency-installed`:一份依賴已由 api 安裝,尚未記檢查點
 * - `dependency-recorded`:該依賴的檢查點已記
 * - `migration-started`:已記 started(含 context),尚未執行 up
 * - `migration-up-done`:up 已回傳,尚未 verify
 * - `migration-verified`:已記 verified,migrate-mongo 尚未記 changelog
 * - `migration-recorded`:changelog 已記,journal 尚未標成 applied
 * - `seeds-applied`:目前的普通種子已套用,尚未發布定義
 * - `definitions-applied`:目前的定義已發布,尚未做最後核對
 * - `rollback-started`:已記 rollback-in-progress,尚未執行 down
 * - `rollback-done`:down 已完成、changelog 紀錄已刪,尚未標成 rolled-back
 */
export const UPDATE_CHECKPOINTS = [
  "migration-preparing",
  "dependency-installed",
  "dependency-recorded",
  "migration-started",
  "migration-up-done",
  "migration-verified",
  "migration-recorded",
  "seeds-applied",
  "definitions-applied",
  "rollback-started",
  "rollback-done",
] as const;

export type UpdateCheckpoint = (typeof UPDATE_CHECKPOINTS)[number];

export interface UpdateHooks {
  /** `subject`:這個檢查點是哪一支 migration / 哪一份依賴的(沒有為 null)。 */
  reached(checkpoint: UpdateCheckpoint, subject: string | null): Promise<void>;
}

export const NO_UPDATE_HOOKS: UpdateHooks = {
  reached: () => Promise.resolve(),
};
