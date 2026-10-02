/* eslint-disable sonarjs/no-os-command-from-path -- 測試在暫存目錄建 git repo:git 的安裝位置因機器而異,只能靠 PATH;不經 shell、參數由測試自己給;到期條件:無 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * `scripts/check-immutable-sources.mjs`(CI 用):已發布的 migration 與種子快照對照基線不可改寫。
 * 以暫存的 git repo 實跑:基線 commit 之後做各種變更,看腳本放行或擋下。
 */

const SCRIPT = path.resolve(
  __dirname,
  "..",
  "scripts",
  "check-immutable-sources.mjs",
);

const MIGRATION = "apps/db-migrator/migrations/20260101000000_data_first.js";
const BASE_MIGRATION =
  "apps/db-migrator/migrations/base/20260201000000_data_base.js";
const SNAPSHOT =
  "apps/db-migrator/seeds/project/revisions/order_form.r1.seed.ts";

function git(repository: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} 失敗:${result.stderr}`);
  }
  return result.stdout.trim();
}

function write(repository: string, file: string, content: string): void {
  const target = path.join(repository, ...file.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/** 一個有基線 commit 的暫存 repo;回傳 repo 路徑與基線的 commit。 */
function repositoryWithBaseline(): { repository: string; base: string } {
  const repository = mkdtempSync(path.join(os.tmpdir(), "immutable-sources-"));
  git(repository, "init", "--quiet");
  git(repository, "config", "user.email", "test@example.com");
  git(repository, "config", "user.name", "test");
  git(repository, "config", "core.autocrlf", "false");
  write(repository, MIGRATION, "export const up = async () => {};\n");
  write(repository, BASE_MIGRATION, "export const up = async () => {};\n");
  write(repository, SNAPSHOT, "export const seed = { revision: 'r1' };\n");
  write(repository, "apps/db-migrator/seeds/project/registry.ts", "// v1\n");
  git(repository, "add", ".");
  git(repository, "commit", "--quiet", "-m", "baseline");
  return { repository, base: git(repository, "rev-parse", "HEAD") };
}

function check(repository: string, base: string) {
  git(repository, "add", "--all");
  git(repository, "commit", "--quiet", "--allow-empty", "-m", "change");
  return spawnSync(process.execPath, [SCRIPT, base], {
    cwd: repository,
    encoding: "utf8",
  });
}

describe("已發布的 migration 與種子快照不可改寫(對照基線)", () => {
  it("只新增 migration / 快照、或改不受保護的檔(registry):通過", () => {
    const { repository, base } = repositoryWithBaseline();
    write(
      repository,
      "apps/db-migrator/migrations/project/20260301000000_data_new.js",
      "export const up = async () => {};\n",
    );
    write(
      repository,
      "apps/db-migrator/seeds/project/revisions/order_form.r2.seed.ts",
      "export const seed = { revision: 'r2' };\n",
    );
    write(repository, "apps/db-migrator/seeds/project/registry.ts", "// v2\n");

    const result = check(repository, base);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 60_000);

  it("修改既有的 migration 或快照:失敗並指出是哪一個檔", () => {
    const { repository, base } = repositoryWithBaseline();
    write(
      repository,
      MIGRATION,
      "export const up = async () => { /* 改 */ };\n",
    );
    write(
      repository,
      SNAPSHOT,
      "export const seed = { revision: 'r1', x: 1 };\n",
    );

    const result = check(repository, base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`修改:${MIGRATION}`);
    expect(result.stderr).toContain(`修改:${SNAPSHOT}`);
  }, 60_000);

  it("刪除、改名或搬到另一個來源:失敗(舊路徑被列為刪除)", () => {
    const { repository, base } = repositoryWithBaseline();
    rmSync(path.join(repository, ...MIGRATION.split("/")));
    const moved =
      "apps/db-migrator/migrations/project/20260201000000_data_base.js";
    mkdirSync(path.dirname(path.join(repository, ...moved.split("/"))), {
      recursive: true,
    });
    renameSync(
      path.join(repository, ...BASE_MIGRATION.split("/")),
      path.join(repository, ...moved.split("/")),
    );

    const result = check(repository, base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`刪除:${MIGRATION}`);
    expect(result.stderr).toContain(`刪除:${BASE_MIGRATION}`);
    expect(result.stderr).not.toContain(moved);
  }, 60_000);

  it("沒給基線:失敗並印用法(不會靜默放行)", () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("用法");
  });
});
