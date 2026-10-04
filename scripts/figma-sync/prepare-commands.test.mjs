import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { hashArtifact } from "./artifacts.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  CONSUMER_FILE,
  RECEIPTS,
  REVIEW_URL,
  bootstrapCli,
  cliReview,
  cliScan,
  cliSync,
  commitAll,
  makeRepoRoot,
  planArgs,
  readJson,
  runCli,
  runFiles,
} from "./test-support.mjs";

// 六命令完整串接:全程不手編任何 artifact,生成碼在 fake Figma 真執行,回傳走有界傳輸
const boot = await bootstrapCli();
const { root, world, base, brandPage, paths } = boot;
const state = {};
const receiptOf = (dir, fileKey) =>
  readJson(dir, `${RECEIPTS}/${fileKey}.json`);

test("scan → record:生成 request 與 JS,傳輸包封存後組回 raw 回傳與 inventory", () => {
  assert.equal(
    paths.base,
    ".artifacts/figma-sync/boot-base/inventory-base-library.json",
  );
  assert.deepEqual(runFiles(root, "boot-base"), {
    top: [
      "inventory-base-library.json",
      "request-base-library-scan.json",
      "runtime-result.json",
      "scan-base-library.js",
    ],
    inputs: [],
    transport: ["chunk-000000.json", "head.json"],
  });
  const inventory = readJson(root, paths.base);
  const request = readJson(
    root,
    ".artifacts/figma-sync/boot-base/request-base-library-scan.json",
  );
  assert.equal(inventory.runId, "boot-base");
  assert.equal(inventory.project.repository, "acme/widgets");
  assert.deepEqual(inventory.project, request.project);
  assert.match(inventory.project.gitCommit, /^[0-9a-f]{40}$/);
  assert.equal(inventory.project.dirty, false);
  assert.equal(request.operation, "scan");
  assert.equal(request.inputDigests.plan, null);
  // raw 回傳與封存的 inventory 內容相同;傳輸 head 記的就是它的完整 digest
  const raw = readJson(
    root,
    ".artifacts/figma-sync/boot-base/runtime-result.json",
  );
  const head = readJson(
    root,
    ".artifacts/figma-sync/boot-base/transport/scan/head.json",
  );
  assert.equal(hashArtifact(raw), hashArtifact(inventory));
  assert.equal(head.artifactDigest, hashArtifact(inventory));
  assert.equal(head.requestDigest, hashArtifact(request));
});

test("plan-brand → apply → record:初次 plan 不需要不存在的 plan digest;空品牌庫初建後才有 receipt", () => {
  const run = boot.brandRun;
  assert.equal(run.planned.json.status, "ready");
  assert.equal(run.planned.json.counts.actions, 28);
  assert.match(run.planned.json.runId, /^plan-brand-\d{8}T\d{6}Z-[0-9a-f]{8}$/);
  const plan = readJson(root, run.planPath);
  // 規劃時沒有 plan digest;apply 的 request 才補上本 plan 的 digest
  assert.equal(plan.inputDigests.plan, null);
  const request = readJson(root, run.applied.json.artifacts[0].path);
  assert.equal(request.inputDigests.plan, hashArtifact(plan));
  assert.equal(run.applied.json.status, "apply-requested");
  assert.equal(run.record.json.status, "verified");
  assert.deepEqual(
    run.record.json.artifacts.map((item) => item.kind),
    ["attempt", "inventory", "attempt", "receipt"],
  );
  assert.equal(
    run.record.json.artifacts.at(-1).path,
    `${RECEIPTS}/${BRAND_FILE}.json`,
  );
  assert.deepEqual(run.record.json.counts, {
    planned: 28,
    applied: 28,
    recoveredAlreadyApplied: 0,
    createdAssets: 15,
    importedAssets: 0,
    managedSlots: 0,
    releasedSlots: 0,
    managedAssets: 15,
  });
  const receipt = receiptOf(root, BRAND_FILE);
  assert.equal(receipt.previousReceiptDigest, null);
  const files = runFiles(root, receipt.runId);
  assert.deepEqual(files.top, [
    "attempt.json",
    "execute.js",
    "inventory-after.json",
    "plan.json",
    "request-apply.json",
    "runtime-result.json",
  ]);
  assert.deepEqual(files.inputs, ["inventory-brand-library.json"]);
  assert.ok(files.transport.includes("head.json"));
  // apply 的生成碼只執行一次;其餘呼叫都是唯讀取塊
  assert.equal(run.envelopes[0].type, "head");
  assert.equal(run.envelopes[0].attemptHead.completedActions.length, 28);
  assert.ok(
    run.envelopes.slice(1).every((envelope) => envelope.type === "chunk"),
  );
});

