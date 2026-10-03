import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  MANAGED_V2,
  RESET_MARKER,
  dumpApplicationData,
  runReset,
  runResetWithFault,
  startResetWithFault,
} from "../../test/support/reset-harness";
import {
  ARCHIVED,
  LEAVING,
  ORDER,
  REVIEW,
  definitionStateOf,
  insertFieldData,
  installV1,
  installV2,
  installationLabels,
  versionLabels,
} from "../../test/support/reset-managed";
import { cloneDatabase } from "../../test/support/update-evolve";
import {
  BASE_ONLY_REGISTRY,
  BUILD_TIMEOUT_MS,
  HARD_ABORT_EXIT_CODE,
  PACKAGE_ROOT,
  SEED_ENTRY,
  TestMongo,
  buildDefinitionCli,
  changelogOf,
  collectionNames,
  documentsOf,
  dumpDatabase,
  journalOf,
  lockOf,
  runUpdate,
  startEntry,
  withDatabase,
} from "../../test/support/update-harness";

/**
 * `full` reset(`docs/concepts/data-layer-and-isolation.md` 「還原」):清除所有應用 collection 與索引
 * 並依所選版本重建,整批鎖從頭到尾有效,清除中途或重建中途失敗都留下證據、再次明確執行可以重入。
 * 真的拋棄式 MongoDB、真的指令子行程與 api 受管定義 CLI;中斷來自真的檢查點(`test/support/reset-fault-entry.ts`)。
 */

const mongo = new TestMongo("db-migrator-reset-full");
/** 裝到第二版、帶現場資料的資料庫;每個案例複製一份。 */
let template: string;

const FULL = { mode: "full", args: [MANAGED_V2] } as const;

async function managedDatabase(suffix: string): Promise<string> {
  const databaseUri = mongo.uri(suffix);
  await cloneDatabase(template, databaseUri);
  return databaseUri;
}

/** 輪詢直到條件成立(另一個程序走到指定的步驟)。 */
async function waitFor(
  probe: () => Promise<boolean>,
  label: string,
): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await probe()) {
      return;
    }
    await delay(100);
  }
  throw new Error(`等待「${label}」逾時`);
}

/** 重建完成後應有的最終狀態:只有第二版 registry 登記的定義、各自從版號 1 起算,沒有任何現場資料。 */
async function expectRebuilt(databaseUri: string): Promise<void> {
  const state = await definitionStateOf(databaseUri);
  expect(state.forms.map((form) => form.key as string)).toEqual([
    ARCHIVED,
    ORDER,
  ]);
  expect(versionLabels(state.formVersions, "formKey")).toEqual([
    `${ARCHIVED}@1:retired`,
    `${ORDER}@1:published`,
  ]);
  expect(versionLabels(state.workflowVersions, "workflowKey")).toEqual([
    `${REVIEW}@1:published`,
  ]);
  // 依所選版本重建:第二版的內容在新環境是版號 1,沒有第一版、也沒有已退出登記的定義
  expect(installationLabels(state.installations)).toEqual([
    `${ARCHIVED}@r1→1`,
    `${ORDER}@r2→1`,
    `${REVIEW}@r1→1`,
  ]);
  expect(
    state.dynamicPermissions.map((permission) => permission.key as string),
  ).toEqual([
    "project-form.edit-reset_order-amount",
    "project-form.show-reset_order-amount",
  ]);
  const names = await collectionNames(databaseUri);
  for (const cleared of [
    "business_relationships",
    "workflow_instances",
    "workflow_tasks",
  ]) {
    expect(await documentsOf(databaseUri, cleared)).toEqual([]);
  }
  expect(names).toContain("changelog_lock");
  const orgs = await documentsOf(databaseUri, "orgs");
  // 根組織回到專案初值(夾具的專案設定),不是現場改過的名稱
  expect(orgs).toMatchObject([{ key: "root", name: "專案甲營運中心" }]);
  const changelog = await changelogOf(databaseUri);
  expect(changelog.map((entry) => entry.fileName as string)).toEqual([
    RESET_MARKER,
  ]);
  // migration 從空庫重新執行了一次
  expect(await documentsOf(databaseUri, "reset_fixture_marks")).toMatchObject([
    { _id: "reset-marker", runs: 1 },
  ]);
  const runs = await journalOf(databaseUri, "run");
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    operation: "reset-full",
    status: "succeeded",
    stage: "done",
  });
  expect(await lockOf(databaseUri)).toBeNull();
}

beforeAll(async () => {
  await mongo.start();
  await buildDefinitionCli();
  template = mongo.uri("template");
  await installV1(template);
  await installV2(template);
  await insertFieldData(template);
}, BUILD_TIMEOUT_MS);

