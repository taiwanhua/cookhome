import assert from "node:assert/strict";
import { cpSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { hashArtifact } from "./artifacts.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  CONSUMER_FILE,
  RECEIPTS,
  bootstrapCli,
  cliReview,
  cliScan,
  cliSync,
  createWorld,
  instantiate,
  makeRepoRoot,
  planArgs,
  readJson,
  runCli,
} from "./test-support.mjs";

const boot = await bootstrapCli();
const { root, world, base, consumer, paths, selections } = boot;
/** 失敗協定:exit 1、stdout 完全沒有輸出、stderr 恰好一行。 */
function assertFailure(result, pattern) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^figma-sync: [^\n]*\n$/);
  assert.match(result.stderr, pattern);
}

test("plan:verification-target 必填;規劃用 request 沒有 plan digest,blocked 是有效輸出", () => {
  const args = planArgs(paths);
  assertFailure(
    runCli(args.slice(0, -2), { cwd: root }),
    /plan 需要 --verification-target/,
  );
  const planned = runCli(args, { cwd: root });
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(planned.json.status, "ready");
  assert.match(planned.json.runId, /^plan-\d{8}T\d{6}Z-[0-9a-f]{8}$/);
  const plan = readJson(root, planned.json.artifacts[0].path);
  assert.equal(plan.inputDigests.plan, null);
  assert.equal(plan.verification.target, "brand-bindings");
  assert.equal(plan.verification.publicationEvidence, null);
  // 每筆 action 的寫入型別由 field 決定
  for (const action of plan.actions) {
    const style = action.locator.field === "effect-style";
    assert.equal(action.expectedAfter.kind, style ? "style" : "variable");
  }
});

test("blocked plan 是有效分析輸出(exit 0),但 apply 不可用", async () => {
  // 空品牌庫裡已有同名未登記的集合
  const blockedWorld = createWorld();
  const [page] = blockedWorld.addFile(BRAND_FILE, ["Brand"]);
  blockedWorld.addCollection(BRAND_FILE, "Brand", ["Light"]);
  const blockedRoot = makeRepoRoot();
  const brand = await cliScan(
    blockedRoot,
    blockedWorld,
    "brand-library",
    BRAND_FILE,
    [page.id],
    "blk-scan",
  );
  const planned = runCli(["plan-brand", "--brand", brand], {
    cwd: blockedRoot,
  });
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(planned.stderr, "");
  assert.equal(planned.json.status, "blocked");
  assert.deepEqual(planned.json.counts, {
    actions: 0,
    conflicts: 1,
    preserved: 0,
    managedSlots: 0,
    releasedSlots: 0,
    managedAssets: 15,
  });
  const planPath = planned.json.artifacts[0].path;
  assert.equal(
    readJson(blockedRoot, planPath).conflicts[0].code,
    "UNREGISTERED_SAME_NAME",
  );
  assertFailure(
    runCli(["apply", "--plan", planPath], { cwd: blockedRoot }),
    /PLAN_BLOCKED/,
  );
  assert.equal(
    existsSync(path.join(blockedRoot, path.dirname(planPath), "execute.js")),
    false,
  );
  assert.equal(existsSync(path.join(blockedRoot, RECEIPTS)), false);
});

test("apply:重跑得到相同內容;plan 被搬走、被改,或品牌輸入 / 工具 / 專案已變都拒絕", () => {
  const plan = () => runCli(planArgs(paths), { cwd: root });
  const planned = plan();
  const planPath = planned.json.artifacts[0].path;
  const first = runCli(["apply", "--plan", planPath], { cwd: root });
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(
    first.json.artifacts.map((item) => [item.kind, path.basename(item.path)]),
    [
      ["request", "request-apply.json"],
      ["execution-source", "execute.js"],
    ],
  );
  const request = readJson(root, first.json.artifacts[0].path);
  const artifact = readJson(root, planPath);
  assert.equal(request.operation, "apply");
  assert.equal(request.runId, artifact.runId);
  assert.equal(request.generatedAt, artifact.generatedAt);
  assert.equal(request.inputDigests.plan, hashArtifact(artifact));
  // 首次新增後重跑:內容相同、不覆蓋
  assert.deepEqual(
    runCli(["apply", "--plan", planPath], { cwd: root }).json,
    first.json,
  );

  const elsewhere = path.join(root, ".artifacts/figma-sync/plan.json");
  cpSync(path.join(root, planPath), elsewhere);
  assertFailure(
    runCli(["apply", "--plan", elsewhere], { cwd: root }),
    /ARTIFACT_LOCATION_INVALID/,
  );
  // 手改 plan(例如把 RGB 換掉):request 已記下原 digest,生成物不會被覆蓋
  const edited = structuredClone(artifact);
  edited.verification.expectedRoleValues.main.r = 0;
  writeFileSync(path.join(root, planPath), JSON.stringify(edited));
  assertFailure(
    runCli(["apply", "--plan", planPath], { cwd: root }),
    /ARTIFACT_EXISTS/,
  );

  const applyWith = (change) => {
    const other = plan();
    const otherPath = other.json.artifacts[0].path;
    const value = readJson(root, otherPath);
    change(value);
    writeFileSync(path.join(root, otherPath), JSON.stringify(value));
    return runCli(["apply", "--plan", otherPath], { cwd: root });
  };
  const digest = hashArtifact("other");
  assertFailure(
    applyWith((value) => (value.verification.brandProjectionDigest = digest)),
    /^figma-sync: BRAND_INPUT_CHANGED\n$/,
  );
  assertFailure(
    applyWith((value) => (value.tool.sourceDigest = digest)),
    /^figma-sync: TOOL_CHANGED\n$/,
  );
  assertFailure(
    applyWith((value) => (value.project.repository = "other/project")),
    /^figma-sync: PROJECT_MISMATCH\n$/,
  );
});

