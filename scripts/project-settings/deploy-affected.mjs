#!/usr/bin/env node
/**
 * 部署設定不屬於任何 workspace package,`turbo ls --affected` 看不到;deploy.yml 用本檔補上這一段判斷:
 *
 *   git diff --name-only <base>...HEAD | node scripts/project-settings/deploy-affected.mjs <package 名>
 *
 * stdout 只印 `true`(該 app 必須重新部署)或 `false`(交給 turbo 的依賴圖判斷)。
 * deploy.yml 把 `false` 以外的任何結果(含本程式失敗、沒有輸出)都當成要重建。
 *
 * `@repo/db-migrator` 的 `true` 代表「要對資料庫跑 update」:它沒有 image,但種子、快照與 migration
 * 就是要交付的設定,只改這些(api image 不變)也必須執行。這一條不靠 turbo:設定來源有變就明確回 `true`。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 專案設定與讀取腳本:決定 api 的部署目標,也決定烘進 admin 的 API 端點 → 兩個 app 都保守重建。 */
const PROJECT_SETTINGS = /^(deploy\/project\/|scripts\/project-settings\/)/;
/** runtime env 檔與 deploy.yml 本身:只有 api 吃(admin 的設定烘在 image)。 */
const API_ONLY = /^(deploy\/env\/|\.github\/workflows\/deploy\.yml$)/;

/** db-migrator 的任何檔案:種子(底座 / 專案 / 快照)、migration 與執行器本身。 */
const UPDATE_SOURCES = /^apps\/db-migrator\//;

const RULES = {
  "@repo/api": [PROJECT_SETTINGS, API_ONLY],
  "@repo/admin": [PROJECT_SETTINGS],
  "@repo/db-migrator": [UPDATE_SOURCES],
};

export function isDeployAffected(packageName, changedFiles) {
  const rules = Object.hasOwn(RULES, packageName) ? RULES[packageName] : [];
  return changedFiles.some((file) => rules.some((rule) => rule.test(file)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageName = process.argv[2];
  if (!packageName) {
    process.stderr.write(
      "用法:deploy-affected.mjs <package 名> < 變更檔案清單\n",
    );
    process.exitCode = 1;
  } else {
    let input = "";
    try {
      input = readFileSync(0, "utf8");
    } catch (error) {
      // Windows 上空的 stdin 會丟 EOF;其餘錯誤照常失敗(deploy.yml 視為要重建)
      if (error.code !== "EOF") throw error;
    }
    const files = input
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    process.stdout.write(`${isDeployAffected(packageName, files)}\n`);
  }
}
