/**
 * seed 指令入口(`pnpm --filter db-migrator seed`,正本:ADR-0002)。
 *
 * 以 tsx 直跑:讀 MONGODB_URI,依 registry 把種子冪等同步到該資料庫,
 * 最後輸出摘要「新增 N / 更新 M / 未變 K」;重跑第二次應為 0/0/K。
 *
 * 可選第一個參數為 registry 檔路徑(預設 seeds/registry.ts),供測試以夾具 registry 驗證同步行為。
 * 連線、輸出與 registry 載入的共用部分見 `src/cli.ts`(reset 指令也用同一套)。
 */
import path from "node:path";

import { MongoClient } from "mongodb";

import { DEFAULT_REGISTRY_PATH, loadRegistry, print, requireEnv } from "../cli";
import { formatCounts, runSeeds, sumCounts } from "./seed-runner";

async function main(): Promise<void> {
  const uri = requireEnv("MONGODB_URI");
  const registryPath = path.resolve(process.argv[2] ?? DEFAULT_REGISTRY_PATH);
  const registry = await loadRegistry(registryPath);

  const client = await MongoClient.connect(uri);
  try {
    const results = await runSeeds(client.db(), registry, {
      env: process.env,
    });
    for (const { label, counts } of results) {
      print(`${label}:${formatCounts(counts)}`);
    }
    print(`seed 完成:${formatCounts(sumCounts(results))}`);
  } finally {
    await client.close();
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`seed 失敗:${message}\n`);
  process.exitCode = 1;
}