test("review → plan → apply → record:consumer 補套,累積 receipt 落地", async () => {
  assert.deepEqual(boot.review.json.counts, {
    selections: 13,
    carriedSelections: 0,
    resolutions: 0,
  });
  assert.deepEqual(runFiles(root, boot.review.json.runId), {
    top: ["identity-review.json"],
    inputs: ["inventory-base-library.json", "inventory-brand-library.json"],
    transport: [],
  });
  const run = await cliSync(root, world, CONSUMER_FILE, planArgs(paths));
  assert.equal(run.planned.json.status, "ready");
  assert.equal(run.planned.json.counts.actions, 15);
  assert.equal(run.record.status, 0, run.record.stderr);
  assert.equal(run.record.json.status, "verified");
  assert.equal(run.record.json.counts.applied, 15);
  assert.equal(run.record.json.counts.managedSlots, 15);
  assert.equal(world.count("scene"), 15);
  state.firstRun = run;
  const runId = run.planned.json.runId;
  assert.deepEqual(runFiles(root, runId).inputs, [
    "identity-review.json",
    "inventory-base-library.json",
    "inventory-brand-library.json",
    "inventory-consumer.json",
  ]);
  // 輸入 snapshot 原樣保存:digest 與原 artifact 相同,runId / generatedAt 未改寫
  const dir = `.artifacts/figma-sync/${runId}`;
  const snapshot = readJson(root, `${dir}/inputs/inventory-consumer.json`);
  assert.equal(
    hashArtifact(snapshot),
    hashArtifact(readJson(root, paths.consumer)),
  );
  assert.equal(snapshot.runId, "boot-con");
  const plan = readJson(root, run.planPath);
  assert.equal(plan.inputDigests.inventories[2], hashArtifact(snapshot));
  // raw 回傳與封存 attempt 可分別核對:只有後者帶 afterInventoryDigest
  const raw = readJson(root, `${dir}/runtime-result.json`);
  const attempt = readJson(root, `${dir}/attempt.json`);
  const after = readJson(root, `${dir}/inventory-after.json`);
  assert.equal(raw.afterInventoryDigest, null);
  assert.equal(attempt.afterInventoryDigest, hashArtifact(after));
  assert.equal(
    hashArtifact({ ...attempt, afterInventoryDigest: null }),
    hashArtifact(raw),
  );
  const head = readJson(root, `${dir}/transport/apply/head.json`);
  assert.equal(head.artifactDigest, hashArtifact(raw));
  const receipt = receiptOf(root, CONSUMER_FILE);
  assert.equal(receipt.planDigest, hashArtifact(plan));
  assert.equal(receipt.afterDigest, hashArtifact(after));
  assert.equal(
    receipt.identityReviewDigest,
    hashArtifact(readJson(root, paths.review)),
  );
  assert.ok(
    receipt.managedSlots.every(
      (slot) => slot.scopeEvidence.scopeRootId === "10:1",
    ),
  );
  // 持久檔不存場景文案
  const text = readFileSync(
    path.join(root, RECEIPTS, `${CONSUMER_FILE}.json`),
    "utf8",
  );
  assert.ok(!text.includes("自訂文字"));
});

