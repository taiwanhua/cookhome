import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { hashArtifact } from "./artifacts.mjs";
import {
  BASE_FILE,
  CONSUMER_FILE,
  RECEIPTS,
  bootstrapCli,
  cliScan,
  cliSync,
  createFakeFigma,
  executeAndRecord,
  executeSource,
  fixed,
  instantiate,
  planArgs,
  readJson,
  runCli,
  runFiles,
  saveReturned,
} from "./test-support.mjs";

const boot = await bootstrapCli();
const { root, world, base, consumer, paths } = boot;
const first = await cliSync(root, world, CONSUMER_FILE, planArgs(paths));
const receiptFile = path.join(root, RECEIPTS, `${CONSUMER_FILE}.json`);
const receiptBytes = () => readFileSync(receiptFile);
const receipt = () => readJson(root, `${RECEIPTS}/${CONSUMER_FILE}.json`);
let scanIndex = 0;
const rescan = (roots = ["10:1"]) => {
  scanIndex += 1;
  return cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    roots,
    `r-con-${scanIndex}`,
  );
};
const addInstance = (id) =>
  consumer.root.append(
    instantiate(world, CONSUMER_FILE, base.components.button, id),
  );
/** 失敗協定:exit 1、stdout 完全沒有輸出、stderr 恰好一行。 */
function assertFailure(result, pattern) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^figma-sync: [^\n]*\n$/);
  assert.match(result.stderr, pattern);
}
const recordResult = (requestPath, value) =>
  runCli(
    ["record", "--request", requestPath, "--result", saveReturned(root, value)],
    {
      cwd: root,
    },
  );

test("record 冪等:相同傳輸包或相同原協定重送回報原結果;不同內容 RESULT_CHANGED", () => {
  assert.equal(first.record.json.status, "verified");
  const before = receiptBytes();
  const { requestPath, envelopes, record } = first;
  // 整組傳輸包重送
  let again;
  for (const envelope of envelopes) {
    again = runCli(
      [
        "record",
        "--request",
        requestPath,
        "--transport-result",
        saveReturned(root, envelope),
      ],
      { cwd: root },
    );
    assert.equal(again.status, 0, again.stderr);
  }
  assert.deepEqual(again.json, record.json);
  assert.deepEqual(receiptBytes(), before);
  // 同一份完整回傳改用 --result 交付:仍是同一個 canonical 內容
  const runDir = path.dirname(requestPath);
  const raw = JSON.parse(
    readFileSync(path.join(runDir, "runtime-result.json"), "utf8"),
  );
  assert.deepEqual(recordResult(requestPath, raw).json, record.json);
  // 同一 run 送來另一份內容(例如重跑了一次 Figma 執行):拒絕,原封存不變
  const changed = structuredClone(raw);
  changed.generatedAt = "2031-01-01T00:00:00.000Z";
  changed.afterInventory.generatedAt = "2031-01-01T00:00:00.000Z";
  assertFailure(
    recordResult(requestPath, changed),
    /^figma-sync: RESULT_CHANGED\n$/,
  );
  assert.deepEqual(receiptBytes(), before);
});

test("--result 與 --transport-result 互斥且必須擇一", () => {
  const { requestPath, envelopes } = first;
  const file = saveReturned(root, envelopes[0]);
  assertFailure(
    runCli(["record", "--request", requestPath], { cwd: root }),
    /record 需要 --result 或 --transport-result 其中一個/,
  );
  assertFailure(
    runCli(
      [
        "record",
        "--request",
        requestPath,
        "--result",
        file,
        "--transport-result",
        file,
      ],
      { cwd: root },
    ),
    /record 需要 --result 或 --transport-result 其中一個/,
  );
  // envelope 不能當原協定交,原協定也不能當 envelope 交
  assertFailure(
    runCli(["record", "--request", requestPath, "--result", file], {
      cwd: root,
    }),
    /ARTIFACT_INVALID/,
  );
  const runDir = path.dirname(requestPath);
  assertFailure(
    runCli(
      [
        "record",
        "--request",
        requestPath,
        "--transport-result",
        path.join(runDir, "runtime-result.json"),
      ],
      { cwd: root },
    ),
    /TRANSPORT_ENVELOPE_INVALID/,
  );
});

