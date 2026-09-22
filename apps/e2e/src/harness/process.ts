import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "../config";

/**
 * 子行程與等待用的小工具(harness 專用)。
 *
 * 兩個跨平台的坑寫在這裡,呼叫端不必再各自處理:
 * - **Windows 上 `pnpm` 是 `.cmd`**,`spawn` 不帶 `shell` 找不到它;但絕對路徑(`node.exe`)
 *   反過來**不能**走 shell —— `C:\Program Files\...` 的空白會被 shell 切成兩段;
 * - **輸出一律進 log**:api 的啟用信連結只印在 stdout,測試要從檔案裡撈(ADR-0010 的記錄用 adapter)。
 */

const IS_WINDOWS = process.platform === "win32";

/** Windows 上只有「靠 PATH 找的指令」需要 shell;絕對路徑直接 spawn(路徑含空白時 shell 會拆壞)。 */
const needsShell = (command: string): boolean =>
  IS_WINDOWS && !path.isAbsolute(command);

export function log(message: string): void {
  process.stdout.write(`[e2e] ${message}\n`);
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  label: string;
}

/** 跑一個會結束的指令(build / migrate / seed),非 0 退出即拋錯。 */
export function run(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<void> {
  log(`${options.label}:${command} ${args.join(" ")}`);
  const child = spawn(command, [...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: needsShell(command),
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${options.label} 失敗(exit code ${String(code)})`));
    });
  });
}

export interface StartOptions extends RunOptions {
  /** 把 stdout / stderr 同時導進這個檔案(測試要從 api log 撈啟用信連結)。 */
  logFile?: string;
}

/** 起一個長駐的子行程(api);回傳的 handle 由 `stopProcess` 收掉。 */
export function start(
  command: string,
  args: readonly string[],
  options: StartOptions,
): ChildProcess {
  log(`${options.label}:${command} ${args.join(" ")}`);
  const child = spawn(command, [...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: needsShell(command),
  });

  if (options.logFile !== undefined) {
    const sink = createWriteStream(options.logFile, { flags: "w" });
    child.stdout.pipe(sink);
    child.stderr.pipe(sink);
  }
  return child;
}

/** 收掉長駐子行程;Windows 沒有信號,`kill()` 直接 TerminateProcess。 */
export async function stopProcess(child: ChildProcess | null): Promise<void> {
  if (child === null) {
    return;
  }
  if (child.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    child.once("exit", () => {
      resolve();
    });
    child.kill(IS_WINDOWS ? undefined : "SIGTERM");
    setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000).unref();
  });
}

export interface WaitOptions {
  label: string;
  timeoutMs?: number;
  intervalMs?: number;
}

/** 輪詢直到 `probe` 回 true;逾時即拋錯(錯誤訊息帶得出是哪一段沒起來)。 */
export async function waitUntil(
  probe: () => Promise<boolean>,
  options: WaitOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await probe()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `等待「${options.label}」逾時(${String(timeoutMs)}ms);細節看 apps/e2e/.tmp 底下的 log`,
  );
}