test("同狀態重跑:plan 自動讀本 repo 的 receipt → noop,仍經完整先驗與驗證後累積", async () => {
  state.consumer = await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    ["10:1"],
    "s-con-2",
  );
  const previous = receiptOf(root, CONSUMER_FILE);
  world.resetLog();
  const run = await cliSync(
    root,
    world,
    CONSUMER_FILE,
    planArgs({ ...paths, consumer: state.consumer }),
  );
  assert.equal(run.planned.json.status, "noop");
  assert.equal(run.planned.json.counts.actions, 0);
  assert.equal(run.planned.json.counts.managedSlots, 15);
  assert.equal(run.record.json.status, "verified");
  assert.equal(world.mutations.length, 0);
  assert.ok(
    runFiles(root, run.planned.json.runId).inputs.includes(
      "previous-receipt.json",
    ),
  );
  const receipt = receiptOf(root, CONSUMER_FILE);
  assert.equal(receipt.previousReceiptDigest, hashArtifact(previous));
  assert.ok(
    receipt.managedSlots.every(
      (slot) =>
        slot.firstManagedRunId === previous.runId &&
        slot.lastVerifiedRunId === receipt.runId,
    ),
  );
});

test("partial scope:只更新該範圍,scope 外登記原樣保留", async () => {
  const before = receiptOf(root, CONSUMER_FILE);
  const partial = await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    ["10:2"],
    "s-con-3",
  );
  const run = await cliSync(
    root,
    world,
    CONSUMER_FILE,
    planArgs({ ...paths, consumer: partial }),
  );
  assert.equal(run.planned.json.status, "noop");
  assert.equal(run.record.json.status, "verified");
  const receipt = receiptOf(root, CONSUMER_FILE);
  assert.deepEqual(receipt.lastRunScope.rootNodeIds, ["10:2"]);
  assert.equal(receipt.managedSlots.length, before.managedSlots.length);
  const verifiedNow = receipt.managedSlots.filter(
    (slot) => slot.lastVerifiedRunId === receipt.runId,
  );
  assert.equal(verifiedNow.length, 4);
  assert.ok(
    verifiedNow.every((slot) => slot.locator.rootInstanceId === "10:2"),
  );
  assert.ok(
    receipt.managedSlots
      .filter((slot) => slot.locator.rootInstanceId !== "10:2")
      .every((slot) => slot.lastVerifiedRunId === before.runId),
  );
});

