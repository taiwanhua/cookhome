import { spawnSync } from "node:child_process";
import path from "node:path";

import { beforeAll, describe, expect, it } from "@jest/globals";

/**
 * 驗證 api 的 ESLint 設定守住「底座 / 專案」的所有權方向與 Mongoose 注入來源
 * (docs/plans/feature-registration.md「API 與資料登記契約」)。
 * 對真 ESLint(本套件的 eslint.config.mjs,含型別感知)跑:程式碼以文字餵入、檔名借用一個
 * 實際存在的檔案,規則依檔案位置決定適不適用。全部案例在一個子行程裡跑完(起一次型別服務要數秒)。
 */
const OWNERSHIP_RULE = "import-x/no-restricted-paths";
const INJECTION_RULE = "no-restricted-imports";
const RAW_QUERY_RULE = "@repo/no-raw-model-query";
const WATCHED_RULES = new Set([OWNERSHIP_RULE, INJECTION_RULE, RAW_QUERY_RULE]);

const API_ROOT = path.resolve(__dirname, "../..");
const LINT_TIMEOUT_MS = 180_000;

/** 子行程:讀 stdin 的案例清單,逐一 `lintText`,把每案的 ruleId 清單寫回 stdout。 */
const LINT_RUNNER = `
import { ESLint } from "eslint";

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}
const eslint = new ESLint({ cwd: process.cwd() });
const results = [];
for (const { filename, code } of JSON.parse(input)) {
  const [report] = await eslint.lintText(code, { filePath: filename });
  results.push(report.messages.map((message) => message.ruleId));
}
process.stdout.write(JSON.stringify(results));
`;

const BUSINESS_FILE = "src/orgs/orgs.service.ts";
const BASE_DATA_FILE = "src/database/base/registrations.ts";
const APP_ENTRY = "src/app.module.ts";
const DATABASE_ENTRY = "src/database/database.module.ts";
const PROJECT_FEATURE_FILE = "src/project/recipes/recipes.service.ts";
const PROJECT_DATA_FILE = "src/project/database/registrations.ts";
const FIXTURE_FEATURE_FILE =
  "src/test-support/project-fixture/project-fixture.service.ts";
const FIXTURE_DATA_FILE =
  "src/test-support/project-fixture/database/registrations.ts";

/** 從 `from` 檔 import 專案來源的一段程式(相對路徑依檔案位置算)。 */
function importsProject(from: string): string {
  const target = path.posix.relative(
    path.posix.dirname(from),
    "src/project/api-modules",
  );
  const specifier = target.startsWith(".") ? target : `./${target}`;
  return `import { PROJECT_API_MODULES } from "${specifier}";\n\nexport const features = PROJECT_API_MODULES;\n`;
}

const USES_BASE_FROM_PROJECT = `
import { OrgsRepository } from "../../database/database.module";
import { PROJECT_API_MODULES } from "../api-modules";

export const uses = [OrgsRepository, PROJECT_API_MODULES];
`;

const INJECTS_MODEL = `
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class SelfServedService {
  constructor(@InjectModel("Anything") private readonly model: unknown) {}
}
`;

const REGISTERS_MODEL = `
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { Schema } from "mongoose";

export const feature = MongooseModule.forFeature([
  { name: "Anything", schema: new Schema({}) },
]);
export const token = getModelToken("Anything");
`;

const DECLARES_SCHEMA = `
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ collection: "anything" })
export class Anything {
  @Prop({ type: String })
  name?: string;
}

export const AnythingSchema = SchemaFactory.createForClass(Anything);
`;

const RAW_QUERY = `
import type { Model } from "mongoose";

export function listAll(model: Model<{ name: string }>): Promise<unknown[]> {
  return model.find().exec();
}
`;

