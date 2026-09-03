#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook:AI 每次 Edit/Write 完 ts/tsx 檔案後,
 * 自動對該檔跑 ESLint、對該檔所屬套件跑 typecheck。
 * 失敗時以 exit code 2 把錯誤回饋給 AI 當場修正 — 三層約束第一層的閉環。
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let filePath = "";
try {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  filePath = input.tool_input?.file_path ?? input.tool_response?.filePath ?? "";
} catch {
  process.exit(0);
}

// 只檢查 ts/tsx;產物與外部程式碼跳過
if (!/\.(ts|tsx)$/.test(filePath)) process.exit(0);
const normalized = filePath.replaceAll("\\", "/");
if (
  normalized.includes("/node_modules/") ||
  normalized.includes("/generated/") ||
  normalized.includes("/dist/") ||
  normalized.includes("/.next/")
) {
  process.exit(0);
}

// 往上找檔案所屬的 workspace 套件
const repoRoot = process.cwd();
let pkgDir = path.dirname(path.resolve(filePath));
while (pkgDir !== repoRoot && !existsSync(path.join(pkgDir, "package.json"))) {
  const parent = path.dirname(pkgDir);
  if (parent === pkgDir) process.exit(0); // 走出檔案系統頂端,跳過
  pkgDir = parent;
}
if (pkgDir === repoRoot) process.exit(0); // root 層檔案沒有 lint 設定,跳過

const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));

const run = (command, cwd) => {
  try {
    execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    return null;
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    return `${stdout}\n${stderr}`.trim();
  }
};

// 1) 對該檔跑 ESLint(與 CI 同一套規則)
if (pkg.scripts?.lint) {
  const lintError = run(`pnpm exec eslint --max-warnings 0 "${filePath}"`, pkgDir);
  if (lintError !== null) {
    console.error(`[hook] ESLint 未通過:${filePath}\n${lintError}`);
    process.exit(2);
  }
}

// 2) 對該套件跑 typecheck(型別錯誤會跨檔案;turbo 快取讓沒改的依賴不重跑)
if (pkg.scripts?.["check-types"] && pkg.name) {
  const typeError = run(
    `pnpm exec turbo run check-types --filter=${pkg.name} --output-logs=errors-only`,
    repoRoot,
  );
  if (typeError !== null) {
    console.error(`[hook] 型別檢查未通過(${pkg.name})\n${typeError}`);
    process.exit(2);
  }
}

process.exit(0);