afterAll(async () => {
  await mongo.stop();
}, 60_000);

describe("full reset:清除全部應用 collection 並依所選版本重建,鎖不丟", () => {
  it("清除完成、尚未重建的那一刻:只剩鎖與剛重建的執行紀錄,鎖仍由這次 reset 持有,其他程序進不來;放行後重建完成", async () => {
    const databaseUri = await managedDatabase("locked");
    const before = await definitionStateOf(databaseUri);
    const changelogBefore = await changelogOf(databaseUri);
    const release = path.join(
      mkdtempSync(path.join(os.tmpdir(), "db-migrator-reset-")),
      "release",
    );

    const running = startResetWithFault(
      databaseUri,
      FULL,
      "reset:reset-cleared",
      `wait:${release}`,
    );
    await waitFor(async () => {
      const lock = await lockOf(databaseUri);
      const progress = lock?.progress as { stage?: string } | undefined;
      return progress?.stage === "reset-cleared";
    }, "full reset 清除完成");

    // 所有應用 collection(連 changelog、安裝紀錄、舊的執行紀錄)都不在了;鎖沒有被清掉
    expect(await collectionNames(databaseUri)).toEqual([
      "changelog_lock",
      "seed_update_runs",
    ]);
    const lock = await lockOf(databaseUri);
    expect(lock).toMatchObject({
      operation: "reset-full",
      progress: { stage: "reset-cleared" },
    });
    // 清除後立即重建的當次執行紀錄(舊的執行紀錄已隨整張表清掉)
    const runs = await journalOf(databaseUri, "run");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      runId: lock?.runId as string,
      operation: "reset-full",
      status: "running",
      stage: "reset-cleared",
    });

    // 同一把鎖還在:另一個 update 與另一個 reset 都立刻被擋,什麼都沒寫
    const update = await runUpdate(databaseUri, [MANAGED_V2]);
    const secondReset = await runReset(databaseUri, FULL);
    for (const blocked of [update, secondReset]) {
      expect(blocked.status).toBe(1);
      expect(blocked.stderr).toContain("無法取得整批互斥鎖");
      expect(blocked.stderr).toContain(`owner ${String(lock?.owner)}`);
    }
    expect(await collectionNames(databaseUri)).toEqual([
      "changelog_lock",
      "seed_update_runs",
    ]);

    writeFileSync(release, "");
    const finished = await running.done;
    expect(finished.stderr).toBe("");
    expect(finished.status).toBe(0);
    expect(finished.stdout).toContain("保留 changelog_lock");
    expect(finished.stdout).toContain(
      `定義 form-definition:${ORDER}@r2 → 版本 1(created)`,
    );

    await expectRebuilt(databaseUri);
    // 是重建不是保留:定義的 id 都是新的,changelog 也是這次重跑記的
    const after = await definitionStateOf(databaseUri);
    const oldIds = new Set(before.forms.map((form) => String(form._id)));
    expect(after.forms.some((form) => oldIds.has(String(form._id)))).toBe(
      false,
    );
    const [entry] = await changelogOf(databaseUri);
    expect(String(entry?._id)).not.toBe(String(changelogBefore[0]?._id));
    // 索引也跟著重建(drop 是連索引一起清;api 的 CLI 啟動時建回)
    const indexes = await withDatabase(databaseUri, (database) =>
      database.collection("form_versions").indexes(),
    );
    expect(indexes.map((index) => index.name)).toContain(
      "formKey_draft_unique",
    );
  }, 600_000);

  it("清除中途失敗(執行紀錄已被清掉之後):重建一筆失敗紀錄記下階段再釋放鎖;data reset 被擋;再次明確 full 從還在的接著清並完成", async () => {
    const databaseUri = await managedDatabase("clear-failed");

    const failed = await runResetWithFault(
      databaseUri,
      FULL,
      "reset:reset-collection-cleared@workflow_versions",
    );
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(
      "模擬中斷:reset-collection-cleared workflow_versions",
    );
    expect(failed.stdout).not.toContain("reset(full)完成");
    // 清到一半:排在後面的 collection 還在,前面的(含原本的執行紀錄)都清掉了
    const names = await collectionNames(databaseUri);
    expect(names).toContain("workflows");
    expect(names).not.toContain("forms");
    expect(names).not.toContain("changelog");
    // 證據:執行紀錄被清掉之後重建了一筆失敗紀錄,帶著階段;鎖正常釋放
    const runs = await journalOf(databaseUri, "run");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      operation: "reset-full",
      status: "failed",
      stage: "reset-clear",
    });
    expect(String(runs[0]?.error)).toContain("模擬中斷");
    expect(await lockOf(databaseUri)).toBeNull();

    // 半清的資料庫不能用 data reset 當成一般重置:整次拒絕、不再多刪
    const half = await dumpApplicationData(databaseUri);
    const data = await runReset(databaseUri, {
      mode: "data",
      args: [MANAGED_V2],
    });
    expect(data.status).toBe(1);
    expect(data.stderr).toContain("reset-full");
    expect(data.stderr).toContain("停在 reset-clear 階段");
    expect(await dumpApplicationData(databaseUri)).toEqual(half);

    const again = await runReset(databaseUri, FULL);
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    await expectRebuilt(databaseUri);
  }, 600_000);

  it("清除中途硬中止:鎖留著並記著階段與進度,不自動接管;操作者指名解鎖後再次明確 full 重入完成", async () => {
    const databaseUri = await managedDatabase("clear-aborted");

    const aborted = await runResetWithFault(
      databaseUri,
      FULL,
      "reset:reset-collection-cleared@forms",
      "exit",
    );
    expect(aborted.status).toBe(HARD_ABORT_EXIT_CODE);
    const lock = await lockOf(databaseUri);
    expect(lock).toMatchObject({
      operation: "reset-full",
      progress: { stage: "reset-clear" },
    });
    expect((lock?.progress as { detail: string }).detail).toMatch(
      /^\d+\/\d+:forms$/,
    );
    const half = await dumpApplicationData(databaseUri);

    // 鎖不會因為程序不在了就被接管:再跑一次 full 也被擋,資料停在原處
    const blocked = await runReset(databaseUri, FULL);
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("無法取得整批互斥鎖");
    expect(blocked.stderr).toContain(
      `update --unlock-owner=${String(lock?.owner)}`,
    );
    expect(await dumpApplicationData(databaseUri)).toEqual(half);

    const unlocked = await runUpdate(databaseUri, [
      MANAGED_V2,
      `--unlock-owner=${String(lock?.owner)}`,
    ]);
    expect(unlocked.stderr).toBe("");
    expect(unlocked.status).toBe(0);

    const again = await runReset(databaseUri, FULL);
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    await expectRebuilt(databaseUri);
  }, 600_000);

  it("清除完成後、重建到一半失敗(內部 update 停在普通種子之後):執行紀錄記失敗與階段,不算完成;再次明確 full 重入完成", async () => {
    const databaseUri = await managedDatabase("rebuild-failed");

    const failed = await runResetWithFault(
      databaseUri,
      FULL,
      "update:seeds-applied",
    );
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("模擬中斷:seeds-applied");
    expect(failed.stdout).not.toContain("reset(full)完成");
    const runs = await journalOf(databaseUri, "run");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      operation: "reset-full",
      status: "failed",
      stage: "seeds",
    });
    expect(await lockOf(databaseUri)).toBeNull();
    // 定義還沒發布:半重建的狀態
    expect(await documentsOf(databaseUri, "forms")).toEqual([]);
    expect(await documentsOf(databaseUri, "forms", { key: LEAVING })).toEqual(
      [],
    );

    const again = await runReset(databaseUri, FULL);
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    await expectRebuilt(databaseUri);
  }, 600_000);

  it("清除中途鎖被操作者解除:立刻停止、不再往下清;失敗紀錄寫不進去時如實回報,不假裝已留下紀錄", async () => {
    const databaseUri = await managedDatabase("lock-removed");
    const release = path.join(
      mkdtempSync(path.join(os.tmpdir(), "db-migrator-reset-")),
      "release",
    );

    const running = startResetWithFault(
      databaseUri,
      FULL,
      "reset:reset-collection-cleared@forms",
      `wait:${release}`,
    );
    // 進度是清除之前記的:等到 forms 真的不在了,程序才是停在它之後的檢查點上
    await waitFor(async () => {
      const lock = await lockOf(databaseUri);
      const progress = lock?.progress as { detail?: string } | undefined;
      const names = await collectionNames(databaseUri);
      return (
        progress?.detail?.endsWith(":forms") === true &&
        !names.includes("forms")
      );
    }, "full reset 清完 forms");
    const lock = await lockOf(databaseUri);
    const unlocked = await runUpdate(databaseUri, [
      MANAGED_V2,
      `--unlock-owner=${String(lock?.owner)}`,
    ]);
    expect(unlocked.status).toBe(0);
    const half = await dumpApplicationData(databaseUri);

    writeFileSync(release, "");
    const stopped = await running.done;
    expect(stopped.status).toBe(1);
    expect(stopped.stderr).toContain("整批互斥鎖已不存在");
    expect(stopped.stderr).toContain("失敗紀錄寫不進執行紀錄");
    // 鎖不在自己手上之後一個 collection 都沒有再清
    expect(await dumpApplicationData(databaseUri)).toEqual(half);
    expect(Object.keys(half)).toContain("workflows");

    const again = await runReset(databaseUri, FULL);
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    await expectRebuilt(databaseUri);
  }, 600_000);

  it("先前的 update 停在 migration 的 started:full 不受它擋,明確清除並重建", async () => {
    const databaseUri = mongo.uri("full-over-unfinished");
    const interrupted = await runResetWithFault(
      databaseUri,
      FULL,
      `update:migration-started@${RESET_MARKER}`,
    );
    expect(interrupted.status).toBe(1);
    const runs = await journalOf(databaseUri, "run");
    expect(runs.at(-1)).toMatchObject({
      operation: "reset-full",
      status: "failed",
      stage: "migrations",
    });
    const journal = await journalOf(databaseUri, "migration");
    expect(journal.map((record) => record.status as string)).toEqual([
      "started",
    ]);

    const again = await runReset(databaseUri, FULL);
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    await expectRebuilt(databaseUri);
  }, 600_000);
});

