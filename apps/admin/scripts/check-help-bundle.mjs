#!/usr/bin/env node
/**
 * 防回歸檢查(#259):確認每份模組說明 `src/md/module-help/*.help.md` 的內容
 * 真的被打包進 `dist/assets/index-*.js`。
 *
 * 為什麼需要它:根目錄 `.dockerignore` 有 `**\/*.md`,曾把整個 `src/md/` 排除在
 * Docker build context 之外 —— 本機 `pnpm build` 正常、CI 建出來的 image 卻讓
 * `import.meta.glob("/src/md/module-help/*.help.md")` 變成空的,三環境每頁的「?」
 * 全部 disabled,而且沒有任何一步會失敗。所以檢查放在 Dockerfile 的 builder stage
 * (build 之後),用真正的 build context 跑。
 *
 * 兩種失敗都要抓到:
 *   1. **檔案根本不在 context**(dockerignore 排掉 / 目錄被搬走)→ 掃到 0 份就紅。
 *   2. **檔案在、但沒被 glob 收進去**(檔名不合 `*.help.md`)→ 所以這裡掃的是
 *      `*.md`(該目錄只放模組說明),Vite 收的是 `*.help.md`;把 `x.help.md`
 *      改名成 `x.md` 會被這裡掃到卻不在 bundle 裡,立刻紅。
 *
 * 比對方式:每份取第一個 `## ` 標題後的第一個非空行,前 12 個字當指紋。bundle 是
 * 壓縮過的 JS 字串,非 ASCII 可能被輸出成 `\uXXXX`,所以原字串與跳脫形式都試。
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const helpDir = join(appRoot, "src", "md", "module-help");
const assetsDir = join(appRoot, "dist", "assets");
const FINGERPRINT_LENGTH = 12;

const fail = (message) => {
  console.error(`check:help-bundle ✗ ${message}`);
  process.exit(1);
};

const listFiles = (dir, suffix) => {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(suffix))
      .sort();
  } catch {
    return undefined;
  }
};

/** 第一個 `## ` 標題後的第一個非空行的前 12 個字;拿不到就回 undefined。 */
const fingerprintOf = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.startsWith("## "));
  if (headingIndex === -1) return undefined;
  const body = lines.slice(headingIndex + 1).find((line) => line.trim() !== "");
  return body?.trim().slice(0, FINGERPRINT_LENGTH);
};

/** bundle 可能把非 ASCII 壓成 `\uXXXX`,兩種形式都算命中。 */
const escapeNonAscii = (text) =>
  [...text]
    .map((char) => {
      const code = char.codePointAt(0);
      if (code < 0x80) return char;
      return [...char]
        .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`)
        .join("");
    })
    .join("");

const helpFiles = listFiles(helpDir, ".md");
if (helpFiles === undefined) {
  fail(`讀不到說明目錄 ${helpDir} —— 是不是被 .dockerignore 排除了?`);
}
if (helpFiles.length === 0) {
  fail(`${helpDir} 一份 .md 都沒有 —— 是不是被 .dockerignore 排除了?`);
}

const bundles = listFiles(assetsDir, ".js");
if (bundles === undefined || bundles.length === 0) {
  fail(
    `找不到建置產物 ${assetsDir}/*.js —— 請先跑 \`pnpm --filter @repo/admin build\``,
  );
}
const bundleText = bundles
  .filter((name) => name.startsWith("index-"))
  .concat(bundles.filter((name) => !name.startsWith("index-")))
  .map((name) => readFileSync(join(assetsDir, name), "utf8"))
  .join("\n");

const missing = [];
for (const fileName of helpFiles) {
  const fingerprint = fingerprintOf(
    readFileSync(join(helpDir, fileName), "utf8"),
  );
  if (fingerprint === undefined || fingerprint.length === 0) {
    missing.push(`${fileName}(取不出指紋:缺 \`## \` 標題或其後沒有內容)`);
    continue;
  }
  const hit =
    bundleText.includes(fingerprint) ||
    bundleText.includes(escapeNonAscii(fingerprint));
  if (!hit) missing.push(`${fileName}(指紋「${fingerprint}」不在 bundle 裡)`);
}

if (missing.length > 0) {
  console.error("check:help-bundle ✗ 下列模組說明沒有被打包進 dist:");
  for (const item of missing) console.error(`  - ${item}`);
  console.error(
    "  檢查:①根目錄 .dockerignore 是否把 apps/admin/src/md/**/*.md 排除 " +
      "②檔名是否為 <moduleKey>.help.md(lib/help-registry.ts 的 glob)",
  );
  process.exit(1);
}

console.log(
  `check:help-bundle ✓ ${helpFiles.length} 份模組說明都在 dist/assets 裡`,
);
