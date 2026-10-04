/**
 * figma-sync 六命令的分派:既有品牌 / 專案來源讀取與 artifact 生命週期由下列三個檔案分擔。
 * - prepare-commands-context.mjs:來源身分、品牌投影與 run 目錄
 * - prepare-commands-planning.mjs:scan / review / plan / plan-brand / apply
 * - prepare-commands-record.mjs:record(原協定或傳輸 envelope)
 */
import path from "node:path";

import { apply, plan, review, scan } from "./prepare-commands-planning.mjs";
import { record } from "./prepare-commands-record.mjs";

export { createProjectContext } from "./prepare-commands-context.mjs";

const COMMANDS = {
  scan,
  review,
  plan: (options, context) => plan(options, context, "consumer"),
  "plan-brand": (options, context) => plan(options, context, "brand-library"),
  apply,
  record,
};

/** 執行一個已解析的命令;成功時 stdout 一行 `{runId,status,artifacts,counts}`。 */
export function runCommand(command, context, io) {
  const summary = COMMANDS[command.command](command.options, context);
  const relative = (target) =>
    path.relative(context.rootDir, target).split(path.sep).join("/");
  const artifacts = summary.artifacts.map((artifact) => ({
    kind: artifact.kind,
    path: relative(artifact.path),
    digest: artifact.digest,
  }));
  const line = Object.assign({}, summary, { artifacts });
  io.stdout.write(`${JSON.stringify(line)}\n`);
  return line;
}
