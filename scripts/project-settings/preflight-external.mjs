/**
 * preflight 的外部系統邊界:兩個邏輯命令,一律解析成「固定執行檔 + 參數陣列」,不經 shell、不拼字串。
 *
 *   gcloud   非 Windows 直接執行 PATH 上的 gcloud。Windows 的 gcloud 是 .cmd / .ps1 launcher,
 *            改以系統 PowerShell(%SystemRoot% 下的固定路徑)`-NoProfile -NonInteractive -File <launcher> …args` 執行;
 *            launcher 取自 PATH 上的 gcloud.ps1,且同一份 SDK 須有 lib/gcloud.py。不改 ExecutionPolicy。
 *   migrator 同一 checkout 的既有 migrator status:`node <apps/db-migrator 解析到的 tsx CLI> src/update/run.ts
 *            --alias=migrate:status --status --json`,工作目錄 apps/db-migrator(與 package script 相同)。
 *            不經 pnpm:避免 Windows 的 shim,也避免 pnpm 在 stdout 混入 script banner。
 *
 * 啟動不了(找不到 launcher / 依賴、spawn 失敗)回 `isLaunchFailure: true`,與查詢本身失敗分開;
 * 呼叫端不轉印 stdout / stderr 原文。Secret 只經 `env` 傳給子行程。
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const MIGRATOR_ARGS = ["--status", "--json"];

const envValue = (env, name) => {
  const key = Object.keys(env).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : env[key];
};

function findOnPath(name, { env, exists, pathApi }) {
  for (const dir of (envValue(env, "PATH") ?? "").split(pathApi.delimiter)) {
    if (dir === "" || !pathApi.isAbsolute(dir)) continue;
    const candidate = pathApi.join(dir, name);
    if (exists(candidate)) return candidate;
  }
  return null;
}

function planGcloud(args, host) {
  if (host.platform !== "win32") return { file: "gcloud", args };
  const pathApi = path.win32;
  const launcher = findOnPath("gcloud.ps1", { ...host, pathApi });
  if (launcher === null) return null;
  const sdkEntry = pathApi.join(
    pathApi.dirname(launcher),
    "..",
    "lib",
    "gcloud.py",
  );
  if (!host.exists(sdkEntry)) return null;
  const systemRoot = envValue(host.env, "SystemRoot");
  if (!systemRoot || !pathApi.isAbsolute(systemRoot)) return null;
  const powershell = pathApi.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  if (!host.exists(powershell)) return null;
  return {
    file: powershell,
    args: ["-NoProfile", "-NonInteractive", "-File", launcher, ...args],
  };
}

function planMigrator(args, { root, resolveModule, execPath }) {
  if (
    args.length !== MIGRATOR_ARGS.length ||
    args.some((arg, index) => arg !== MIGRATOR_ARGS[index])
  ) {
    return null;
  }
  const packageDir = path.join(root, "apps", "db-migrator");
  let cli;
  try {
    cli = resolveModule(path.join(packageDir, "package.json"), "tsx/cli");
  } catch {
    return null;
  }
  return {
    file: execPath,
    args: [cli, "src/update/run.ts", "--alias=migrate:status", ...args],
    cwd: packageDir,
  };
}

/**
 * 邏輯命令 → `{ file, args, cwd? }`;無法安全啟動時回 null。`host` 注入平台、PATH 與檔案查詢,方便測試。
 */
export function planExternal(command, args, host) {
  if (command === "gcloud") return planGcloud(args, host);
  if (command === "migrator") return planMigrator(args, host);
  return null;
}

const resolveFromPackage = (packageJson, specifier) =>
  createRequire(packageJson).resolve(specifier);

export function runExternalCommand(command, args, { cwd, env } = {}) {
  const plan = planExternal(command, args, {
    platform: process.platform,
    env: process.env,
    exists: existsSync,
    root: cwd ?? process.cwd(),
    resolveModule: resolveFromPackage,
    execPath: process.execPath,
  });
  const launchFailure = {
    status: null,
    stdout: "",
    stderr: "",
    isLaunchFailure: true,
  };
  if (plan === null) return launchFailure;
  const result = spawnSync(plan.file, plan.args, {
    cwd: plan.cwd ?? cwd,
    env: env ?? process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) return launchFailure;
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    isLaunchFailure: false,
  };
}
