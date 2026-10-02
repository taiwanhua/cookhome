import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  LEGACY,
  TICKET,
  TICKET_INDEX,
  TICKET_R2,
  TICKET_V2,
  TICKET_V3,
  V1,
  V3,
  cloneDatabase,
  copyV3Root,
  editSourceFile,
  expectUpgradedToV3,
  insertV1Data,
  migrationRecordsOf,
} from "../../test/support/update-evolve";
import {
  BUILD_TIMEOUT_MS,
  TestMongo,
  buildDefinitionCli,
  changelogOf,
  dumpDatabase,
  fixtureSourceRoot,
  journalOf,
  lockOf,
  runUpdate,
  runUpdateWithFault,
  withDatabase,
} from "../../test/support/update-harness";

/**
 * 中斷之後現場或來源漂移、以及歷史定義閉包的預檢(`docs/plans/seed-migration.md`「Migration 與設定的執行契約」):
 * 未完成的紀錄只在「依賴仍是當初那幾份、映射仍是保存的那一組」時才接續或補記;來源就看得出來的錯在任何寫入之前擋下。
 * 版本 1 的真資料、真的 api 受管定義 CLI;要改來源檔的案例用版本 3 來源的暫存複本。
 */

const R2_SNAPSHOT = "seeds/project/revisions/update_ticket.r2.seed.ts";
const LEGACY_SNAPSHOT = "project/revisions/update_legacy.r1.seed.ts";

const mongo = new TestMongo("db-migrator-drift");
/** 版本 1 + 真資料的樣板資料庫;每一案複製一份來用。 */
let template: string;

async function v1Database(suffix: string): Promise<string> {
  const databaseUri = mongo.uri(suffix);
  await cloneDatabase(template, databaseUri);
  return databaseUri;
}

async function changelogNames(databaseUri: string): Promise<string[]> {
  const changelog = await changelogOf(databaseUri);
  return changelog.map((entry) => entry.fileName as string);
}

async function statusesOf(
  databaseUri: string,
  fileName: string,
): Promise<string[]> {
  const records = await migrationRecordsOf(databaseUri, fileName);
  return records.map((record) => record.status as string);
}

/** 刪掉某個 revision 的安裝紀錄(現場的映射被拿掉)。 */
async function deleteInstallation(
  databaseUri: string,
  key: string,
  revision: string,
): Promise<void> {
  await withDatabase(databaseUri, async (database) => {
    const { deletedCount } = await database
      .collection("seed_definition_installations")
      .deleteOne({ key, revision });
    expect(deletedCount).toBe(1);
  });
}

beforeAll(async () => {
  await mongo.start();
  await buildDefinitionCli();
  template = mongo.uri("template");
  const result = await runUpdate(template, [V1]);
  if (result.status !== 0) {
    throw new Error(`版本 1 的樣板資料庫建立失敗:${result.stderr}`);
  }
  await insertV1Data(template);
}, BUILD_TIMEOUT_MS);

afterAll(async () => {
  await mongo.stop();
}, 60_000);

