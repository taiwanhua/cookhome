import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Document } from "mongodb";

import {
  TICKET,
  TICKET_R2,
  TICKET_V2,
  V1,
  V3,
  cloneDatabase,
  expectUpgradedToV3,
  formOf,
  insertV1Data,
  markOf,
  migrationRecordsOf,
  versionsOf,
} from "../../test/support/update-evolve";
import {
  BUILD_TIMEOUT_MS,
  HARD_ABORT_EXIT_CODE,
  TestMongo,
  buildDefinitionCli,
  changelogOf,
  journalOf,
  lockOf,
  runUpdate,
  runUpdateWithFault,
  withDatabase,
} from "../../test/support/update-harness";
import type { UpdateCheckpoint } from "./update-hooks";

/**
 * 續跑(`docs/concepts/data-layer-and-isolation.md`「Migration 與設定順序」):從版本 1 的真資料升到版本 3 的途中,
 * 讓每一個 journal 的故障窗口各中斷一次,確認重跑都收斂到同一個最終狀態 —— 接續同一筆紀錄與保存的 context,
 * 不重新當成第一次、不重驗自己已經發布的內容、也不多發一個版本。真的 api 受管定義 CLI,不 mock 發布。
 */

const mongo = new TestMongo("db-migrator-resume");
/** 版本 1 + 真資料的樣板資料庫;每一案複製一份來用。 */
let template: string;

async function v1Database(suffix: string): Promise<string> {
  const databaseUri = mongo.uri(suffix);
  await cloneDatabase(template, databaseUri);
  return databaseUri;
}

/** 讓夾具 migration 的 up / verify 在下一次執行時失敗(或解除)。 */
async function setControl(
  databaseUri: string,
  name: "fail-up" | "fail-verify",
  isEnabled: boolean,
): Promise<void> {
  await withDatabase(databaseUri, async (database) => {
    const controls = database.collection<{ _id: string }>(
      "update_fixture_controls",
    );
    const _id = `${name}:${TICKET_V2}`;
    await (isEnabled
      ? controls.insertOne({ _id })
      : controls.deleteOne({ _id }));
  });
}

async function statusOfV2(databaseUri: string): Promise<string[]> {
  const records = await migrationRecordsOf(databaseUri, TICKET_V2);
  return records.map((record) => record.status as string);
}

