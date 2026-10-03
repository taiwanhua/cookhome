import { spawn } from "node:child_process";
import path from "node:path";

import type { Connection } from "mongoose";

import {
  BASE_ONLY_REGISTRY,
  ROOT_ADMIN,
} from "../../auth/test-support/auth-app";

/**
 * 以子行程跑 db-migrator 的 reset 指令(不 import —— STRUCT-01 禁 app 互 import),對這個測試自己的拋棄式資料庫:
 * 給要驗「api 真的寫出這個狀態之後,reset 拒絕 / 放行」的測試用。回結果不丟錯。
 * registry 與種測試資料庫的是同一份(空專案來源的夾具,沒有登記任何定義)。
 */

const DB_MIGRATOR_ROOT = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "db-migrator",
);
const TSX_CLI = path.join(
  DB_MIGRATOR_ROOT,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const RESET_ENTRY = path.join(DB_MIGRATOR_ROOT, "src", "reset", "run.ts");

/** 測試一律以 dev 環境的確認執行(資料庫是拋棄式的)。 */
const ENVIRONMENT = "dev";

export interface ResetResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** 整批鎖與執行紀錄:被拒絕的 reset 可以在這裡留下紀錄,其餘一筆都不能動。 */
const BOOKKEEPING_COLLECTIONS = new Set(["changelog_lock", "seed_update_runs"]);

/** 應用資料的全部內容:前後完全相同 = reset 一筆都沒刪、沒改。 */
export async function dumpApplicationData(
  connection: Connection,
): Promise<Record<string, unknown[]>> {
  const database = connection.db;
  if (!database) {
    throw new Error("測試連線尚未就緒");
  }
  const collections = await database
    .listCollections({}, { nameOnly: true })
    .toArray();
  const names = collections
    .map(({ name }) => name)
    .filter((name) => !BOOKKEEPING_COLLECTIONS.has(name))
    .toSorted((left, right) => left.localeCompare(right, "zh-Hant"));
  const dump: Record<string, unknown[]> = {};
  for (const name of names) {
    dump[name] = await database
      .collection(name)
      .find()
      .sort({ _id: 1 })
      .toArray();
  }
  return dump;
}

/** 跑 `reset --mode=data`。 */
export function runDataReset(databaseUri: string): Promise<ResetResult> {
  return runReset(databaseUri, "data");
}

/** 跑 `reset --mode=full`(清除全部 collection 後以正式的 migration 與夾具 registry 重建)。 */
export function runFullReset(databaseUri: string): Promise<ResetResult> {
  return runReset(databaseUri, "full");
}

/**
 * 跑 reset 指令(完整的人工確認由這裡依資料庫名組好)。非同步 spawn:本機的 mongodb-memory-server
 * 是測試行程的子程序,測試行程的事件迴圈被擋住時沒人讀它的輸出。
 */
function runReset(
  databaseUri: string,
  mode: "data" | "full",
): Promise<ResetResult> {
  const databaseName = decodeURIComponent(
    new URL(databaseUri).pathname.replace(/^\//, ""),
  );
  const child = spawn(
    process.execPath,
    [
      TSX_CLI,
      RESET_ENTRY,
      `--mode=${mode}`,
      `--environment=${ENVIRONMENT}`,
      `--confirm=reset:${ENVIRONMENT}:${databaseName}:${mode}`,
      BASE_ONLY_REGISTRY,
    ],
    {
      cwd: DB_MIGRATOR_ROOT,
      env: {
        ...process.env,
        MONGODB_URI: databaseUri,
        ROOT_ADMIN_ACCOUNT: ROOT_ADMIN.account,
        ROOT_ADMIN_EMAIL: ROOT_ADMIN.email,
        ROOT_ADMIN_PASSWORD: ROOT_ADMIN.password,
        RESET_ALLOW_ENV: ENVIRONMENT,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  return new Promise<ResetResult>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}
