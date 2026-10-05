#!/usr/bin/env node
/**
 * 發布前環境與累積資料差異(唯讀):
 *
 *   node scripts/project-settings/preflight.mjs --environment <dev|staging|production> --target <full-sha>
 *
 * 在 target 的乾淨 checkout 執行;報告 JSON 寫 stdout。格式與協定見 preflight-report.mjs。
 */
import { runExternalCommand } from "./preflight-external.mjs";
import { runPreflight } from "./preflight-report.mjs";

const result = await runPreflight(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  runExternal: runExternalCommand,
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
