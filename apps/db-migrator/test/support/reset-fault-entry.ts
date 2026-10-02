/* eslint-disable unicorn/no-process-exit -- 模擬程序被硬中止:直接結束、不跑任何 finally,鎖與執行紀錄停在當下;到期條件:無 */
/**
 * 測試專用的 reset 入口:與 `src/reset/run.ts` 走同一個指令,只多接上會中斷的檢查點
 * (正式入口的檢查點只是放行)。前兩個參數是:
 *
 * 1. 要中斷的檢查點:`reset:<檢查點>[@對象片段]`(reset 自己的,對象是 collection 名)或
 *    `update:<檢查點>[@對象片段]`(內部 update 的,對象是 migration 檔名或定義 id);
 *    或 `cli:<路徑>`:不中斷任何檢查點,只把 api 的受管定義 CLI 換成指定路徑(不存在的路徑 = 沒有建置)
 * 2. 中斷方式:`throw`(那一步丟錯)、`exit`(直接結束程序,模擬硬中止)、
 *    `wait:<檔案路徑>`(停在那一步直到檔案出現,讓測試在這段期間觀察或執行別的程序)
 *
 * 其餘參數原樣交給 reset 指令。
 */
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { runResetEntry } from "../../src/reset/command";

/** 硬中止的結束碼(測試用它確認程序是在檢查點結束的)。 */
const HARD_ABORT_EXIT_CODE = 86;
const WAIT_PREFIX = "wait:";
const POLL_MS = 50;

const [fault = "", mode = "throw", ...resetArgs] = process.argv.slice(2);
const [scope, target = ""] = fault.split(/:(.*)/s);
const [checkpoint, subjectPart] = target.split("@");

async function interrupt(
  reached: string,
  subject: string | null,
): Promise<void> {
  if (
    reached !== checkpoint ||
    (subjectPart !== undefined && subject?.includes(subjectPart) !== true)
  ) {
    return;
  }
  if (mode === "exit") {
    process.exit(HARD_ABORT_EXIT_CODE);
  }
  if (mode.startsWith(WAIT_PREFIX)) {
    const file = mode.slice(WAIT_PREFIX.length);
    while (!existsSync(file)) {
      await delay(POLL_MS);
    }
    return;
  }
  throw new Error(`模擬中斷:${reached} ${subject ?? ""}`.trimEnd());
}

const pass = (): Promise<void> => Promise.resolve();

await runResetEntry(resetArgs, {
  hooks: { reached: scope === "reset" ? interrupt : pass },
  updateHooks: { reached: scope === "update" ? interrupt : pass },
  ...(scope === "cli" ? { definitionCliPath: target } : {}),
});