describe("verify 已過、尚未完整記帳的窗口:漂移時不補成功", () => {
  it.each([
    { checkpoint: "migration-verified", isRecorded: false },
    { checkpoint: "migration-recorded", isRecorded: true },
  ] as const)(
    "中斷在 $checkpoint 之後第二版的安裝映射被刪掉:拒絕,紀錄停在 verified,後面的 migration 與種子都不執行",
    async ({ checkpoint, isRecorded }) => {
      const databaseUri = await v1Database(`mapping-${checkpoint}`);
      const interrupted = await runUpdateWithFault(
        databaseUri,
        [V3],
        `${checkpoint}@${TICKET_V2}`,
      );
      expect(interrupted.status).toBe(1);
      expect(await statusesOf(databaseUri, TICKET_V2)).toEqual(["verified"]);

      await deleteInstallation(databaseUri, TICKET, "r2");
      const changelog = await changelogOf(databaseUri);

      const resumed = await runUpdate(databaseUri, [V3]);
      expect(resumed.status).toBe(1);
      expect(resumed.stderr).toContain(
        `${TICKET_V2}:${TICKET_R2} 已不在保存的 context 記下的映射上`,
      );
      expect(resumed.stdout).not.toContain("seed 完成");
      expect(await statusesOf(databaseUri, TICKET_V2)).toEqual(["verified"]);
      expect(await changelogOf(databaseUri)).toEqual(changelog);
      const names = await changelogNames(databaseUri);
      expect(names.includes(TICKET_V2)).toBe(isRecorded);
      expect(names).not.toContain(TICKET_INDEX);
      expect(names).not.toContain(TICKET_V3);
      expect(await statusesOf(databaseUri, TICKET_V3)).toEqual([]);
      expect(await lockOf(databaseUri)).toBeNull();
    },
    300_000,
  );

  it.each([
    { checkpoint: "migration-verified" },
    { checkpoint: "migration-recorded" },
  ] as const)(
    "中斷在 $checkpoint 之後第二版的快照檔被換掉:拒絕;換回原內容就接續完成",
    async ({ checkpoint }) => {
      const databaseUri = await v1Database(`snapshot-${checkpoint}`);
      const { root, arg } = copyV3Root();
      const interrupted = await runUpdateWithFault(
        databaseUri,
        [arg],
        `${checkpoint}@${TICKET_V2}`,
      );
      expect(interrupted.status).toBe(1);
      const changelog = await changelogOf(databaseUri);

      const snapshotFile = path.join(root, ...R2_SNAPSHOT.split("/"));
      const original = readFileSync(snapshotFile, "utf8");
      editSourceFile(root, R2_SNAPSHOT, (content) =>
        content.replace("第二版:加上優先度", "第二版:事後改過的說明"),
      );

      const resumed = await runUpdate(databaseUri, [arg]);
      expect(resumed.status).toBe(1);
      expect(resumed.stderr).toContain(
        `${TICKET_V2} 的依賴快照與未完成紀錄記下的不同`,
      );
      expect(await statusesOf(databaseUri, TICKET_V2)).toEqual(["verified"]);
      expect(await changelogOf(databaseUri)).toEqual(changelog);
      expect(await statusesOf(databaseUri, TICKET_V3)).toEqual([]);

      writeFileSync(snapshotFile, original);
      const restored = await runUpdate(databaseUri, [arg]);
      expect(restored.stderr).toBe("");
      expect(restored.status).toBe(0);
      await expectUpgradedToV3(databaseUri);
    },
    300_000,
  );
});

describe("preparing 的續跑尊重當時檢視到的映射", () => {
  it("檢視時已安裝、尚未記檢查點的依賴,續跑時映射不見了:拒絕,不另外重裝一份", async () => {
    const databaseUri = await v1Database("inspected-mapping");
    const { root, arg } = copyV3Root();
    // 第三版的 migration 另外依賴舊版登記表的初版(版本 1 就裝好了)
    const legacySeed = readFileSync(
      path.join(
        fixtureSourceRoot("update-evolve", "v1"),
        "seeds",
        ...LEGACY_SNAPSHOT.split("/"),
      ),
      "utf8",
    );
    writeFileSync(
      path.join(root, "seeds", ...LEGACY_SNAPSHOT.split("/")),
      `export const requiresSeeds = ["project/revisions/project-form-module.m1.seed.ts"];\n${legacySeed}`,
    );
    editSourceFile(root, `migrations/project/${TICKET_V3}`, (content) =>
      content.replace(
        'export const seedDependencies = ["project/revisions/update_ticket.r3.seed.ts"];',
        `export const seedDependencies = [${JSON.stringify(LEGACY_SNAPSHOT)}, "project/revisions/update_ticket.r3.seed.ts"];`,
      ),
    );

    const interrupted = await runUpdateWithFault(
      databaseUri,
      [arg],
      `migration-preparing@${TICKET_V3}`,
    );
    expect(interrupted.status).toBe(1);
    const [preparing] = await migrationRecordsOf(databaseUri, TICKET_V3);
    expect(preparing).toMatchObject({ status: "preparing", installed: [] });
    const inspected = (
      preparing?.inspection as { snapshots: Record<string, unknown>[] }
    ).snapshots.find((snapshot) => snapshot.key === LEGACY);
    expect(inspected).toMatchObject({ installed: true, localVersion: 1 });

    await deleteInstallation(databaseUri, LEGACY, "r1");
    const resumed = await runUpdate(databaseUri, [arg]);
    expect(resumed.status).toBe(1);
    expect(resumed.stderr).toContain(
      `${TICKET_V3}:form-definition:${LEGACY}@r1 在檢視時已安裝`,
    );
    expect(await statusesOf(databaseUri, TICKET_V3)).toEqual(["preparing"]);
    // 沒有另外重裝:安裝紀錄仍然不在
    const installations = await withDatabase(databaseUri, (database) =>
      database
        .collection("seed_definition_installations")
        .countDocuments({ key: LEGACY }),
    );
    expect(installations).toBe(0);
  }, 300_000);
});

