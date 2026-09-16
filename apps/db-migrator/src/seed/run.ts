/**
 * seed 指令入口(`pnpm --filter db-migrator seed`,正本:ADR-0002)。
 *
 * 以 tsx 直跑:讀 MONGODB_URI,依 registry 把種子冪等同步到該資料庫,
 * 最後輸出摘要「新增 N / 更新 M / 未變 K」;重跑第二次應為 0/0/K。
 *
 * 可選第一個參數為 registry 檔路徑(預設 seeds/registry.ts),供測試以夾具 registry 驗證同步行為。
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { MongoClient } from "mongodb";

import type { SeedRegistry } from "./seed-declaration";
import { formatCounts, runSeeds, sumCounts } from "./seed-runner";

const DEFAULT_REGISTRY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "seeds",
  "registry.ts",
);

// 指令介面本身就是 stdout/stderr,不經 @repo/logger(那是應用程式的 log 通道)
const print = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `缺少 ${name} 環境變數(需含資料庫名稱,例:mongodb://127.0.0.1:27017/cookhome)`,
    );
  }
  return value;
}

async function loadRegistry(registryPath: string): Promise<SeedRegistry> {
  const loaded = (await import(pathToFileURL(registryPath).href)) as {
    seedRegistry?: unknown;
  };
  if (!Array.isArray(loaded.seedRegistry)) {
    throw new TypeError(
      `registry 檔須具名匯出 seedRegistry 陣列:${registryPath}`,
    );
  }
  return loaded.seedRegistry as SeedRegistry;
}

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