test("多塊傳輸:未接齊時 stdout 是 transport-pending 與下一支唯讀 JS;接齊後自動交原 record", async () => {
  for (let index = 0; index < 30; index += 1) {
    consumer.root.append(
      world.node(CONSUMER_FILE, {
        id: `50:${index}`,
        type: "TEXT",
        characters: `${randomBytes(1500).toString("base64")} 中文 \u{1F600}`,
        fills: [fixed()],
        fontName: { family: "Public Sans", style: "Regular" },
      }),
    );
  }
  const requested = runCli(
    [
      "scan",
      "--kind",
      "consumer",
      "--file-key",
      CONSUMER_FILE,
      "--roots",
      "10:1",
      "--run-id",
      "multi-1",
    ],
    { cwd: root },
  );
  const requestPath = path.join(root, requested.json.artifacts[0].path);
  const figma = () => createFakeFigma(world, CONSUMER_FILE);
  const head = await executeSource(
    readFileSync(path.join(root, requested.json.artifacts[1].path), "utf8"),
    figma(),
  );
  assert.ok(head.payload.chunkCount >= 3);
  const send = (envelope) =>
    runCli(
      [
        "record",
        "--request",
        requestPath,
        "--transport-result",
        saveReturned(root, envelope),
      ],
      { cwd: root },
    );
  const pending = send(head);
  assert.equal(pending.status, 0, pending.stderr);
  assert.equal(pending.stderr, "");
  assert.deepEqual(Object.keys(pending.json), [
    "runId",
    "status",
    "artifacts",
    "counts",
  ]);
  assert.equal(pending.json.status, "transport-pending");
  assert.deepEqual(pending.json.counts, {
    receivedChunks: 1,
    totalChunks: head.payload.chunkCount,
  });
  assert.deepEqual(
    pending.json.artifacts.map((item) => [item.kind, item.path]),
    [
      [
        "execution-source",
        ".artifacts/figma-sync/multi-1/transport/scan/read-000001.js",
      ],
    ],
  );
  // pending 不是成功:還沒有 inventory,也沒有 runtime-result
  assert.deepEqual(runFiles(root, "multi-1").top, [
    "request-consumer-scan.json",
    "scan-consumer.js",
  ]);
  let last = pending;
  let calls = 1;
  while (last.json.status === "transport-pending") {
    const source = readFileSync(
      path.join(root, last.json.artifacts[0].path),
      "utf8",
    );
    last = send(await executeSource(source, figma()));
    assert.equal(last.status, 0, last.stderr);
    calls += 1;
  }
  assert.equal(calls, head.payload.chunkCount);
  assert.equal(last.json.status, "recorded");
  const inventory = readJson(
    root,
    ".artifacts/figma-sync/multi-1/inventory-consumer.json",
  );
  assert.equal(hashArtifact(inventory), head.artifactDigest);
  assert.ok(JSON.stringify(inventory).includes("\u{1F600}"));
  assert.equal(world.count("scene"), 15);
});

test("取塊之間檔案漂移:傳輸錯誤先保存再 exit 1,不產生 inventory", async () => {
  const requested = runCli(
    [
      "scan",
      "--kind",
      "consumer",
      "--file-key",
      CONSUMER_FILE,
      "--roots",
      "10:1",
      "--run-id",
      "drift-1",
    ],
    { cwd: root },
  );
  const run = await executeAndRecord(
    root,
    world,
    CONSUMER_FILE,
    requested.json,
    {
      beforeRead: (index) => {
        if (index === 1) consumer.nodes.customButton.x += 1;
      },
    },
  );
  assertFailure(
    run.record,
    /^figma-sync: TRANSPORT_ERROR:TRANSFER_SNAPSHOT_CHANGED\n$/,
  );
  const files = runFiles(root, "drift-1");
  assert.ok(files.transport.includes("error-000000.json"));
  assert.ok(!files.top.includes("inventory-consumer.json"));
  assert.ok(!files.top.includes("runtime-result.json"));
});

