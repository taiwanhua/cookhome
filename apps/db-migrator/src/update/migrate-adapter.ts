/**
 * migrate-mongo 的適配(`docs/concepts/data-layer-and-isolation.md`「Migration 與設定順序」)。
 *
 * changelog 仍由 migrate-mongo 自己讀寫(`changelog.fileName`、`appliedAt`、`useFileHash: false`),
 * 這裡不手寫替代。套件只掃一層平面目錄、沒有「只跑這一支」的參數,所以每次產生一個**只含單支
 * migration 的暫存目錄**:裡面是同 basename 的 wrapper,以絕對 file URL import 原檔(原檔的相對
 * import 照原位置解析,不複製原檔)。wrapper 依序呼叫原檔的 `up` 與 `verify`,verify 通過才回到
 * 套件,套件才記 changelog —— 不會先記成功再驗。
 *
 * 套件的 `config.set` 與 `global.options` 是整個程序共用的狀態:整段「設定 → 執行 → 還原」在同一個
 * 程序裡排隊執行,不並行;還原與清暫存目錄放在 finally。套件自己的鎖維持停用(`lockTtl: 0`):
 * 啟用的話它的 `clear` 會把 `changelog_lock` 整張清掉,連外層的整批鎖一起刪。
 */
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { type MigrateMongoConfig, config, down, up } from "migrate-mongo";
import type { Db, MongoClient } from "mongodb";

import { PACKAGE_ROOT } from "../cli";
import type { MigrationContext } from "./journal";
import type { MigrationModule } from "./migration-sources";
import type { AppliedMigration, MigrationSource } from "./plan";

const CONFIG_PATH = path.join(PACKAGE_ROOT, "migrate-mongo-config.js");

/** wrapper 與本檔之間的橋:wrapper 以 token 取回這次執行的步驟。 */
const BRIDGE_KEY = "@repo/db-migrator/migrate-adapter";

interface Bridge {
  up(migration: MigrationModule, db: Db, client: MongoClient): Promise<void>;
  down(migration: MigrationModule, db: Db, client: MongoClient): Promise<void>;
}

/** migrate-mongo 沒有照預期只處理那一支,或原檔少了該有的函式。 */
export class MigrateAdapterError extends Error {
  override name = "MigrateAdapterError";
}

/** 一支 migration 的 up 流程裡、由執行器決定的步驟(journal 與續跑都在執行器)。 */
export interface MigrationUpSteps {
  /** 傳給原檔 `up` / `verify` 的 context(續跑時是保存的那一份)。 */
  context: MigrationContext;
  /** false = 不執行 `up`,只 verify(沒有待轉換資料的 no-op,或 verify 已過、補記 changelog)。 */
  runUp: boolean;
  beforeUp(): Promise<void>;
  /** `up` 回傳後、verify 之前;`result` 是原檔 `up` 的回傳值。 */
  afterUp(result: unknown): Promise<void>;
  /** verify 通過後、回到 migrate-mongo(它接著記 changelog)之前。 */
  afterVerify(): Promise<void>;
}

type MigrationFunction = (...args: unknown[]) => unknown;

function bridges(): Map<string, Bridge> {
  const holder = globalThis as unknown as Record<
    symbol,
    Map<string, Bridge> | undefined
  >;
  const key = Symbol.for(BRIDGE_KEY);
  holder[key] ??= new Map<string, Bridge>();
  return holder[key];
}

function requireFunction(
  module: MigrationModule,
  name: "up" | "down" | "verify",
  fileName: string,
): MigrationFunction {
  const candidate = module[name];
  if (typeof candidate !== "function") {
    throw new MigrateAdapterError(`${fileName} 沒有 export ${name}`);
  }
  return candidate as MigrationFunction;
}

/** 暫存 wrapper:CommonJS(暫存目錄自帶 `package.json` 指明),原檔以動態 import 載入。 */
function wrapperSource(token: string, filePath: string): string {
  return [
    '"use strict";',
    "// db-migrator 的 update 產生的暫存檔,執行完即刪除。",
    `const bridge = globalThis[Symbol.for(${JSON.stringify(BRIDGE_KEY)})].get(${JSON.stringify(token)});`,
    `const load = () => import(${JSON.stringify(pathToFileURL(filePath).href)});`,
    "module.exports = {",
    "  up: async (db, client) => bridge.up(await load(), db, client),",
    "  down: async (db, client) => bridge.down(await load(), db, client),",
    "};",
    "",
  ].join("\n");
}

let baseConfig: Promise<MigrateMongoConfig> | undefined;

