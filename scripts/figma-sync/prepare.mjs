#!/usr/bin/env node
/**
 * figma-sync CLI(品牌生成、盤點與補套)。固定六命令,設定與 artifact 相對於目前工作目錄(repo 根):
 *
 *   node scripts/figma-sync/prepare.mjs scan --kind <base-library|brand-library|consumer> --file-key <key> --roots <IDs逗號分隔> --run-id <id>
 *   node scripts/figma-sync/prepare.mjs review --base <inventory.json> --brand <inventory.json> --selections-json <JSON陣列> --review-evidence-url <URL> [--consumer <inventory.json> --resolutions-json <JSON陣列>]
 *   node scripts/figma-sync/prepare.mjs plan --base <inventory.json> --brand <inventory.json> --consumer <inventory.json> --identity-review <identity-review.json> --verification-target <brand-bindings|library-upgrade> [--publication-evidence-json <JSON物件> --acceptance-evidence-json <JSON物件>] [--resume <plan.json>]
 *   node scripts/figma-sync/prepare.mjs plan-brand --brand <inventory.json> [--resume <plan.json>]
 *   node scripts/figma-sync/prepare.mjs apply --plan <plan.json>
 *   node scripts/figma-sync/prepare.mjs record --request <request.json> --result <runtime-result.json>
 *
 * 協定:成功時 stdout 只有一行 `{runId,status,artifacts,counts}`、stderr 無輸出、退出碼 0;
 * 失敗時 stdout 無輸出、stderr 一行、退出碼 1。blocked 的 plan 是有效分析輸出(退出碼 0),但不能 apply。
 * 本程式不讀 token、不呼叫 Figma;scan / apply 生成的 JS 交由現有 Figma 工具執行,回傳的 JSON 值再交給 record。
 * 操作正本:docs/agents/toolbox.md「Figma 品牌同步」;協定欄位見 core-contract-schema.mjs。
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { singleLine } from "../project-settings/single-line.mjs";
import { parseArguments } from "./prepare-arguments.mjs";
import { createProjectContext, runCommand } from "./prepare-commands.mjs";

export {
  buildExecutionSource,
  buildFigmaToolArguments,
} from "./execution-source.mjs";

/** import-safe 的入口:回傳退出碼,不直接呼叫 process.exit。 */
export function main(argv, io) {
  try {
    const command = parseArguments(argv);
    const context = createProjectContext({
      rootDir: io.cwd,
      now: io.now,
    });
    runCommand(command, context, io);
    return 0;
  } catch (error) {
    // 未預期的錯誤不印原訊息:它可能帶輸入原值或檔案內容
    const known = error instanceof Error && error.name === "FigmaSyncError";
    const message = known ? error.message : "未預期的錯誤";
    io.stderr.write(`figma-sync: ${singleLine(message)}\n`);
    return 1;
  }
}

function isDirectEntry() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isDirectEntry()) {
  process.exitCode = main(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
  });
}
