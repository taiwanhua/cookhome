/**
 * reset 流程的檢查點(正式執行只是放行)。
 *
 * 為什麼有它:reset 沒有交易,清除與重建之間任何一步失敗都停在做到一半的樣子,靠鎖上的階段、
 * 執行紀錄與再次明確執行來收斂。要驗每個故障窗口,測試必須能讓指定的那一步**真的**在半路停下
 * (丟錯,或直接結束程序模擬硬中止)—— 與 `update/update-hooks.ts` 同一個理由。
 *
 * 各檢查點都在它名字所指的那一步**之後**:
 * - `reset-prechecked`:預檢全部通過、刪留計畫已輸出,尚未刪除任何資料
 * - `reset-collection-cleared`:一個 collection 已清除(`data` = 刪掉計畫裡的文件,`full` = drop);對象是 collection 名
 * - `reset-cleared`:清除全部完成、這次的執行紀錄已(重)建,尚未開始內部的 update
 */
export const RESET_CHECKPOINTS = [
  "reset-prechecked",
  "reset-collection-cleared",
  "reset-cleared",
] as const;

export type ResetCheckpoint = (typeof RESET_CHECKPOINTS)[number];

export interface ResetHooks {
  /** `subject`:這個檢查點是哪一個 collection 的(沒有為 null)。 */
  reached(checkpoint: ResetCheckpoint, subject: string | null): Promise<void>;
}

export const NO_RESET_HOOKS: ResetHooks = {
  reached: () => Promise.resolve(),
};
