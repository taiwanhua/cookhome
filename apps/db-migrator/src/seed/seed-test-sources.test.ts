import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * 測試來源的界線:哪些測試可以讀正式的專案來源(`seeds/project/`)。
 *
 * 引用專案在 `seeds/project/` 登記自己的模組、普通種子與定義之後,底座的測試不能因此變紅。所以:
 * - **夾具與測試支援**(`test/`)一律用自己的來源(空專案來源 `seeds-base`、非空專案來源 `seeds-project`…),
 *   不 import 正式專案來源 —— 疊在正式來源上的夾具會與專案的內容撞 key,或讓刻意缺少依賴的負例意外通過
 * - **測試檔**只有下列「正式 registry 的契約檢查」可以讀:它們驗目前的宣告是否合法,期望值從正式來源本身推出,
 *   不寫死底座的數量
 */
const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const PROJECT_SOURCE = path.join(PACKAGE_ROOT, "seeds", "project");

/** 可以 import 正式專案來源的測試檔(正式 registry 的契約檢查)。 */
const FORMAL_CONTRACT_TESTS = new Set([
  "src/seed/seed-composition.test.ts",
  "src/seed/seed-formal-registry.test.ts",
]);

const SOURCE_FILE = /\.(?:ts|mts|mjs|js)$/;
/** 相對路徑的字串(`from "…"`、`import("…")` 的寫法都在內;寧可多抓,不漏掉)。 */
const RELATIVE_SPECIFIER = /["'](?<specifier>\.{1,2}\/[^"'\n]+)["']/g;

function sourceFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && SOURCE_FILE.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

const relativePathOf = (file: string): string =>
  path.relative(PACKAGE_ROOT, file).split(path.sep).join("/");

/** 這個檔以相對路徑 import 的檔案裡,落在正式專案來源底下的那些。 */
function projectSourceImportsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(RELATIVE_SPECIFIER)]
    .map((match) =>
      path.resolve(path.dirname(file), match.groups?.specifier ?? ""),
    )
    .filter(
      (resolved) => !path.relative(PROJECT_SOURCE, resolved).startsWith(".."),
    )
    .map((resolved) => relativePathOf(resolved));
}

function offendersIn(files: string[]): string[] {
  return files.flatMap((file) =>
    projectSourceImportsOf(file).map(
      (imported) => `${relativePathOf(file)} → ${imported}`,
    ),
  );
}

describe("測試來源的界線:正式專案來源只給契約檢查讀", () => {
  it("夾具與測試支援(test/)不 import 正式的 seeds/project/", () => {
    expect(offendersIn(sourceFilesIn(path.join(PACKAGE_ROOT, "test")))).toEqual(
      [],
    );
  });

  it("src/ 的測試檔只有正式 registry 的契約檢查 import seeds/project/", () => {
    const tests = sourceFilesIn(path.join(PACKAGE_ROOT, "src")).filter(
      (file) =>
        file.endsWith(".test.ts") &&
        !FORMAL_CONTRACT_TESTS.has(relativePathOf(file)),
    );
    expect(offendersIn(tests)).toEqual([]);
  });

  it("契約檢查確實讀正式專案來源(清單沒有過期;界線的偵測抓得到這種 import)", () => {
    for (const file of FORMAL_CONTRACT_TESTS) {
      expect(projectSourceImportsOf(path.join(PACKAGE_ROOT, file))).not.toEqual(
        [],
      );
    }
  });
});