test("record(scan)的 --result:只接受協定 JSON 本身,且來源必須是這個 request", async () => {
  const requested = runCli(
    [
      "scan",
      "--kind",
      "consumer",
      "--file-key",
      CONSUMER_FILE,
      "--roots",
      "10:1",
      "--run-id",
      "raw-1",
    ],
    { cwd: root },
  );
  const requestPath = path.join(root, requested.json.artifacts[0].path);
  const complete = await executeAndRecord(
    root,
    world,
    CONSUMER_FILE,
    requested.json,
  );
  const inventory = readJson(
    root,
    ".artifacts/figma-sync/raw-1/inventory-consumer.json",
  );
  assert.equal(complete.record.json.status, "recorded");
  // MCP content envelope、混合文字、深層包裝都不猜
  assertFailure(
    recordResult(requestPath, {
      content: [{ type: "text", text: JSON.stringify(inventory) }],
    }),
    /ARTIFACT_INVALID/,
  );
  const mixed = path.join(root, ".artifacts/figma-sync/mixed.json");
  writeFileSync(mixed, `結果如下:\n${JSON.stringify(inventory)}`);
  assertFailure(
    runCli(["record", "--request", requestPath, "--result", mixed], {
      cwd: root,
    }),
    /RESULT_UNREADABLE/,
  );
  assertFailure(
    recordResult(requestPath, { result: inventory }),
    /ARTIFACT_INVALID/,
  );
  // kind、run、專案來源、檔案都要相符
  assertFailure(
    recordResult(requestPath, readJson(root, requested.json.artifacts[0].path)),
    /RESULT_KIND_MISMATCH/,
  );
  assertFailure(
    recordResult(requestPath, { ...inventory, runId: "other" }),
    /RESULT_SOURCE_MISMATCH/,
  );
  assertFailure(
    recordResult(requestPath, {
      ...inventory,
      tool: { ...inventory.tool, gitCommit: "c".repeat(40) },
    }),
    /RESULT_SOURCE_MISMATCH/,
  );
  assertFailure(
    recordResult(requestPath, { ...inventory, observedFileKey: BASE_FILE }),
    /FILE_KEY_MISMATCH/,
  );
  // request 必須是它自己 run 目錄裡的固定檔名
  const moved = path.join(root, ".artifacts/figma-sync/request-copy.json");
  cpSync(requestPath, moved);
  assertFailure(
    runCli(
      ["record", "--request", moved, "--result", saveReturned(root, inventory)],
      {
        cwd: root,
      },
    ),
    /ARTIFACT_LOCATION_INVALID/,
  );
});