/** 案例:名稱 → 假裝成哪個檔、餵什麼程式。 */
const CASES = {
  baseFeatureImportsProject: [BUSINESS_FILE, importsProject(BUSINESS_FILE)],
  baseDataImportsProject: [BASE_DATA_FILE, importsProject(BASE_DATA_FILE)],
  appEntryImportsProject: [APP_ENTRY, importsProject(APP_ENTRY)],
  databaseEntryImportsProject: [DATABASE_ENTRY, importsProject(DATABASE_ENTRY)],
  projectUsesBase: [PROJECT_FEATURE_FILE, USES_BASE_FROM_PROJECT],
  fixtureImportsProject: [
    FIXTURE_FEATURE_FILE,
    importsProject(FIXTURE_FEATURE_FILE),
  ],
  fixtureDataRawQuery: [FIXTURE_DATA_FILE, RAW_QUERY],
  projectDataRawQuery: [PROJECT_DATA_FILE, RAW_QUERY],
  baseFeatureInjectsModel: [BUSINESS_FILE, INJECTS_MODEL],
  projectFeatureInjectsModel: [PROJECT_FEATURE_FILE, INJECTS_MODEL],
  fixtureFeatureInjectsModel: [FIXTURE_FEATURE_FILE, INJECTS_MODEL],
  baseFeatureRegistersModel: [BUSINESS_FILE, REGISTERS_MODEL],
  projectFeatureRegistersModel: [PROJECT_FEATURE_FILE, REGISTERS_MODEL],
  baseDataRegistersModel: [BASE_DATA_FILE, REGISTERS_MODEL],
  projectDataRegistersModel: [PROJECT_DATA_FILE, REGISTERS_MODEL],
  fixtureDataRegistersModel: [FIXTURE_DATA_FILE, REGISTERS_MODEL],
  projectFeatureDeclaresSchema: [PROJECT_FEATURE_FILE, DECLARES_SCHEMA],
} as const satisfies Record<string, readonly [string, string]>;

type CaseName = keyof typeof CASES;

function lintAllCases(): Record<CaseName, string[]> {
  const names = Object.keys(CASES) as CaseName[];
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", LINT_RUNNER],
    {
      cwd: API_ROOT,
      input: JSON.stringify(
        names.map((name) => ({
          filename: CASES[name][0],
          code: CASES[name][1],
        })),
      ),
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`ESLint 子行程失敗:${result.stderr}`);
  }
  const reports = JSON.parse(result.stdout) as (string | null)[][];
  return Object.fromEntries(
    names.map((name, index) => [
      name,
      (reports[index] ?? []).filter(
        (ruleId): ruleId is string =>
          ruleId !== null && WATCHED_RULES.has(ruleId),
      ),
    ]),
  ) as Record<CaseName, string[]>;
}

describe("ESLint:所有權方向與 Mongoose 注入來源(api 正式程式碼)", () => {
  let reported: Record<CaseName, string[]>;

  beforeAll(() => {
    reported = lintAllCases();
  }, LINT_TIMEOUT_MS);

  describe("底座與專案的所有權方向", () => {
    it("底座功能與底座資料層的 leaf 檔 import 專案來源:擋下", () => {
      expect(reported.baseFeatureImportsProject).toEqual([OWNERSHIP_RULE]);
      expect(reported.baseDataImportsProject).toEqual([OWNERSHIP_RULE]);
    });

    it("兩個固定組裝入口可以 import 專案來源", () => {
      expect(reported.appEntryImportsProject).toEqual([]);
      expect(reported.databaseEntryImportsProject).toEqual([]);
    });

    it("專案 import 共用的底座出口、專案內部互相 import:允許", () => {
      expect(reported.projectUsesBase).toEqual([]);
    });

    it("測試專案 fixture 只豁免所有權方向:可以 import 專案來源,裸查禁令照樣適用", () => {
      expect(reported.fixtureImportsProject).toEqual([]);
      expect(reported.fixtureDataRawQuery).toEqual([RAW_QUERY_RULE]);
    });
  });

  describe("Mongoose 的注入 / 註冊工具只留在資料層", () => {
    it("底座功能、專案功能、fixture 功能自行 InjectModel:擋下", () => {
      expect(reported.baseFeatureInjectsModel).toEqual([INJECTION_RULE]);
      expect(reported.projectFeatureInjectsModel).toEqual([INJECTION_RULE]);
      expect(reported.fixtureFeatureInjectsModel).toEqual([INJECTION_RULE]);
    });

    it("功能模組自行 forFeature / getModelToken:兩個受限名稱各報一次", () => {
      expect(reported.baseFeatureRegistersModel).toEqual([
        INJECTION_RULE,
        INJECTION_RULE,
      ]);
      expect(reported.projectFeatureRegistersModel).toEqual([
        INJECTION_RULE,
        INJECTION_RULE,
      ]);
    });

    it("資料層(底座、專案、fixture 的 database 目錄)可以用", () => {
      expect(reported.baseDataRegistersModel).toEqual([]);
      expect(reported.projectDataRegistersModel).toEqual([]);
      expect(reported.fixtureDataRegistersModel).toEqual([]);
    });

    it("宣告 schema 的裝飾器不受限", () => {
      expect(reported.projectFeatureDeclaresSchema).toEqual([]);
    });

    it("專案資料層仍受裸查禁令約束(登記檔不是例外)", () => {
      expect(reported.projectDataRawQuery).toEqual([RAW_QUERY_RULE]);
    });
  });
});