async function changelogNames(databaseUri: string): Promise<string[]> {
  const changelog = await changelogOf(databaseUri);
  return changelog.map((entry) => entry.fileName as string);
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

interface FaultWindow {
  /** 中斷在哪個檢查點(都落在第二版的資料 migration 上)。 */
  checkpoint: UpdateCheckpoint;
  subject: string;
  /** 中斷當下這支 migration 的 journal 狀態。 */
  statusAtFault: string;
  /** 中斷當下 changelog 是否已有這一支。 */
  isRecordedAtFault: boolean;
  /** 整個過程 `assertSeedInstallable` 被呼叫的次數(續跑不再重驗來源)。 */
  assertRuns: number;
  /** 整個過程 `up` 被執行的次數(verify 已過之後的續跑不再執行 up)。 */
  upRuns: number;
}

const FAULT_WINDOWS: FaultWindow[] = [
  {
    checkpoint: "migration-preparing",
    subject: TICKET_V2,
    statusAtFault: "preparing",
    isRecordedAtFault: false,
    assertRuns: 1,
    upRuns: 1,
  },
  {
    checkpoint: "dependency-installed",
    subject: TICKET_R2,
    statusAtFault: "preparing",
    isRecordedAtFault: false,
    assertRuns: 1,
    upRuns: 1,
  },
  {
    checkpoint: "dependency-recorded",
    subject: TICKET_R2,
    statusAtFault: "preparing",
    isRecordedAtFault: false,
    assertRuns: 1,
    upRuns: 1,
  },
  {
    checkpoint: "migration-started",
    subject: TICKET_V2,
    statusAtFault: "started",
    isRecordedAtFault: false,
    assertRuns: 1,
    upRuns: 1,
  },
  {
    checkpoint: "migration-up-done",
    subject: TICKET_V2,
    statusAtFault: "started",
    isRecordedAtFault: false,
    assertRuns: 1,
    upRuns: 2,
  },
  {
    checkpoint: "migration-verified",
    subject: TICKET_V2,
    statusAtFault: "verified",
    isRecordedAtFault: false,
    assertRuns: 1,
    upRuns: 1,
  },
  {
    checkpoint: "migration-recorded",
    subject: TICKET_V2,
    statusAtFault: "verified",
    isRecordedAtFault: true,
    assertRuns: 1,
    upRuns: 1,
  },
];

describe("每個 journal 故障窗口中斷後重跑都收斂", () => {
  it.each(FAULT_WINDOWS)(
    "中斷在 $checkpoint($statusAtFault):重跑接續同一筆紀錄,最終狀態與沒中斷時相同",
    async ({
      checkpoint,
      subject,
      statusAtFault,
      isRecordedAtFault,
      assertRuns,
      upRuns,
    }) => {
      const databaseUri = await v1Database(checkpoint);

      const interrupted = await runUpdateWithFault(
        databaseUri,
        [V3],
        `${checkpoint}@${subject}`,
      );
      expect(interrupted.status).toBe(1);
      expect(interrupted.stderr).toContain(`模擬中斷:${checkpoint}`);
      expect(interrupted.stdout).not.toContain("seed 完成");
      // 程序正常失敗:鎖依 owner 釋放,journal 停在中斷當下,執行紀錄是失敗
      expect(await lockOf(databaseUri)).toBeNull();
      expect(await statusOfV2(databaseUri)).toEqual([statusAtFault]);
      const recorded = await changelogNames(databaseUri);
      expect(recorded.includes(TICKET_V2)).toBe(isRecordedAtFault);
      const runs = await journalOf(databaseUri, "run");
      expect(runs.at(-1)).toMatchObject({
        status: "failed",
        stage: "migrations",
      });

      const resumed = await runUpdate(databaseUri, [V3]);
      expect(resumed.stderr).toBe("");
      expect(resumed.status).toBe(0);

      await expectUpgradedToV3(databaseUri);
      expect(await markOf(databaseUri, `assert:${TICKET_V2}`)).toMatchObject({
        runs: assertRuns,
      });
      const upMark = await markOf(databaseUri, `up:${TICKET_V2}`);
      expect(upMark).toMatchObject({ runs: upRuns });
      // 每一次 up 拿到的都是第一次執行時記下的那份 context(runId 是當時那次執行)
      const contexts = upMark?.contexts as Document[];
      const [record] = await migrationRecordsOf(databaseUri, TICKET_V2);
      for (const context of contexts) {
        expect(context).toEqual(record?.context);
      }
      expect(record).toMatchObject({
        mode: "convert",
        runId: (record?.context as Document).runId as string,
        context: { definitions: [{ revision: "r2", localVersion: 2 }] },
      });
    },
    300_000,
  );
});

describe("migration 自己失敗後的續跑", () => {
  it("up 部分寫入後失敗:重跑以原 context 把剩下的做完,已轉換的不重做", async () => {
    const databaseUri = await v1Database("up-partial");
    await setControl(databaseUri, "fail-up", true);

    const failed = await runUpdate(databaseUri, [V3]);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(`Could not migrate up ${TICKET_V2}`);
    expect(failed.stderr).toContain("up 只處理了一筆");
    expect(await statusOfV2(databaseUri)).toEqual(["started"]);
    expect(await changelogNames(databaseUri)).not.toContain(TICKET_V2);
    // 依賴(第二版)已發布,資料只轉了一筆
    expect(await formOf(databaseUri, TICKET)).toMatchObject({
      currentVersion: 2,
    });

    await setControl(databaseUri, "fail-up", false);
    const resumed = await runUpdate(databaseUri, [V3]);
    expect(resumed.stderr).toBe("");
    expect(resumed.status).toBe(0);

    await expectUpgradedToV3(databaseUri);
    const upMark = await markOf(databaseUri, `up:${TICKET_V2}`);
    const [first, second] = upMark?.contexts as Document[];
    expect(upMark).toMatchObject({ runs: 2 });
    expect(second).toEqual(first);
    // 續跑的那次 up 只處理剩下的一筆
    expect(resumed.stdout).toContain(
      `migration ${TICKET_V2}:applied(資料 處理 1 / 跳過 1 / 衝突 0;verify 通過)`,
    );
    expect(await markOf(databaseUri, `assert:${TICKET_V2}`)).toMatchObject({
      runs: 1,
    });
  }, 300_000);

  it("verify 失敗:不記 changelog;資料已全部轉完也不會被下一次當成 no-op 蓋過,verify 過了才完成", async () => {
    const databaseUri = await v1Database("verify-failed");
    await setControl(databaseUri, "fail-verify", true);

    const failed = await runUpdate(databaseUri, [V3]);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(`模擬 verify 失敗:${TICKET_V2}`);
    expect(await statusOfV2(databaseUri)).toEqual(["started"]);
    expect(await changelogNames(databaseUri)).not.toContain(TICKET_V2);

    // 此時已沒有待轉換的資料(appliesTo 會回 false),但未完成的紀錄還在:再跑一次仍然失敗,不會記成 no-op
    const again = await runUpdate(databaseUri, [V3]);
    expect(again.status).toBe(1);
    expect(again.stderr).toContain(`模擬 verify 失敗:${TICKET_V2}`);
    expect(again.stdout).not.toContain("no-op");
    expect(await statusOfV2(databaseUri)).toEqual(["started"]);
    expect(await changelogNames(databaseUri)).not.toContain(TICKET_V2);

    await setControl(databaseUri, "fail-verify", false);
    const resumed = await runUpdate(databaseUri, [V3]);
    expect(resumed.stderr).toBe("");
    expect(resumed.status).toBe(0);

    await expectUpgradedToV3(databaseUri);
    const [record] = await migrationRecordsOf(databaseUri, TICKET_V2);
    expect(record).toMatchObject({
      mode: "convert",
      context: { definitions: [{ revision: "r2", localVersion: 2 }] },
    });
    // 工單沒有因為重跑多發任何版本
    expect(await versionsOf(databaseUri, TICKET)).toHaveLength(3);
  }, 300_000);

  it("來源檔在未完成期間被換掉:拒絕接續,不執行任何 migration", async () => {
    const databaseUri = await v1Database("source-changed");
    const interrupted = await runUpdateWithFault(
      databaseUri,
      [V3],
      `migration-started@${TICKET_V2}`,
    );
    expect(interrupted.status).toBe(1);
    await withDatabase(databaseUri, (database) =>
      database
        .collection("seed_update_runs")
        .updateOne(
          { type: "migration", fileName: TICKET_V2 },
          { $set: { sourceHash: `sha256:${"0".repeat(64)}` } },
        ),
    );
    const changelog = await changelogOf(databaseUri);

    const rejected = await runUpdate(databaseUri, [V3]);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain(
      `${TICKET_V2} 有未完成的執行紀錄(started),但來源檔內容與當時不同`,
    );
    expect(await changelogOf(databaseUri)).toEqual(changelog);
    expect(await markOf(databaseUri, `up:${TICKET_V2}`)).toBeUndefined();
    expect(await lockOf(databaseUri)).toBeNull();
  }, 300_000);
});

describe("硬中止:鎖不自動接管", () => {
  it("程序在 up 之前被硬中止:鎖留著、下一次執行被擋;指名 owner 解除後接續完成", async () => {
    const databaseUri = await v1Database("hard-abort");

    const aborted = await runUpdateWithFault(
      databaseUri,
      [V3],
      `migration-started@${TICKET_V2}`,
      "exit",
    );
    expect(aborted.status).toBe(HARD_ABORT_EXIT_CODE);
    const lock = await lockOf(databaseUri);
    expect(lock).toMatchObject({ operation: "update" });
    const owner = lock?.owner as string;
    const changelog = await changelogOf(databaseUri);

    // 不論等多久都不會自動接管:一般執行、down 都被擋,而且什麼都沒寫
    const blocked = await runUpdate(databaseUri, [V3]);
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("無法取得整批互斥鎖");
    expect(blocked.stderr).toContain(`--unlock-owner=${owner}`);
    const blockedDown = await runUpdate(databaseUri, [V3, "--down"]);
    expect(blockedDown.status).toBe(1);
    expect(blockedDown.stderr).toContain("無法取得整批互斥鎖");
    expect(await changelogOf(databaseUri)).toEqual(changelog);
    expect(await statusOfV2(databaseUri)).toEqual(["started"]);

    const status = await runUpdate(databaseUri, [V3, "--status"]);
    expect(status.stdout).toContain(`鎖:owner ${owner}`);
    expect(status.stdout).toContain(
      `${TICKET_V2}  project  PENDING  未完成:started`,
    );

    // 解鎖必須指名目前的 owner;不符就不動
    const wrong = await runUpdate(databaseUri, ["--unlock-owner=someone-else"]);
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toContain("指定的 owner 與目前持有者不符");
    expect(await lockOf(databaseUri)).toMatchObject({ owner });

    const unlocked = await runUpdate(databaseUri, [`--unlock-owner=${owner}`]);
    expect(unlocked.stderr).toBe("");
    expect(unlocked.status).toBe(0);
    expect(await lockOf(databaseUri)).toBeNull();
    const [unlock] = await journalOf(databaseUri, "unlock");
    expect(unlock).toMatchObject({ owner, operation: "update" });
    const runs = await journalOf(databaseUri, "run");
    expect(runs.find((run) => run.runId === lock?.runId)).toMatchObject({
      status: "aborted",
    });

    const resumed = await runUpdate(databaseUri, [V3]);
    expect(resumed.stderr).toBe("");
    expect(resumed.status).toBe(0);
    await expectUpgradedToV3(databaseUri);
  }, 300_000);
});