test("失敗不改前次 receipt:attempt 先封存再 exit 1(fileKey 不可讀、驗證失敗、缺 after)", async () => {
  addInstance("10:20");
  const scanned = await rescan();
  const before = receiptBytes();
  const args = planArgs({ ...paths, consumer: scanned });

  // 執行端讀不到 fileKey:runtime 回 failed、零寫入;仍封存但不作成功證據
  world.resetLog();
  const unreadable = await cliSync(root, world, CONSUMER_FILE, args, {
    figma: { fileKey: null },
  });
  assert.equal(unreadable.planned.json.counts.actions, 4);
  assertFailure(
    unreadable.record,
    /^figma-sync: ATTEMPT_NOT_APPLIED:failed\n$/,
  );
  assert.equal(world.mutations.length, 0);
  const failedRun = unreadable.planned.json.runId;
  assert.ok(runFiles(root, failedRun).top.includes("attempt.json"));
  assert.ok(!runFiles(root, failedRun).top.includes("inventory-after.json"));
  assert.equal(
    readJson(root, `.artifacts/figma-sync/${failedRun}/attempt.json`)
      .observedFileKey,
    null,
  );
  assert.deepEqual(receiptBytes(), before);

  // 寫入期間有人動了別的節點:runtime 回 applied,但 after 與 before 的 protected 欄位不符
  world.afterWrite = (entry) => {
    if (entry.type === "scene" && world.writes.scene === 4) {
      consumer.nodes.errorButton.children[0].characters = "寫入期間被改";
    }
  };
  const drifted = await cliSync(root, world, CONSUMER_FILE, args);
  world.afterWrite = null;
  assertFailure(
    drifted.record,
    /^figma-sync: VERIFICATION_FAILED:PROTECTED_CHANGED\n$/,
  );
  const driftRun = drifted.planned.json.runId;
  assert.ok(runFiles(root, driftRun).top.includes("attempt.json"));
  assert.ok(runFiles(root, driftRun).top.includes("inventory-after.json"));
  assert.deepEqual(receiptBytes(), before);
  consumer.nodes.errorButton.children[0].characters = "Delete";

  // applied 卻沒有完整 afterInventory、或 after 來自別輪 run:都不成立
  const raw = readJson(
    root,
    `.artifacts/figma-sync/${driftRun}/runtime-result.json`,
  );
  const requestPath = drifted.requestPath;
  assertFailure(
    recordResult(requestPath, { ...raw, afterInventory: null }),
    /RESULT_CHANGED/,
  );
  const spliced = JSON.parse(JSON.stringify(raw));
  spliced.afterInventory.runId = "another-run";
  assertFailure(recordResult(requestPath, spliced), /ARTIFACT_INVALID/);
  assertFailure(
    recordResult(requestPath, {
      ...raw,
      afterInventoryDigest: hashArtifact("x"),
    }),
    /RESULT_SOURCE_MISMATCH/,
  );
  assert.deepEqual(receiptBytes(), before);
});

test("沒有 receipt 的既有補套:plan 只列保留;以 explicit adopt-source resolutions 才收管", async () => {
  // 上一個測試已把 10:20 的 4 個 slot 寫成專案 key,但沒有成功狀態
  const scanned = await rescan();
  const blocked = runCli(planArgs({ ...paths, consumer: scanned }), {
    cwd: root,
  });
  assert.equal(blocked.json.status, "noop");
  const plan = readJson(root, blocked.json.artifacts[0].path);
  const unowned = plan.preserved.filter(
    (item) => item.reason === "project-brand-binding-unowned",
  );
  assert.equal(unowned.length, 4);
  assert.equal(plan.managedSlots.length, 15);
  const inventory = readJson(root, scanned);
  const roleOf = {
    "fill-color": "main",
    "stroke-color": "dark",
    "effect-style": "primary-shadow",
  };
  const resolutions = unowned.map((item) => {
    const slot = inventory.slots.find(
      (candidate) =>
        candidate.locator.nodeId === item.locator.nodeId &&
        candidate.locator.field === item.locator.field,
    );
    const isLabel = slot.locator.nodeId !== "10:20";
    return {
      locator: slot.locator,
      consumerInventoryDigest: hashArtifact(inventory),
      before: slot.value,
      sourceMatchDigest: hashArtifact(slot.sourceMatch),
      decision: "adopt-source",
      expectedRole: isLabel ? "contrast" : roleOf[slot.locator.field],
    };
  });
  const { selectionsFor, cliReview } = await import("./test-support.mjs");
  const review = cliReview(
    root,
    { ...paths, consumer: scanned },
    [],
    resolutions,
  );
  assert.equal(review.status, 0, review.stderr);
  assert.deepEqual(review.json.counts, {
    selections: 13,
    carriedSelections: 13,
    resolutions: 4,
  });
  assert.ok(selectionsFor);
  world.resetLog();
  const adopted = await cliSync(
    root,
    world,
    CONSUMER_FILE,
    planArgs({
      ...paths,
      consumer: scanned,
      review: review.json.artifacts[0].path,
    }),
  );
  assert.equal(adopted.planned.json.status, "noop");
  assert.equal(adopted.planned.json.counts.managedSlots, 19);
  assert.equal(adopted.record.json.status, "verified");
  assert.equal(world.count("scene"), 0);
  assert.equal(receipt().managedSlots.length, 19);
});

