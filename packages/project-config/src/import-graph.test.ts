import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * 公開出口的依賴邊界:`/public` 會進瀏覽器 bundle,它的 import 圖不能走到 `/mail`、
 * 環境讀取或 Node API。這裡直接沿原始碼的相對 import 走一遍,而不是只看出口檔那幾行。
 */
const SRC_DIR = __dirname;

const IMPORT_PATTERN = /(?:from|import)\s+"([^"]+)"/g;

const specifiersOf = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(IMPORT_PATTERN)].map(
    (match) => match[1] ?? "",
  );

const resolveRelative = (from: string, specifier: string): string => {
  const base = path.resolve(path.dirname(from), specifier);
  const candidate = [`${base}.ts`, path.join(base, "index.ts")].find((file) =>
    existsSync(file),
  );
  if (candidate === undefined) {
    throw new Error(`解不開 ${from} 的 import "${specifier}"`);
  }
  return candidate;
};

interface Graph {
  files: string[];
  external: string[];
}

const graphOf = (entry: string): Graph => {
  const files = new Set<string>();
  const external = new Set<string>();
  const visit = (file: string): void => {
    if (files.has(file)) {
      return;
    }
    files.add(file);
    for (const specifier of specifiersOf(file)) {
      if (specifier.startsWith(".")) {
        visit(resolveRelative(file, specifier));
      } else {
        external.add(specifier);
      }
    }
  };
  visit(path.join(SRC_DIR, entry));
  return {
    files: [...files].map((file) =>
      path.relative(SRC_DIR, file).replaceAll("\\", "/"),
    ),
    external: [...external],
  };
};

describe("出口的 import 圖", () => {
  const publicGraph = graphOf("public.ts");

  it("`/public` 只由公開契約、鍵生成與專案公開值組成,不依賴任何外部套件", () => {
    expect(
      publicGraph.files.toSorted((a, b) => a.localeCompare(b, "zh-Hant")),
    ).toEqual([
      "base/admin-storage-keys.ts",
      "base/public-config.ts",
      "project/public.ts",
      "public.ts",
    ]);
    expect(publicGraph.external).toEqual([]);
  });

  it("`/public` 的原始碼不讀環境、不碰瀏覽器全域或遠端服務", () => {
    for (const file of publicGraph.files) {
      const source = readFileSync(path.join(SRC_DIR, file), "utf8");
      expect({
        file,
        hit: /process\.env|import\.meta\.env/.test(source),
      }).toEqual({ file, hit: false });
      expect({
        file,
        // 比對「實際取用」的寫法(`window.` / `fetch(`),註解裡提到名稱不算
        hit: /\b(?:window|document|localStorage|sessionStorage)\.|\bfetch\(/.test(
          source,
        ),
      }).toEqual({ file, hit: false });
    }
  });

  it("`/mail` 引用公開值,但不引入外部套件或環境讀取", () => {
    const mailGraph = graphOf("mail.ts");
    expect(mailGraph.files).toContain("project/public.ts");
    expect(mailGraph.files).toContain("project/mail.ts");
    expect(mailGraph.external).toEqual([]);
    for (const file of mailGraph.files) {
      const source = readFileSync(path.join(SRC_DIR, file), "utf8");
      expect({ file, hit: source.includes("process.env") }).toEqual({
        file,
        hit: false,
      });
    }
  });

  it("沒有把所有值匯總的根出口", () => {
    expect(existsSync(path.join(SRC_DIR, "index.ts"))).toBe(false);
    const manifest = JSON.parse(
      readFileSync(path.join(SRC_DIR, "..", "package.json"), "utf8"),
    ) as { exports: Record<string, unknown>; dependencies?: unknown };
    expect(Object.keys(manifest.exports)).toEqual(["./public", "./mail"]);
    expect(manifest.dependencies).toBeUndefined();
  });
});
