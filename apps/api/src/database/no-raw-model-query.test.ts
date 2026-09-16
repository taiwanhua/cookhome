import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * 驗證 api 的 ESLint 設定確實擋下裸 Model 查詢(`@repo/no-raw-model-query`,ADR-0005)。
 * 對真 ESLint(含型別感知)跑:程式碼由 stdin 餵入、檔名借用一個存在於 tsconfig 範圍內的正式檔,
 * 讓 project service 能解析型別而不需在磁碟留 fixture。
 */
const RULE_ID = "@repo/no-raw-model-query";
const API_ROOT = path.resolve(__dirname, "../..");
const ESLINT_BIN = path.join(
  path.dirname(require.resolve("eslint/package.json")),
  "bin",
  "eslint.js",
);

interface LintMessage {
  ruleId: string | null;
  line: number;
  message: string;
}

interface LintReport {
  messages: LintMessage[];
}

function lintAsProductionFile(code: string): LintMessage[] {
  const result = spawnSync(
    process.execPath,
    [
      ESLINT_BIN,
      "--stdin",
      "--stdin-filename",
      "src/database/operator-context.ts",
      "--format",
      "json",
    ],
    { cwd: API_ROOT, input: code, encoding: "utf8" },
  );
  const [report] = JSON.parse(result.stdout) as LintReport[];
  if (!report) {
    throw new Error(`ESLint 未產出報告:${result.stderr}`);
  }
  return report.messages.filter((message) => message.ruleId === RULE_ID);
}

describe("ESLint 裸查禁令 @repo/no-raw-model-query(api 正式程式碼)", () => {
  it("對注入的 Mongoose Model 直接查詢 / 寫入 / 取原生 collection 都被擋下", () => {
    const messages = lintAsProductionFile(`
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { DemoItemOne } from "./schemas/demo-item-one.schema";

@Injectable()
export class LeakyService {
  constructor(
    @InjectModel(DemoItemOne.name) private readonly itemModel: Model<DemoItemOne>,
  ) {}

  list(): Promise<DemoItemOne[]> {
    return this.itemModel.find().exec();
  }

  add(name: string): Promise<DemoItemOne> {
    return this.itemModel.create({ name });
  }

  raw(): unknown {
    return this.itemModel.collection;
  }
}
`);
    expect(messages.map((message) => message.line)).toEqual([15, 19, 23]);
  });

  it("Array#find 與 BaseRepository 的查詢不受影響(規則靠型別判斷,不靠方法名)", () => {
    const messages = lintAsProductionFile(`
import type { Model } from "mongoose";

import { BaseRepository } from "./base.repository";
import type { OperatorContext } from "./operator-context";
import { DemoItemOne } from "./schemas/demo-item-one.schema";

export function firstEnabled(items: DemoItemOne[]): DemoItemOne | undefined {
  return items.find((item) => item.enabled);
}

export function listItems(
  model: Model<DemoItemOne>,
  operator: OperatorContext,
): Promise<unknown[]> {
  return new BaseRepository(model).findMany(operator);
}
`);
    expect(messages).toEqual([]);
  });

  it("檔案第一行 eslint-disable(STRUCT-05)可豁免 — 供 BaseRepository 與 recipes 舊原型使用", () => {
    const messages =
      lintAsProductionFile(`/* eslint-disable ${RULE_ID} -- 測試:驗證豁免機制;到期條件:無 */
import type { Model } from "mongoose";

import { DemoItemOne } from "./schemas/demo-item-one.schema";

export function listAll(model: Model<DemoItemOne>): Promise<DemoItemOne[]> {
  return model.find().exec();
}
`);
    expect(messages).toEqual([]);
  });
});