test("中斷恢復:--resume 以原 plan + 新掃描產生新 run,保留原 attempt", async () => {
  addInstance("10:21");
  const scanned = await rescan();
  world.resetLog();
  world.failAfter = { scene: 2 };
  const interrupted = await cliSync(
    root,
    world,
    CONSUMER_FILE,
    planArgs({ ...paths, consumer: scanned }),
  );
  world.failAfter = {};
  assert.equal(interrupted.planned.json.counts.actions, 4);
  assertFailure(
    interrupted.record,
    /^figma-sync: ATTEMPT_NOT_APPLIED:interrupted\n$/,
  );
  const oldRun = interrupted.planned.json.runId;
  const oldAttempt = readFileSync(
    path.join(root, `.artifacts/figma-sync/${oldRun}/attempt.json`),
  );
  // 傳輸的 head 已保存真 trace;恢復不會重跑原 execute.js
  assert.equal(interrupted.envelopes[0].attemptHead.completedActions.length, 2);

  const again = await rescan();
  world.resetLog();
  const resumed = await cliSync(
    root,
    world,
    CONSUMER_FILE,
    planArgs({ ...paths, consumer: again }, ["--resume", interrupted.planPath]),
  );
  assert.notEqual(resumed.planned.json.runId, oldRun);
  assert.equal(resumed.planned.json.counts.actions, 2);
  assert.equal(resumed.record.status, 0, resumed.record.stderr);
  assert.equal(resumed.record.json.counts.applied, 2);
  assert.equal(resumed.record.json.counts.recoveredAlreadyApplied, 2);
  assert.equal(world.count("scene"), 2);
  assert.deepEqual(runFiles(root, resumed.planned.json.runId).inputs, [
    "identity-review.json",
    "inventory-base-library.json",
    "inventory-brand-library.json",
    "inventory-consumer.json",
    "previous-receipt.json",
    "resume-attempt.json",
    "resume-plan.json",
  ]);
  const plan = readJson(root, resumed.planPath);
  assert.equal(
    plan.inputDigests.plan,
    hashArtifact(readJson(root, interrupted.planPath)),
  );
  assert.deepEqual(
    readFileSync(
      path.join(root, `.artifacts/figma-sync/${oldRun}/attempt.json`),
    ),
    oldAttempt,
  );
});

test("receipt 已被後續 run 更新或正被鎖定:舊結果不覆蓋、不回退", async () => {
  addInstance("10:22");
  const scanned = await rescan();
  const args = planArgs({ ...paths, consumer: scanned });
  const plan = () => runCli(args, { cwd: root });
  const apply = (planned) =>
    runCli(["apply", "--plan", planned.json.artifacts[0].path], { cwd: root });
  const [a, b] = [plan(), plan()];
  const [appliedA, appliedB] = [apply(a), apply(b)];
  assert.equal(appliedB.status, 0, appliedB.stderr);
  // 鎖還在時(另一個 writer 進行中或中斷留下):RECEIPT_BUSY,attempt 已封存
  const lock = `${receiptFile}.lock`;
  writeFileSync(lock, "held");
  const busy = await executeAndRecord(
    root,
    world,
    CONSUMER_FILE,
    appliedA.json,
  );
  assertFailure(busy.record, /^figma-sync: RECEIPT_BUSY\n$/);
  assert.equal(readFileSync(lock, "utf8"), "held");
  const stale = receiptBytes();
  // 操作者確認後移除鎖,以同一批已封存的傳輸包冪等 record
  rmSync(lock);
  let finished;
  for (const envelope of busy.envelopes) {
    finished = runCli(
      [
        "record",
        "--request",
        busy.requestPath,
        "--transport-result",
        saveReturned(root, envelope),
      ],
      { cwd: root },
    );
  }
  assert.equal(finished.json.status, "verified");
  assert.notDeepEqual(receiptBytes(), stale);
  const current = receiptBytes();
  // B 的執行只會看到 already-applied;它的成功結果建立在已過期的 previous 上
  const second = await executeAndRecord(
    root,
    world,
    CONSUMER_FILE,
    appliedB.json,
  );
  assertFailure(second.record, /^figma-sync: RECEIPT_CHANGED\n$/);
  assert.deepEqual(receiptBytes(), current);
  assert.equal(existsSync(lock), false);
  // 過期的 plan 也不能再 apply:它規劃時的 previous 已不是磁碟現值
  assertFailure(apply(b), /^figma-sync: RECEIPT_CHANGED\n$/);
});