/** 表單 / 流程這幾張表只有 api 的 schema 會建索引(九支歷史 migration 與普通種子都不會)。 */
async function indexNames(
  databaseUri: string,
  collection: string,
): Promise<string[]> {
  const indexes = await withDatabase(databaseUri, (database) =>
    database
      .collection(collection)
      .indexes()
      .catch(() => []),
  );
  return indexes.map((index) => String(index.name));
}

/** 沒有任何定義的來源(正式 migration + 空專案來源的夾具 registry)種好的資料庫。 */
async function seededDatabase(suffix: string): Promise<string> {
  const databaseUri = mongo.uri(suffix);
  const seeded = await startEntry(SEED_ENTRY, [BASE_ONLY_REGISTRY], databaseUri)
    .done;
  expect(seeded.stderr).toBe("");
  expect(seeded.status).toBe(0);
  return databaseUri;
}

const FAILING_CLI = `cli:${path.join(PACKAGE_ROOT, "test", "support", "failing-definition-cli.mjs")}`;

const NO_DEFINITIONS = [BASE_ONLY_REGISTRY] as const;

describe("full reset:registry 沒有登記任何定義(空專案來源的夾具)時,索引一樣靠 api 的 runtime 建回", () => {
  it("受管定義 CLI 沒有建置:刪除之前就拒絕,資料庫原封不動", async () => {
    const databaseUri = await seededDatabase("no-definitions-cli-missing");
    const before = await dumpDatabase(databaseUri);

    const result = await runResetWithFault(
      databaseUri,
      { mode: "full", args: NO_DEFINITIONS },
      `cli:${path.join(os.tmpdir(), "db-migrator-no-such-cli", "run.js")}`,
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("找不到受管定義 CLI");
    expect(result.stdout).toBe("");
    // 還沒搶鎖、也沒有任何寫入
    expect(await dumpDatabase(databaseUri)).toEqual(before);
  }, 300_000);

  it("索引重建失敗(runtime 起不來):停在 definitions 階段、記失敗,不會先記成成功;再次明確 full 完成並建回索引", async () => {
    const databaseUri = await seededDatabase("no-definitions-cli-failing");

    const failed = await runResetWithFault(
      databaseUri,
      { mode: "full", args: NO_DEFINITIONS },
      FAILING_CLI,
    );
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("模擬 runtime 啟動失敗");
    expect(failed.stdout).not.toContain("reset(full)完成");
    const runs = await journalOf(databaseUri, "run");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      operation: "reset-full",
      status: "failed",
      stage: "definitions",
    });
    expect(await lockOf(databaseUri)).toBeNull();
    expect(await indexNames(databaseUri, "form_versions")).toEqual([]);

    const again = await runReset(databaseUri, {
      mode: "full",
      args: NO_DEFINITIONS,
    });
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    expect(again.stdout).not.toContain("定義 form-definition");
    expect(await indexNames(databaseUri, "forms")).toContain("key_1");
    expect(await indexNames(databaseUri, "form_versions")).toContain(
      "formKey_draft_unique",
    );
    expect(await indexNames(databaseUri, "workflow_versions")).toContain(
      "workflowKey_draft_unique",
    );
    expect(await indexNames(databaseUri, "users")).toContain("account_1");
    const finished = await journalOf(databaseUri, "run");
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ status: "succeeded", stage: "done" });
  }, 600_000);

  it("沒有定義的一般 update 與 data reset 不啟動 api 的 runtime(換成會失敗的 CLI 也照常完成)", async () => {
    const databaseUri = await seededDatabase("no-definitions-data");

    const data = await runResetWithFault(
      databaseUri,
      { mode: "data", args: NO_DEFINITIONS },
      FAILING_CLI,
    );
    expect(data.stderr).toBe("");
    expect(data.status).toBe(0);
  }, 300_000);
});