test("review:selections / resolutions 由 CLI 核對進指定 inventory;過期或不 exact 都拒絕", () => {
  const stale = structuredClone(selections);
  stale[2].project.key = "vk-not-there";
  assertFailure(cliReview(root, paths, stale), /SELECTION_NOT_EXACT/);
  assertFailure(cliReview(root, paths, []), /SELECTIONS_EMPTY/);
  const inventory = readJson(root, paths.consumer);
  const slot = inventory.slots.find((item) => item.locator.nodeId === "10:3");
  const resolution = {
    locator: slot.locator,
    consumerInventoryDigest: hashArtifact(inventory),
    before: slot.value,
    sourceMatchDigest: hashArtifact(slot.sourceMatch),
    decision: "adopt-source",
    expectedRole: "main",
  };
  const reviewed = cliReview(root, paths, selections, [resolution]);
  assert.equal(reviewed.status, 0, reviewed.stderr);
  assert.equal(reviewed.json.counts.resolutions, 1);
  const artifact = readJson(root, reviewed.json.artifacts[0].path);
  assert.equal(artifact.inventoryDigests.consumer, hashArtifact(inventory));
  assertFailure(
    cliReview(root, paths, selections, [
      { ...resolution, sourceMatchDigest: hashArtifact("other") },
    ]),
    /RESOLUTION_STALE/,
  );
  // 手動固定色經明示採來源後,plan 以 variable 綁回
  const planned = runCli(
    planArgs({ ...paths, review: reviewed.json.artifacts[0].path }),
    { cwd: root },
  );
  const plan = readJson(root, planned.json.artifacts[0].path);
  const action = plan.actions.find(
    (item) =>
      item.locator.nodeId === "10:3" && item.locator.field === "fill-color",
  );
  assert.equal(action.before.kind, "fixed");
  assert.equal(action.expectedAfter.kind, "variable");
});

test("library-upgrade:審查後的發布 / 接受證據經 plan 組入 apply request 與 receipt", async () => {
  const partial = await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    ["10:2"],
    "p-con-1",
  );
  const keys = readJson(root, paths.base).publicationOwners.map(
    (owner) => owner.componentKey,
  );
  const publication = {
    baseGitTag: "v1.2.0",
    baseGitCommit: "b".repeat(40),
    sourceFileKey: BASE_FILE,
    label: "v1.2.0",
    versionId: "2406190621933543234",
    versionUrl: "https://www.figma.com/design/x?version-id=2406190621933543234",
    observedAt: "2026-01-02T00:00:00Z",
    changedAssetKeys: keys,
  };
  const acceptance = {
    sourceFileKey: BASE_FILE,
    consumerFileKey: CONSUMER_FILE,
    observedAt: "2026-01-02T01:00:00Z",
    acceptedAssetKeys: [],
    pageIds: [],
    rootNodeIds: ["10:2"],
    scope: "partial",
    evidenceUrl: "https://github.com/acme/widgets/issues/24",
  };
  const args = (accepted) => [
    ...planArgs({ ...paths, consumer: partial }).map((value) =>
      value === "brand-bindings" ? "library-upgrade" : value,
    ),
    "--publication-evidence-json",
    JSON.stringify(publication),
    "--acceptance-evidence-json",
    JSON.stringify({ ...acceptance, acceptedAssetKeys: accepted }),
  ];
  // 本範圍用到的 Button 有變更卻未接受:有效的 blocked 分析,不能冒稱已升級
  const blocked = runCli(args([]), { cwd: root });
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.equal(blocked.json.status, "blocked");
  assert.deepEqual(
    readJson(root, blocked.json.artifacts[0].path).conflicts.map(
      (conflict) => conflict.code,
    ),
    ["PARTIAL_ACCEPTANCE"],
  );
  // 只缺一份證據時是參數錯誤,不會產生任何 plan
  assertFailure(
    runCli(args(keys).slice(0, -2), { cwd: root }),
    /^figma-sync: library-upgrade 需要 /,
  );
  const run = await cliSync(root, world, CONSUMER_FILE, args(keys));
  assert.equal(run.record.status, 0, run.record.stderr);
  const request = readJson(root, run.applied.json.artifacts[0].path);
  assert.deepEqual(request.publicationEvidence, publication);
  assert.deepEqual(request.acceptanceEvidence.acceptedAssetKeys, keys);
  const receipt = readJson(root, `${RECEIPTS}/${CONSUMER_FILE}.json`);
  assert.equal(receipt.verifiedFor, "library-upgrade");
  assert.deepEqual(receipt.publicationEvidence, publication);
  assert.equal(receipt.acceptanceEvidence.scope, "partial");
});

test("更新後新增的實例帶入底座品牌:下一輪只補這幾筆,既有登記不動", async () => {
  consumer.root.append(
    instantiate(world, CONSUMER_FILE, base.components.button, "10:40"),
  );
  const scanned = await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    ["10:2", "10:40"],
    "p-con-2",
  );
  const planned = runCli(planArgs({ ...paths, consumer: scanned }), {
    cwd: root,
  });
  assert.equal(planned.json.status, "ready");
  assert.equal(planned.json.counts.actions, 4);
  assert.equal(planned.json.counts.managedSlots, 8);
  const plan = readJson(root, planned.json.artifacts[0].path);
  assert.ok(
    plan.actions.every((action) => action.locator.rootInstanceId === "10:40"),
  );
});