test("apply 的回傳完全遺失:不重跑 apply、不捏造 attempt,沿原 plan + 新掃描恢復", async () => {
  addInstance("10:23");
  const scanned = await rescan();
  const planned = runCli(planArgs({ ...paths, consumer: scanned }), {
    cwd: root,
  });
  const planPath = planned.json.artifacts[0].path;
  const applied = runCli(["apply", "--plan", planPath], { cwd: root });
  // 生成碼執行了(4 筆已寫入),但 head 沒有被保存下來
  world.resetLog();
  await executeSource(
    readFileSync(path.join(root, applied.json.artifacts[1].path), "utf8"),
    createFakeFigma(world, CONSUMER_FILE),
  );
  assert.equal(world.count("scene"), 4);
  const oldRun = planned.json.runId;
  assert.ok(!runFiles(root, oldRun).top.includes("attempt.json"));
  assert.deepEqual(runFiles(root, oldRun).transport, []);
  const before = receiptBytes();

  const again = await rescan();
  world.resetLog();
  const resumed = await cliSync(
    root,
    world,
    CONSUMER_FILE,
    planArgs({ ...paths, consumer: again }, ["--resume", planPath]),
  );
  // 每筆都等於 expectedAfter 且 guards 有效:認回已套用,不再寫
  assert.equal(resumed.planned.json.status, "noop");
  assert.equal(resumed.record.status, 0, resumed.record.stderr);
  assert.equal(resumed.record.json.counts.recoveredAlreadyApplied, 4);
  assert.equal(world.count("scene"), 0);
  const inputs = runFiles(root, resumed.planned.json.runId).inputs;
  assert.ok(inputs.includes("resume-plan.json"));
  assert.ok(!inputs.includes("resume-attempt.json"));
  assert.notDeepEqual(receiptBytes(), before);
  // 原 run 沒有被補寫任何 attempt
  assert.ok(!runFiles(root, oldRun).top.includes("attempt.json"));
});

test("在別的檔案執行了 scan:傳輸包只封存為診斷,record 失敗且不產生 inventory", async () => {
  const requested = runCli(
    [
      "scan",
      "--kind",
      "consumer",
      "--file-key",
      CONSUMER_FILE,
      "--roots",
      "10:1",
      "--run-id",
      "wrong-file-1",
    ],
    { cwd: root },
  );
  const run = await executeAndRecord(
    root,
    world,
    CONSUMER_FILE,
    requested.json,
    {
      figma: { fileKey: BASE_FILE },
    },
  );
  assert.equal(run.envelopes[0].observedFileKey, BASE_FILE);
  assertFailure(run.record, /^figma-sync: TRANSPORT_FILE_KEY_MISMATCH\n$/);
  const files = runFiles(root, "wrong-file-1");
  assert.deepEqual(files.transport, ["error-000000.json"]);
  assert.deepEqual(files.top, [
    "request-consumer-scan.json",
    "scan-consumer.js",
  ]);
  // 回到正確的檔案重新執行同一支 JS,可正常完成
  const again = await executeAndRecord(
    root,
    world,
    CONSUMER_FILE,
    requested.json,
  );
  assert.equal(again.record.status, 0, again.record.stderr);
  assert.equal(again.record.json.status, "recorded");
});
