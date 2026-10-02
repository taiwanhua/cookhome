/**
 * reset 指令測試的共用工具:以子行程跑指令(含會中斷的入口)、組人工確認字串、讀最終狀態。
 * 拋棄式 MongoDB 與資料庫讀取沿用 `update-harness.ts`。測試檔只寫行為。
 */
import path from "node:path";

import type { Document } from "mongodb";

import {
  type CommandResult,
  PACKAGE_ROOT,
  type RunningCommand,
  dumpDatabase,
  fixtureSourceRoot,
  startEntry,
} from "./update-harness";

export const RESET_ENTRY = path.join(PACKAGE_ROOT, "src", "reset", "run.ts");
/** 可以讓指定檢查點中斷的入口(見該檔)。 */
export const RESET_FAULT_ENTRY = path.join(
  PACKAGE_ROOT,
  "test",
  "support",
  "reset-fault-entry.ts",
);

export type ResetMode = "data" | "full";

/** 夾具 `test/fixtures/reset-managed/` 的兩個版本(見各自的 registry)。 */
export const MANAGED_V1 = `--source-root=${fixtureSourceRoot("reset-managed", "v1")}`;
export const MANAGED_V2 = `--source-root=${fixtureSourceRoot("reset-managed", "v2")}`;
export const RESET_MARKER = "20270101000000_data_reset-marker.js";

export function databaseNameOf(databaseUri: string): string {
  return decodeURIComponent(new URL(databaseUri).pathname.replace(/^\//, ""));
}

/** 操作者要輸入的完整確認字串:`reset:<environment>:<實際資料庫名>:<mode>`。 */
export function confirmationOf(
  environment: string,
  databaseUri: string,
  mode: string,
): string {
  return `reset:${environment}:${databaseNameOf(databaseUri)}:${mode}`;
}

export interface ResetOptions {
  mode: ResetMode;
  /** 預設 `dev`;給 null = 不帶 `--environment`。 */
  environment?: string | null;
  /** 預設是與目標完全相符的確認字串;給 null = 不帶 `--confirm`。 */
  confirm?: string | null;
  /** 其餘參數(`--source-root=`、`--registry=`)。 */
  args?: readonly string[];
  /** 預設 `RESET_ALLOW_ENV` 等於這次的環境。 */
  env?: Record<string, string | undefined>;
}

function resetArgs(databaseUri: string, options: ResetOptions): string[] {
  const environment =
    options.environment === undefined ? "dev" : options.environment;
  const confirm =
    options.confirm === undefined
      ? confirmationOf(environment ?? "dev", databaseUri, options.mode)
      : options.confirm;
  return [
    `--mode=${options.mode}`,
    ...(environment === null ? [] : [`--environment=${environment}`]),
    ...(confirm === null ? [] : [`--confirm=${confirm}`]),
    ...(options.args ?? []),
  ];
}

function resetEnv(options: ResetOptions): Record<string, string | undefined> {
  return {
    RESET_ALLOW_ENV: options.environment ?? "dev",
    ...options.env,
  };
}

/** 跑 reset 指令(等同 `pnpm --filter @repo/db-migrator reset …`)。 */
export function runReset(
  databaseUri: string,
  options: ResetOptions,
): Promise<CommandResult> {
  return startEntry(
    RESET_ENTRY,
    resetArgs(databaseUri, options),
    databaseUri,
    resetEnv(options),
  ).done;
}

/**
 * 跑 reset,並讓指定的檢查點中斷。`fault` 是 `reset:<檢查點>[@對象片段]`(reset 自己的檢查點)或
 * `update:<檢查點>[@對象片段]`(內部 update 的檢查點);`faultMode`:`throw` = 那一步丟錯、
 * `exit` = 直接結束程序(硬中止,鎖留著)、`wait:<檔案>` = 停在那一步直到檔案出現。
 */
export function startResetWithFault(
  databaseUri: string,
  options: ResetOptions,
  fault: string,
  faultMode = "throw",
): RunningCommand {
  return startEntry(
    RESET_FAULT_ENTRY,
    [fault, faultMode, ...resetArgs(databaseUri, options)],
    databaseUri,
    resetEnv(options),
  );
}

export function runResetWithFault(
  databaseUri: string,
  options: ResetOptions,
  fault: string,
  faultMode = "throw",
): Promise<CommandResult> {
  return startResetWithFault(databaseUri, options, fault, faultMode).done;
}

/** 整批鎖與執行紀錄所在的兩張表:被拒絕的 reset 可以在這裡留下紀錄,其餘一筆都不能動。 */
const BOOKKEEPING_COLLECTIONS = new Set(["changelog_lock", "seed_update_runs"]);

/**
 * 應用資料的全部內容(不含鎖與執行紀錄):前後完全相同 = 一筆都沒刪、沒改,也沒有多出或少掉 collection。
 */
export async function dumpApplicationData(
  databaseUri: string,
): Promise<Record<string, Document[]>> {
  const dump = await dumpDatabase(databaseUri);
  return Object.fromEntries(
    Object.entries(dump).filter(([name]) => !BOOKKEEPING_COLLECTIONS.has(name)),
  );
}
