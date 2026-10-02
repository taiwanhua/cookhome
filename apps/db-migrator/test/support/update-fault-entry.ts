/* eslint-disable unicorn/no-process-exit -- 模擬程序被硬中止:直接結束、不跑任何 finally,鎖與 journal 停在當下;到期條件:無 */
/**
 * 測試專用的 update 入口:與 `src/update/run.ts` 走同一個指令,只多接上會中斷的檢查點
 * (正式入口的檢查點只是放行)。前兩個參數是:
 *
 * 1. 要中斷的檢查點:`<檢查點>` 或 `<檢查點>@<對象的片段>`(對象是 migration 檔名或定義 id)
 * 2. 中斷方式:`throw`(那一步丟錯)、`exit`(直接結束程序,模擬硬中止)、
 *    `wait:<檔案路徑>`(停在那一步直到檔案出現,讓另一個程序在這段期間嘗試執行)
 *
 * 其餘參數原樣交給 update 指令。
 */
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { runUpdateEntry } from "../../src/update/command";
import type { UpdateHooks } from "../../src/update/update-hooks";

/** 硬中止的結束碼(測試用它確認程序是在檢查點結束的)。 */
const HARD_ABORT_EXIT_CODE = 86;
const WAIT_PREFIX = "wait:";
const POLL_MS = 50;

const [fault = "", mode = "throw", ...updateArgs] = process.argv.slice(2);
const [checkpoint, subjectPart] = fault.split("@");

const hooks: UpdateHooks = {
  reached: async (reached, subject) => {
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
  },
};

await runUpdateEntry(updateArgs, { label: "update", hooks });
