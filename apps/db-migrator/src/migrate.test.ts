import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const MIGRATE_MONGO_BIN = path.join(
  PACKAGE_ROOT,
  "node_modules",
  "migrate-mongo",
  "bin",
  "migrate-mongo.js",
);
const DEMO_MIGRATION_FILENAME =
  "20260913120000_schema_changelog-filename-unique-index.js";

/** 本地起 mongodb-memory-server;CI 沿用既有 MongoDB service container(MONGODB_URI)。 */
let memoryServer: MongoMemoryServer | undefined;
let baseUri: string;

function buildDatabaseUri(databaseName: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
}

/** 以子行程執行 migrate-mongo 指令(等同 `pnpm --filter db-migrator migrate`)。 */
function runMigrateCommand(action: "up" | "down", databaseUri: string) {
  return spawnSync(process.execPath, [MIGRATE_MONGO_BIN, action], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, MONGODB_URI: databaseUri },
    encoding: "utf8",
  });
}

async function readDatabaseState(databaseUri: string) {
  const client = await MongoClient.connect(databaseUri);
  try {
    const database = client.db();
    const changelog = await database
      .collection("changelog")
      .find()
      .sort({ appliedAt: 1 })
      .toArray();
    const collections = await database.listCollections().toArray();
    const hasChangelogCollection = collections.some(
      (collection) => collection.name === "changelog",
    );
    const changelogIndexes = hasChangelogCollection
      ? await database.collection("changelog").indexes()
      : [];
    return { changelog, changelogIndexes };
  } finally {
    await client.close();
  }
}

async function dropDatabase(databaseUri: string) {
  const client = await MongoClient.connect(databaseUri);
  try {
    await client.db().dropDatabase();
  } finally {
    await client.close();
  }
}

const usedDatabaseUris: string[] = [];

function createTestDatabaseUri(suffix: string): string {
  const databaseUri = buildDatabaseUri(
    `db-migrator-test-${String(process.pid)}-${suffix}`,
  );
  usedDatabaseUris.push(databaseUri);
  return databaseUri;
}

beforeAll(async () => {
  if (process.env.MONGODB_URI) {
    baseUri = process.env.MONGODB_URI;
  } else {
    memoryServer = await MongoMemoryServer.create();
    baseUri = memoryServer.getUri();
  }
}, 600_000);

afterAll(async () => {
  for (const databaseUri of usedDatabaseUris) {
    await dropDatabase(databaseUri);
  }
  await memoryServer?.stop();
}, 60_000);

describe("migrate 指令(對真 MongoDB)", () => {
  it("執行所有未跑過的遷移並記錄於 changelog,示範遷移效果落地", async () => {
    const databaseUri = createTestDatabaseUri("up");

    const result = runMigrateCommand("up", databaseUri);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const { changelog, changelogIndexes } =
      await readDatabaseState(databaseUri);
    expect(changelog).toHaveLength(1);
    expect(changelog[0]?.fileName).toBe(DEMO_MIGRATION_FILENAME);
    expect(changelog[0]?.appliedAt).toBeInstanceOf(Date);

    // 示範遷移(schema 類)的可觀察效果:changelog.fileName 唯一索引
    const uniqueFileNameIndex = changelogIndexes.find(
      (index) => index.unique === true && index.key.fileName === 1,
    );
    expect(uniqueFileNameIndex).toBeDefined();
  }, 120_000);

  it("重跑第二次不重複執行已跑過的遷移(changelog 防重跑)", async () => {
    const databaseUri = createTestDatabaseUri("rerun");

    const firstRun = runMigrateCommand("up", databaseUri);
    expect(firstRun.status).toBe(0);
    const firstState = await readDatabaseState(databaseUri);

    const secondRun = runMigrateCommand("up", databaseUri);
    expect(secondRun.status).toBe(0);

    const secondState = await readDatabaseState(databaseUri);
    expect(secondState.changelog).toHaveLength(1);
    expect(secondState.changelog[0]?.appliedAt).toEqual(
      firstState.changelog[0]?.appliedAt,
    );
  }, 120_000);

  it("down 可還原示範遷移(up/down 成對走通)", async () => {
    const databaseUri = createTestDatabaseUri("down");

    const upResult = runMigrateCommand("up", databaseUri);
    expect(upResult.status).toBe(0);

    const downResult = runMigrateCommand("down", databaseUri);
    expect(downResult.status).toBe(0);

    const { changelog, changelogIndexes } =
      await readDatabaseState(databaseUri);
    expect(changelog).toHaveLength(0);
    const uniqueFileNameIndex = changelogIndexes.find(
      (index) => index.unique === true && index.key.fileName === 1,
    );
    expect(uniqueFileNameIndex).toBeUndefined();
  }, 120_000);
});
