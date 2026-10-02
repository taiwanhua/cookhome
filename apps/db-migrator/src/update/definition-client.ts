/**
 * 以子程序呼叫 api 的受管定義 CLI(`docs/plans/seed-migration.md`「發布、身分與衝突」)。
 *
 * 發布、安裝紀錄、採納與漂移保護都在 api 那一端;這裡只負責傳輸:`process.execPath` +
 * 同一個 checkout 建置出的固定路徑、不經 shell,stdin 一份請求、stdout 一份結果,
 * 結果交給 `definition-result.ts` 逐筆對回請求。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  DEFINITION_SEED_PROTOCOL_VERSION,
  type DefinitionSeedItemResult,
  type DefinitionSeedOperation,
  type DefinitionSeedRequest,
  type DefinitionSeedSet,
} from "@repo/domain/seed";

import { PACKAGE_ROOT } from "../cli";
import {
  type DefinitionCliOutput,
  DefinitionSeedCliError,
  type InstalledDefinitionResult,
  diagnosticOf,
  matchDefinitionSeedResult,
} from "./definition-result";
import type { SeedLockHandle } from "./lock";

/** api 建置後的 CLI(固定路徑,不接受外部指定)。 */
export const DEFINITION_CLI_PATH = path.resolve(
  PACKAGE_ROOT,
  "..",
  "api",
  "dist",
  "seed",
  "run.js",
);

/** 起子程序、送出 stdin、等它**退出**才回來(鎖要等子程序退出才能釋放)。 */
export function spawnDefinitionCli(
  cliPath: string,
  input: string,
  env: NodeJS.ProcessEnv,
): Promise<DefinitionCliOutput> {
  return new Promise<DefinitionCliOutput>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath], {
      cwd: path.dirname(cliPath),
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(
        new DefinitionSeedCliError(
          `無法啟動受管定義 CLI(${cliPath}):${error.message}`,
        ),
      );
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
    // 子程序提早結束時寫入會收到 EPIPE;結果由 close 事件判定,不讓它變成未處理的錯誤
    child.stdin.on("error", () => {
      /* 見上 */
    });
    child.stdin.end(input);
  });
}

export interface DefinitionSeedClient {
  /** 安裝或續跑;回來的每一筆都已安裝。 */
  apply(
    seeds: readonly DefinitionSeedSet[],
  ): Promise<InstalledDefinitionResult[]>;
  /** 只核對既有映射與凍結內容,不寫入。 */
  inspect(
    seeds: readonly DefinitionSeedSet[],
  ): Promise<DefinitionSeedItemResult[]>;
}

/** 啟動前確認 CLI 已建置;沒有就指出怎麼建(同一個 checkout 的產物,不用雲端上的舊版本)。 */
export function assertDefinitionCliBuilt(cliPath = DEFINITION_CLI_PATH): void {
  if (!existsSync(cliPath)) {
    throw new DefinitionSeedCliError(
      `找不到受管定義 CLI(${cliPath}):請先在同一個 checkout 建置 api(pnpm --filter "@repo/api..." run build)`,
    );
  }
}

/**
 * 確認 CLI 啟動得起來:送一份刻意不合協定的請求,它應在連資料庫之前就回 `PROTOCOL_ERROR`。
 * 不需要資料庫,也不會寫入任何東西。
 */
export async function probeDefinitionCli(
  env: NodeJS.ProcessEnv,
  cliPath = DEFINITION_CLI_PATH,
): Promise<void> {
  assertDefinitionCliBuilt(cliPath);
  const output = await spawnDefinitionCli(cliPath, "{}", env);
  let code: unknown;
  try {
    const parsed = JSON.parse(output.stdout) as {
      errors?: { code?: unknown }[];
    };
    code = parsed.errors?.[0]?.code;
  } catch {
    code = undefined;
  }
  if (code !== "PROTOCOL_ERROR") {
    throw new DefinitionSeedCliError(
      `受管定義 CLI 無法啟動(exit ${String(output.status)})${diagnosticOf(output)}`,
    );
  }
}

/** 正式的子程序呼叫端:請求帶上最外層命令的鎖 owner;`cliPath` 只有測試會換成假的子程序。 */
export function createDefinitionSeedClient(options: {
  lock: SeedLockHandle;
  env: NodeJS.ProcessEnv;
  cliPath?: string;
}): DefinitionSeedClient {
  const { lock, env, cliPath = DEFINITION_CLI_PATH } = options;
  const execute = async (
    operation: DefinitionSeedOperation,
    seeds: readonly DefinitionSeedSet[],
  ): Promise<DefinitionSeedItemResult[]> => {
    if (seeds.length === 0) {
      return [];
    }
    assertDefinitionCliBuilt(cliPath);
    const request: DefinitionSeedRequest = {
      protocolVersion: DEFINITION_SEED_PROTOCOL_VERSION,
      runId: lock.runId,
      lockOwner: lock.owner,
      releaseCommit: lock.releaseCommit,
      operation,
      seeds: [...seeds],
    };
    const output = await spawnDefinitionCli(
      cliPath,
      JSON.stringify(request),
      env,
    );
    return matchDefinitionSeedResult(request, output);
  };
  return {
    apply: async (seeds) =>
      (await execute("apply", seeds)) as InstalledDefinitionResult[],
    inspect: (seeds) => execute("inspect", seeds),
  };
}
