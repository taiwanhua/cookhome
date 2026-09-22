/**
 * reset 指令入口(正本:ADR-0002「還原(reset)」;用法見 docs/deployment.md)。
 *
 * ```
 * pnpm --filter @repo/db-migrator reset --mode=<full|data> --confirm=<資料庫名>
 * ```
 *
 * - `full`:`dropDatabase` → `migrate` → `seed`(全新安裝;初始 seed 值欄位也回到宣告值)
 * - `data`:只刪人建的資料(判準見 `reset-plan.ts`)→ `seed` 補回宣告的內容
 *
 * 連線與 registry 載入沿用 seed 的那一套(`src/cli.ts`);三道安全閥見 `reset-safety.ts`,
 * 不過即 exit 1 並印原因,**production 永遠拒絕**。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { MongoClient } from "mongodb";

import {
  DEFAULT_REGISTRY_PATH,
  PACKAGE_ROOT,
  loadRegistry,
  print,
  requireEnv,
} from "../cli";
import { readRootAdminInput } from "../seed/root-admin";
import { formatCounts, runSeeds, sumCounts } from "../seed/seed-runner";
import { resetData } from "./reset-runner";
import {
  RESET_ALLOW_ENV_NAME,
  findSafetyViolation,
  parseDatabaseName,
} from "./reset-safety";

const MIGRATE_MONGO_BIN = path.join(
  PACKAGE_ROOT,
  "node_modules",
  "migrate-mongo",
  "bin",
  "migrate-mongo.js",
);

const MODES = ["full", "data"] as const;
type ResetMode = (typeof MODES)[number];

interface ResetArgs {
  mode: ResetMode;
  confirm: string | undefined;
}

function isMode(value: string): value is ResetMode {
  return (MODES as readonly string[]).includes(value);
}

function parseArgs(argv: string[]): ResetArgs {
  let mode: ResetMode | undefined;
  let confirm: string | undefined;
  for (const argument of argv) {
    const [flag, ...rest] = argument.split("=");
    const value = rest.join("=");
    if (flag === "--mode" && isMode(value)) {
      mode = value;
    } else if (flag === "--confirm") {
      confirm = value;
    } else {
      throw new Error(
        `無法辨識的參數 ${argument}(用法:reset --mode=<${MODES.join("|")}> --confirm=<資料庫名>)`,
      );
    }
  }
  if (!mode) {
    throw new Error(`--mode 必須是 ${MODES.join(" 或 ")}`);
  }
  return { mode, confirm };
}

/** `full` 的第二步:以子行程跑 migrate-mongo(等同 `pnpm --filter @repo/db-migrator migrate`)。 */
function runMigrations(): void {
  const result = spawnSync(process.execPath, [MIGRATE_MONGO_BIN, "up"], {
    cwd: PACKAGE_ROOT,
    env: process.env,
    encoding: "utf8",
  });
  process.stdout.write(result.stdout);
  if (result.status !== 0) {
    throw new Error(
      `migrate 失敗(exit ${String(result.status)}):${result.stderr}`,
    );
  }
}

async function main(): Promise<void> {
  const { mode, confirm } = parseArgs(process.argv.slice(2));
  const uri = requireEnv("MONGODB_URI");
  const databaseName = parseDatabaseName(uri);

  const violation = findSafetyViolation({
    databaseName,
    confirm,
    allowEnv: process.env[RESET_ALLOW_ENV_NAME],
  });
  if (violation !== null) {
    throw new Error(violation);
  }

  // 兩個模式最後都要跑 seed,`data` 還要靠 account 認出「不刪的那個人」——
  // 先把 ROOT_ADMIN_* 檢查掉,不要刪完才發現缺變數
  const { account } = readRootAdminInput(process.env);
  const registry = await loadRegistry(DEFAULT_REGISTRY_PATH);

  const client = await MongoClient.connect(uri);
  try {
    const database = client.db();
    if (mode === "full") {
      await database.dropDatabase();
      print(`dropDatabase:${databaseName} 已清空`);
      runMigrations();
    } else {
      for (const { collection, deleted } of await resetData(
        database,
        registry,
        account,
      )) {
        print(`${collection}:刪除 ${String(deleted)} 筆`);
      }
    }

    const results = await runSeeds(database, registry, { env: process.env });
    for (const { label, counts } of results) {
      print(`${label}:${formatCounts(counts)}`);
    }
    print(`reset(${mode})完成:${formatCounts(sumCounts(results))}`);
  } finally {
    await client.close();
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`reset 失敗:${message}\n`);
  process.exitCode = 1;
}