describe("update 停在目前定義的發布階段:down 不越過它", () => {
  it("migration 都完成、定義已發布但整批尚未核對完成:down 被拒絕;update 接續完成後收斂", async () => {
    const databaseUri = await v1Database("unfinished-definitions");
    const interrupted = await runUpdateWithFault(
      databaseUri,
      [V3],
      "definitions-applied",
    );
    expect(interrupted.status).toBe(1);
    const runs = await journalOf(databaseUri, "run");
    expect(runs.at(-1)).toMatchObject({
      status: "failed",
      stage: "definitions",
    });
    const changelog = await changelogOf(databaseUri);

    const down = await runUpdate(databaseUri, [V3, "--down"]);
    expect(down.status).toBe(1);
    expect(down.stderr).toContain("有未完成的 update");
    expect(await changelogOf(databaseUri)).toEqual(changelog);

    const resumed = await runUpdate(databaseUri, [V3]);
    expect(resumed.stderr).toBe("");
    expect(resumed.status).toBe(0);
    await expectUpgradedToV3(databaseUri);
  }, 300_000);
});

/** 以版本 3 來源的複本、改掉第二版的快照後執行;整個資料庫前後必須完全相同。 */
async function expectRejectedBeforeAnyWrite(
  suffix: string,
  edit: (content: string) => string,
  message: string,
): Promise<void> {
  const databaseUri = await v1Database(suffix);
  const { root, arg } = copyV3Root();
  editSourceFile(root, R2_SNAPSHOT, edit);
  const before = await dumpDatabase(databaseUri);

  const result = await runUpdate(databaseUri, [arg]);
  expect({ status: result.status, stdout: result.stdout }).toEqual({
    status: 1,
    stdout: "",
  });
  expect(result.stderr).toContain(`project:${TICKET_V2} 的依賴閉包:`);
  expect(result.stderr).toContain(TICKET_R2);
  expect(result.stderr).toContain(message);
  expect(await dumpDatabase(databaseUri)).toEqual(before);
}

describe("歷史定義的依賴閉包有來源就看得出來的錯:零寫入", () => {
  it("第二版引用的欄位類別與模組沒有列為前置(目前 registry 有宣告也不算):拒絕", async () => {
    await expectRejectedBeforeAnyWrite(
      "closure-missing",
      (content) =>
        content.replace(
          /export const requiresSeeds = \[[^\]]*\];/,
          "export const requiresSeeds = [];",
        ),
      "ticket-priority",
    );
  }, 300_000);

  it("第二版帶著寫死的環境 id(reference 欄位的固定預設值):拒絕,前置的類別與模組快照也沒有被套用", async () => {
    await expectRejectedBeforeAnyWrite(
      "closure-fixed-id",
      (content) =>
        content.replace(
          /type: "select",\s+widget: \{\s+kind: "dropdown",\s+\},\s+valueSource: \{\s+kind: "input",\s+\},\s+options: \{\s+kind: "fieldCategory",\s+key: "ticket-priority",\s+\},/,
          `type: "reference",
        widget: { kind: "referencePicker" },
        valueSource: { kind: "input" },
        source: { provider: "user", labelField: "name" },
        default: { kind: "constant", value: "0123456789abcdef01234567" },`,
        ),
      "fields.1.default",
    );
  }, 300_000);
});
