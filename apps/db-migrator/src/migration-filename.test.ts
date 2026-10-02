import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { isValidMigrationFilename } from "./migration-filename";

describe("遷移檔命名規約:<時間戳>_<類別>_<描述>.js", () => {
  it("14 位時間戳 + 類別 + kebab-case 描述為合法", () => {
    expect(
      isValidMigrationFilename(
        "20260913120000_schema_changelog-filename-unique-index.js",
      ),
    ).toBe(true);
    expect(
      isValidMigrationFilename("20260913120000_data_backfill-org-keys.js"),
    ).toBe(true);
    expect(
      isValidMigrationFilename("20260913120000_cleanup_drop-legacy-tokens.js"),
    ).toBe(true);
  });

  it("類別僅限 schema|data|cleanup", () => {
    expect(isValidMigrationFilename("20260913120000_seed_root-org.js")).toBe(
      false,
    );
    expect(isValidMigrationFilename("20260913120000_misc_something.js")).toBe(
      false,
    );
  });

  it("時間戳必須是 14 位數字開頭", () => {
    expect(isValidMigrationFilename("2026_schema_too-short-timestamp.js")).toBe(
      false,
    );
    expect(isValidMigrationFilename("schema_no-timestamp.js")).toBe(false);
  });

  it("描述必須是 kebab-case(小寫英數,以連字號分隔)", () => {
    expect(isValidMigrationFilename("20260913120000_schema_CamelCase.js")).toBe(
      false,
    );
    expect(
      isValidMigrationFilename("20260913120000_schema_snake_case_desc.js"),
    ).toBe(false);
    expect(isValidMigrationFilename("20260913120000_schema_.js")).toBe(false);
  });

  it("三段之間以底線分隔,缺一不可", () => {
    expect(isValidMigrationFilename("20260913120000_schema.js")).toBe(false);
    expect(
      isValidMigrationFilename("20260913120000-schema-kebab-everywhere.js"),
    ).toBe(false);
  });
});

describe("migrations/ 目錄靜態檢查", () => {
  /** 新 migration 的兩個來源目錄(根目錄只留已發布的歷史檔)。 */
  const SOURCE_DIRECTORIES = new Set(["base", "project"]);

  it("根目錄與 base/、project/ 的遷移檔皆符合命名規約,basename 全域唯一", () => {
    const migrationsDir = path.resolve(__dirname, "..", "migrations");
    const entries = readdirSync(migrationsDir, { withFileTypes: true });
    const fileNames = entries.flatMap((entry) =>
      entry.isDirectory() && SOURCE_DIRECTORIES.has(entry.name)
        ? readdirSync(path.join(migrationsDir, entry.name))
        : [entry.name],
    );

    expect(fileNames.length).toBeGreaterThan(0);
    const invalidFileNames = fileNames.filter(
      (fileName) => !isValidMigrationFilename(fileName),
    );
    expect(invalidFileNames).toEqual([]);
    expect(new Set(fileNames).size).toBe(fileNames.length);
  });
});
