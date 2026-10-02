#!/usr/bin/env node
import "reflect-metadata";

import { ConsoleLogger, type LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import {
  DefinitionSeedProtocolError,
  type DefinitionSeedResult,
  isDefinitionSeedResultOk,
  parseDefinitionSeedRequest,
} from "@repo/domain/seed";

import { DefinitionSeedService } from "./definition-seed.service";
import { SeedRuntimeModule } from "./seed-runtime.module";

/**
 * 受管定義的受控 CLI(建置為 `dist/seed/run.js`;`docs/plans/seed-migration.md`「發布、身分與衝突」)。
 *
 * db-migrator 以子程序啟動它:**stdin 一份 `DefinitionSeedRequest` JSON、stdout 一份 `DefinitionSeedResult` JSON**,
 * 診斷只到 stderr。不收命令列參數、不開 HTTP、不啟動 `AppModule`;連到哪個資料庫與操作者帳號由啟動它的
 * 命令以環境變數決定(`MONGODB_URI`、`ROOT_ADMIN_ACCOUNT`)。
 *
 * 結束碼:整批沒有 `errors`、沒有任何衝突 → 0;其餘 → 1(stdout 仍是一份合法的結果 JSON)。
 */

/** 請求格式不符(版本、缺欄位、宣告形狀)。 */
const PROTOCOL_ERROR = "PROTOCOL_ERROR";
/** 啟動或執行中未預期的失敗(連不上資料庫、組裝失敗…)。 */
const CLI_FAILED = "CLI_FAILED";

/** Nest 的 log 全部改寫到 stderr:stdout 只留給協定的那一份 JSON。 */
class StderrLogger extends ConsoleLogger {
  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
  ): void {
    super.printMessages(messages, context, logLevel, "stderr");
  }
}

function failure(code: string, error: unknown): DefinitionSeedResult {
  return {
    results: [],
    errors: [
      {
        code,
        message: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function execute(input: string): Promise<DefinitionSeedResult> {
  let request;
  try {
    request = parseDefinitionSeedRequest(JSON.parse(input));
  } catch (error) {
    if (
      error instanceof DefinitionSeedProtocolError ||
      error instanceof SyntaxError
    ) {
      return failure(PROTOCOL_ERROR, error);
    }
    throw error;
  }
  const context = await NestFactory.createApplicationContext(
    SeedRuntimeModule,
    { logger: new StderrLogger(), abortOnError: false },
  );
  try {
    return await context.get(DefinitionSeedService).execute(request);
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  // 任何相依套件寫到 stdout 的東西都改道 stderr;協定的 JSON 用原本的 stdout 寫
  const writeResult = process.stdout.write.bind(process.stdout);
  process.stdout.write = process.stderr.write.bind(process.stderr);

  let result: DefinitionSeedResult;
  try {
    result = await execute(await readStdin());
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    result = failure(CLI_FAILED, error);
  }
  const exitCode = isDefinitionSeedResultOk(result) ? 0 : 1;
  // 寫完(管線已排空)才結束:直接 exit 可能截斷還沒送出的輸出
  writeResult(`${JSON.stringify(result)}\n`, () => {
    process.exit(exitCode);
  });
}

void main();
