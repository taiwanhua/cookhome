import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * 專案來源對裸查禁令(`@repo/no-raw-model-query`,ADR-0005)的精確豁免清單。
 * 規則本身的正負例由共用的 `database/no-raw-model-query.test.ts` 驗;這裡只守「專案多了一個豁免就紅」。
 */
const RULE_ID = "@repo/no-raw-model-query";
const SRC_ROOT = path.resolve(__dirname, "..");

/** 目錄下的正式程式檔(不含測試檔)。 */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return entry.endsWith(".ts") && !entry.endsWith(".test.ts") ? [full] : [];
  });
}

describe("ESLint 裸查禁令:專案來源的豁免清單", () => {
  it("專案來源裡的豁免只有 Recipes 的專用 repository 一檔(既有例外不擴大)", () => {
    const waived = sourceFiles(path.join(SRC_ROOT, "project"))
      .filter((file) => readFileSync(file, "utf8").includes(RULE_ID))
      .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join("/"));
    expect(waived).toEqual(["project/database/recipes-legacy.repository.ts"]);
  });
});