test("新 clone 只靠 committed receipt 續跑,不需要原機器的暫存或重抄 selections", async () => {
  commitAll(root, "figma receipts");
  const clone = mkdtempSync(path.join(tmpdir(), "figma-sync-clone-"));
  const cloned = spawnSync("git", ["clone", "--quiet", root, clone], {
    encoding: "utf8",
  });
  assert.equal(cloned.status, 0, cloned.stderr);
  assert.equal(existsSync(path.join(clone, ".artifacts")), false);
  assert.deepEqual(readdirSync(path.join(clone, RECEIPTS)).sort(), [
    `${BRAND_FILE}.json`,
    `${CONSUMER_FILE}.json`,
  ]);
  const local = {
    base: await cliScan(
      clone,
      world,
      "base-library",
      BASE_FILE,
      [base.page.id],
      "c-base",
    ),
    brand: await cliScan(
      clone,
      world,
      "brand-library",
      BRAND_FILE,
      [brandPage.id],
      "c-brand",
    ),
    consumer: await cliScan(
      clone,
      world,
      "consumer",
      CONSUMER_FILE,
      ["10:1"],
      "c-con",
    ),
  };
  // 已驗的身分對照由 receipt 生成本次 review 輸入;沒有新 key 就不必再明示
  const reviewArgs = [
    "review",
    "--base",
    local.base,
    "--brand",
    local.brand,
    "--consumer",
    local.consumer,
    "--selections-json",
    "[]",
    "--review-evidence-url",
    REVIEW_URL,
  ];
  const review = runCli(reviewArgs, { cwd: clone });
  assert.equal(review.status, 0, review.stderr);
  assert.deepEqual(review.json.counts, {
    selections: 13,
    carriedSelections: 13,
    resolutions: 0,
  });
  local.review = review.json.artifacts[0].path;
  world.resetLog();
  const brandRun = await cliSync(clone, world, BRAND_FILE, [
    "plan-brand",
    "--brand",
    local.brand,
  ]);
  assert.equal(brandRun.planned.json.status, "noop");
  assert.equal(brandRun.record.json.status, "verified");
  const run = await cliSync(clone, world, CONSUMER_FILE, planArgs(local));
  assert.equal(run.planned.json.status, "noop");
  assert.equal(run.record.json.status, "verified");
  assert.equal(world.mutations.length, 0);
  assert.equal(
    receiptOf(clone, CONSUMER_FILE).previousReceiptDigest,
    hashArtifact(receiptOf(root, CONSUMER_FILE)),
  );
  // 沒有 receipt 也沒有明示選擇時不會自動接受任何 key
  rmSync(path.join(clone, RECEIPTS, `${CONSUMER_FILE}.json`));
  const empty = runCli(reviewArgs, { cwd: clone });
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /^figma-sync: SELECTIONS_EMPTY\n$/);
});

test("跨 repo:隨底座複製而來、repository 不符的 receipt 不被認養", async () => {
  const other = makeRepoRoot("other/project");
  cpSync(path.join(root, RECEIPTS), path.join(other, RECEIPTS), {
    recursive: true,
  });
  const local = {
    base: await cliScan(
      other,
      world,
      "base-library",
      BASE_FILE,
      [base.page.id],
      "o-base",
    ),
    brand: await cliScan(
      other,
      world,
      "brand-library",
      BRAND_FILE,
      [brandPage.id],
      "o-brand",
    ),
    consumer: await cliScan(
      other,
      world,
      "consumer",
      CONSUMER_FILE,
      ["10:1"],
      "o-con",
    ),
  };
  const brandPlan = runCli(["plan-brand", "--brand", local.brand], {
    cwd: other,
  });
  assert.equal(brandPlan.status, 1);
  assert.equal(brandPlan.stdout, "");
  assert.match(brandPlan.stderr, /^figma-sync: RECEIPT_FOREIGN\n$/);
  const { selectionsFor } = await import("./test-support.mjs");
  const selections = selectionsFor(
    readJson(other, local.base),
    readJson(other, local.brand),
  );
  const review = cliReview(other, local, selections);
  assert.equal(review.status, 0, review.stderr);
  local.review = review.json.artifacts[0].path;
  assert.match(
    runCli(planArgs(local), { cwd: other }).stderr,
    /^figma-sync: RECEIPT_FOREIGN\n$/,
  );
  // 別的專案的 artifact 也不能拿來當輸入
  const foreignInput = runCli(
    ["plan-brand", "--brand", path.join(root, paths.brand)],
    {
      cwd: other,
    },
  );
  assert.match(foreignInput.stderr, /^figma-sync: PROJECT_MISMATCH\n$/);
  // 拿掉不屬於本專案的 receipt 後,從自己的掃描重新開始;沒有 receipt 的專案 key 不會被自動收管
  rmSync(path.join(other, RECEIPTS), { recursive: true });
  const fresh = runCli(planArgs(local), { cwd: other });
  assert.equal(fresh.status, 0, fresh.stderr);
  const plan = readJson(other, fresh.json.artifacts[0].path);
  assert.equal(plan.inputDigests.previousReceipt, null);
  assert.deepEqual(plan.managedSlots, []);
  assert.ok(
    plan.preserved.some(
      (item) => item.reason === "project-brand-binding-unowned",
    ),
  );
});
