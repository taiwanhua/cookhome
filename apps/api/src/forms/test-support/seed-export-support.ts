/* eslint-disable sonarjs/code-eval, unicorn/prefer-structured-clone -- 測試要實際執行 api 匯出的原始碼(放進隔離的 vm context)才能驗「特殊文字不會被執行、內容一字不差」,取回的值經 JSON 來回換成本 context 的純 JSON 值(不是深拷貝);到期條件:匯出格式不再是可執行的 TypeScript 時移除 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import {
  type CompilerOptions,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  createCompilerHost,
  createProgram,
  createSourceFile,
  flattenDiagnosticMessageText,
  getPreEmitDiagnostics,
  transpileModule,
} from "typescript";

import type { DefinitionSeedSet } from "@repo/domain/seed";

/**
 * 匯出專案設定(`exportFormSeed` / `exportWorkflowSeed`)的測試夾具:GraphQL 文件、
 * 匯出檔的型別檢查與讀回、以及「登記進專案 registry」那一步(TEST-07;測試檔只寫行為)。
 */

export const EXPORT_FORM_SEED = /* GraphQL */ `
  query ExportFormSeed($input: ExportFormSeedInput!) {
    exportFormSeed(input: $input) {
      fileName
      source
    }
  }
`;

export const EXPORT_WORKFLOW_SEED = /* GraphQL */ `
  query ExportWorkflowSeed($input: ExportWorkflowSeedInput!) {
    exportWorkflowSeed(input: $input) {
      fileName
      source
    }
  }
`;

export interface SeedFile {
  fileName: string;
  source: string;
}

/** 不可攜時 `extensions.issues` 的一筆(`@repo/domain/seed` 的 `PortableIssue`)。 */
export interface PortableIssueRow {
  code: string;
  message: string;
  path: string;
}

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const DOMAIN_ROOT = path.join(REPO_ROOT, "packages", "domain");
const DB_MIGRATOR_ROOT = path.join(REPO_ROOT, "apps", "db-migrator");
const TSX_CLI = path.join(
  DB_MIGRATOR_ROOT,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);

/** 匯出檔在型別檢查時的(虛擬)位置:放在共用套件裡,`@repo/domain/seed` 解到的就是正式契約。 */
const EXPORTED_FILE = path.join(DOMAIN_ROOT, "src", "seed", "exported.seed.ts");

const normalize = (fileName: string): string =>
  path.resolve(fileName).toLowerCase();

/**
 * 用真的 TypeScript 編譯器檢查匯出的原始碼(`satisfies SeedSet` 驗的是 `@repo/domain/seed` 的正式契約)。
 * 回診斷訊息;空陣列 = 型別檢查通過。
 */
export function typeCheckSeedSource(source: string): string[] {
  const options: CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ScriptTarget.ES2022,
    module: ModuleKind.ESNext,
    moduleResolution: ModuleResolutionKind.Bundler,
    lib: ["lib.es2024.d.ts"],
    types: [],
    paths: { "@repo/domain/seed": [path.join(DOMAIN_ROOT, "src", "seed.ts")] },
  };
  const host = createCompilerHost(options);
  const isExported = (fileName: string): boolean =>
    normalize(fileName) === normalize(EXPORTED_FILE);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => isExported(fileName) || fileExists(fileName);
  host.readFile = (fileName) =>
    isExported(fileName) ? source : readFile(fileName);
  host.getSourceFile = (fileName, languageVersion, ...rest) =>
    isExported(fileName)
      ? createSourceFile(fileName, source, languageVersion, true)
      : getSourceFile(fileName, languageVersion, ...rest);
  const program = createProgram([EXPORTED_FILE], options, host);
  return getPreEmitDiagnostics(
    program,
    program.getSourceFile(EXPORTED_FILE),
  ).map((diagnostic) =>
    flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}

/** 把匯出的原始碼當模組執行(隔離的 context),取回具名匯出 `seed`,轉成本 context 的純 JSON 值。 */
export function evaluateSeedSource(source: string): unknown {
  const { outputText } = transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
  });
  const exports: { seed?: unknown } = {};
  vm.runInNewContext(outputText, { exports });
  return JSON.parse(JSON.stringify(exports.seed)) as unknown;
}

/**
 * 專案登記檔的替身:照 `apps/db-migrator/seeds/project/registry.ts` 的做法 import 每個匯出檔的 `seed`,
 * 併進專案來源後交給固定組裝入口 `assembleSeedRegistry`(撞 key、引用、可攜性、依賴排序都在那裡驗),
 * 再把組裝後的定義宣告印成 JSON。
 *
 * 專案來源用 db-migrator 的**空專案來源夾具**(`test/fixtures/seeds-base/`),不疊正式的 `seeds/project/`:
 * 引用專案自己登記的模組與定義不會混進回傳值,也不會與測試匯出的定義撞 key。
 */
const REGISTER_SCRIPT = `
import { pathToFileURL } from "node:url";

const [registryPath, sourcePath, ...files] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(file).href);
const { assembleSeedRegistry } = await load(registryPath);
const { baseOnlyProjectSettings, baseOnlyProjectSource } = await load(sourcePath);
const exported = [];
for (const file of files) {
  const loaded = await load(file);
  exported.push(loaded.seed ?? loaded.default?.seed);
}
const registry = assembleSeedRegistry(baseOnlyProjectSettings, {
  ...baseOnlyProjectSource,
  seeds: [...baseOnlyProjectSource.seeds, ...exported],
});
process.stdout.write(
  JSON.stringify(
    registry.filter(
      (set) =>
        set.kind === "form-definition" || set.kind === "workflow-definition",
    ),
  ),
);
`;

/**
 * 把匯出檔**原樣**寫成檔案、登記進(空的)專案來源,回組裝後(已依引用排序)的定義宣告。
 * 以子行程跑 db-migrator 自己的組裝入口(STRUCT-01 禁 app 互 import,同 `seedDatabase` 的做法);
 * 組裝不通過就丟錯並帶出它列的問題。不連資料庫。
 */
export function registerExportedSeeds(
  files: readonly SeedFile[],
): DefinitionSeedSet[] {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "cookhome-seed-export-"),
  );
  try {
    const script = path.join(directory, "register.mts");
    writeFileSync(script, REGISTER_SCRIPT, "utf8");
    const paths = files.map(({ fileName, source }) => {
      const file = path.join(directory, fileName);
      writeFileSync(file, source, "utf8");
      return file;
    });
    const result = spawnSync(
      process.execPath,
      [
        TSX_CLI,
        script,
        path.join(DB_MIGRATOR_ROOT, "seeds", "registry.ts"),
        path.join(
          DB_MIGRATOR_ROOT,
          "test",
          "fixtures",
          "seeds-base",
          "project-source.ts",
        ),
        ...paths,
      ],
      { cwd: DB_MIGRATOR_ROOT, encoding: "utf8", timeout: 180_000 },
    );
    if (result.error !== undefined || result.status !== 0) {
      throw new Error(
        `登記匯出檔失敗(${pathToFileURL(script).href}):${result.error?.message ?? ""}\n${result.stderr}`,
      );
    }
    return JSON.parse(result.stdout) as DefinitionSeedSet[];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
