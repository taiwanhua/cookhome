/**
 * seed 指令入口(`pnpm --filter @repo/db-migrator seed`,正本:ADR-0002)。
 *
 * update 的相容別名:與 `update`、`migrate` 走同一個入口,執行**完整更新**
 * (尚未成功的 migration → 目前的普通種子 → 目前有效的定義 → 核對),不留下可以繞過依賴的半套操作。
 * 輸出仍有每組種子的「新增 N / 更新 M / 認養 A / 未變 K」與 `seed 完成:…` 摘要;重跑第二次應為 0/0/0/K。
 *
 * 可選第一個參數為 registry 檔路徑(預設 seeds/registry.ts),供測試以夾具 registry 驗證同步行為。
 * 只同步普通種子、不經 migration 與鎖的低階函式是 `seed-runner.ts` 的 `runSeeds`(處理器與隔離測試用)。
 */
import { runUpdateEntry } from "../update/command";

await runUpdateEntry(process.argv.slice(2), { label: "seed" });
