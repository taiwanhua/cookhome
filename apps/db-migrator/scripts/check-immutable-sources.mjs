#!/usr/bin/env node
/**
 * 已發布的 migration 與種子快照不可改寫(`docs/plans/seed-migration.md`「唯一執行入口與歷史快照」):
 * 執行過的 migration 以檔名記在 changelog、不比對內容(`useFileHash: false`),快照以 revision 識別 ——
 * 改了內容,已經跑過的環境不會重跑,新環境卻拿到另一份,兩邊從此不一致。所以改動只能是**新增檔案**。
 *
 *   node apps/db-migrator/scripts/check-immutable-sources.mjs <base commit>
 *
 * 對照基線(`<base>...HEAD`,也就是這個分支相對於共同祖先的變更):下列路徑底下,基線已存在的檔案
 * 被修改、刪除或改名就失敗並列出。只用 Node 內建模組與 git,不需要 pnpm install。
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** 受保護的路徑(相對 repo 根):三個來源的 migration,與兩個來源的快照。 */
export const IMMUTABLE_PATHS = [
  "apps/db-migrator/migrations",
  "apps/db-migrator/seeds/base/revisions",
  "apps/db-migrator/seeds/project/revisions",
];

const STATUS_LABELS = { M: "修改", D: "刪除", T: "改變檔案類型" };

/**
 * `git diff --name-status --no-renames` 的輸出 → 違規清單。新增(A)以外的都是違規;
 * 改名在 `--no-renames` 下是「刪除舊檔 + 新增新檔」,舊檔的刪除會被列出來。
 */
export function immutableViolations(nameStatus) {
  return nameStatus
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status: status.charAt(0), file: rest.join("\t") };
    })
    .filter(({ status }) => status !== "A")
    .map(
      ({ status, file }) =>
        `${STATUS_LABELS[status] ?? `變更(${status})`}:${file}`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base) {
    process.stderr.write("用法:check-immutable-sources.mjs <base commit>\n");
    process.exitCode = 1;
  } else {
    const diff = execFileSync(
      "git",
      [
        "diff",
        "--name-status",
        "--no-renames",
        `${base}...HEAD`,
        "--",
        ...IMMUTABLE_PATHS,
      ],
      { encoding: "utf8" },
    );
    const violations = immutableViolations(diff);
    if (violations.length > 0) {
      process.stderr.write(
        `已發布的 migration / 種子快照不可改寫(只能新增檔案;要修正請寫新的 migration 或新的 revision):\n- ${violations.join("\n- ")}\n`,
      );
      process.exitCode = 1;
    } else {
      process.stdout.write("已發布的 migration 與種子快照未被改寫\n");
    }
  }
}