/** 既有的 `migrate-mongo-config.js`(changelog 表名、`useFileHash`、`lockTtl` 的唯一正本)。 */
async function loadBaseConfig(): Promise<MigrateMongoConfig> {
  baseConfig ??= (
    import(pathToFileURL(CONFIG_PATH).href) as Promise<{
      default: MigrateMongoConfig;
    }>
  ).then((loaded) => loaded.default);
  const loaded = await baseConfig;
  if (loaded.lockTtl !== 0) {
    throw new MigrateAdapterError(
      "migrate-mongo-config.js 的 lockTtl 必須是 0:啟用套件自己的鎖會在結束時清空 changelog_lock,連整批互斥鎖一起刪掉",
    );
  }
  return loaded;
}

/** 已記在 changelog 的 migration(唯讀;依 fileName 排序)。 */
export async function readAppliedMigrations(
  database: Db,
): Promise<AppliedMigration[]> {
  const { changelogCollectionName } = await loadBaseConfig();
  const entries = await database
    .collection<AppliedMigration>(changelogCollectionName)
    .find({}, { projection: { _id: 0, fileName: 1, appliedAt: 1 } })
    .sort({ fileName: 1 })
    .toArray();
  return entries.map(({ fileName, appliedAt }) => ({ fileName, appliedAt }));
}

/** 同一個程序裡一次只跑一段(套件的設定是模組層全域狀態)。 */
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {
    /* 失敗由呼叫端處理;佇列照常往下 */
  });
  return next;
}

/** 以只含這一支的暫存目錄執行 migrate-mongo 的一個動作;結束後還原全域狀態並清掉暫存目錄。 */
function withSingleMigration<T>(
  source: MigrationSource,
  bridge: Bridge,
  action: () => Promise<T>,
): Promise<T> {
  return serialized(async () => {
    const base = await loadBaseConfig();
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "db-migrator-update-"),
    );
    const token = randomUUID();
    const globals = globalThis as { options?: unknown };
    const hadOptions = Object.hasOwn(globals, "options");
    const previousOptions = globals.options;
    bridges().set(token, bridge);
    try {
      await writeFile(
        path.join(directory, "package.json"),
        `${JSON.stringify({ type: "commonjs" })}\n`,
      );
      await writeFile(
        path.join(directory, source.fileName),
        wrapperSource(token, source.filePath),
      );
      // 套件的 down 會讀 global.options.block(整批還原);受控的單檔執行不受它影響
      Reflect.deleteProperty(globals, "options");
      config.set({ ...base, migrationsDir: directory });
      return await action();
    } finally {
      // 套件沒有讀回「先前 set 過什麼」的介面(read 在未 set 時是去讀設定檔),無從保存再放回;
      // 本程序只有這裡會 set,執行前就是未設定,所以還原成未設定(null)即原狀
      config.set(null);
      if (hadOptions) {
        globals.options = previousOptions;
      }
      bridges().delete(token);
      await rm(directory, { recursive: true, force: true });
    }
  });
}

function assertOnly(
  handled: readonly string[],
  fileName: string,
  action: string,
): void {
  if (handled.length !== 1 || handled[0] !== fileName) {
    throw new MigrateAdapterError(
      `migrate-mongo 沒有照預期${action} ${fileName}(實際:${handled.length === 0 ? "無" : handled.join("、")})`,
    );
  }
}

/**
 * 經 migrate-mongo 執行一支尚未記在 changelog 的 migration:原檔的 `up` → `verify` → 套件記 changelog。
 * 任何一步失敗都不會有 changelog 紀錄。
 */
export async function applyMigration(
  database: Db,
  client: MongoClient,
  source: MigrationSource,
  steps: MigrationUpSteps,
): Promise<void> {
  const bridge: Bridge = {
    up: async (migration, db, mongoClient) => {
      await steps.beforeUp();
      if (steps.runUp) {
        const migrationUp = requireFunction(migration, "up", source.fileName);
        await steps.afterUp(await migrationUp(db, mongoClient, steps.context));
      }
      if (migration.verify !== undefined || source.exports.verify) {
        const verify = requireFunction(migration, "verify", source.fileName);
        await verify(db, steps.context);
      }
      await steps.afterVerify();
    },
    down: () =>
      Promise.reject(new MigrateAdapterError("這個 wrapper 只供 up 使用")),
  };
  const migrated = await withSingleMigration(source, bridge, () =>
    up(database, client),
  );
  assertOnly(migrated, source.fileName, "執行");
}

/** 經 migrate-mongo 還原一支已記在 changelog 的 migration:原檔的 `down` → 套件刪 changelog 紀錄。 */
export async function rollbackMigration(
  database: Db,
  client: MongoClient,
  source: MigrationSource,
): Promise<void> {
  const bridge: Bridge = {
    up: () =>
      Promise.reject(new MigrateAdapterError("這個 wrapper 只供 down 使用")),
    down: async (migration, db, mongoClient) => {
      const migrationDown = requireFunction(migration, "down", source.fileName);
      await migrationDown(db, mongoClient);
    },
  };
  const downgraded = await withSingleMigration(source, bridge, () =>
    down(database, client),
  );
  assertOnly(downgraded, source.fileName, "還原");
}
