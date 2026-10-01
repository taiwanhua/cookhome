/** @jest-environment node */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { createBrandFromPrimary } from "./brand";
import * as themeExports from "./index";

// 測試以 ESM 執行(沒有 `__dirname`);jest 的工作目錄就是 package 根目錄
const PACKAGE_DIR = process.cwd();
const THEME_DIR = path.join(PACKAGE_DIR, "src", "theme");
const PROJECT_PACKAGE = "@repo/project-config";

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe("通用 UI 與專案設定的邊界", () => {
  it("defaultBrand 是中性預設:名稱不帶專案品牌,主色維持橘色", () => {
    const { defaultBrand } = themeExports;

    expect(defaultBrand).toEqual(createBrandFromPrimary("Default", "#FB7B10"));
    expect(defaultBrand.primary.main).toBe("#FB7B10");
  });

  it("theme 出口不再帶任何專案品牌的匯出", () => {
    expect(
      Object.keys(themeExports).filter((name) => /cookhome/i.test(name)),
    ).toEqual([]);
    expect(readdirSync(path.join(THEME_DIR, "brands"))).toEqual(["default.ts"]);
  });

  it("package.json 不依賴專案設定 package", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
    ]) {
      expect(Object.keys(manifest[field] ?? {})).not.toContain(PROJECT_PACKAGE);
    }
  });

  it("src 底下沒有任何檔案 import 專案設定 package", () => {
    const self = path.join(THEME_DIR, "project-boundary.test.ts");
    const offenders = sourceFiles(path.join(PACKAGE_DIR, "src")).filter(
      (file) =>
        file !== self && readFileSync(file, "utf8").includes(PROJECT_PACKAGE),
    );
    expect(offenders).toEqual([]);
  });
});
