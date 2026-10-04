import assert from "node:assert/strict";
import { test } from "node:test";

import { hashArtifact } from "./artifacts.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  contract,
  core,
  createScenario,
  createWorld,
  makeHeader,
  planBrandRun,
  selectionsFor,
} from "./test-support.mjs";

const code = (expected) => (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.equal(error.code, expected, error.message);
  return true;
};
const clone = (value) => structuredClone(value);
const scenario = await createScenario();
const consumerInventory = await scenario.scanConsumer("contract-scan");

const synced = await scenario.sync("records-1");

test("managedSlots / releasedSlots 必帶 scopeEvidence;plan 與 receipt 同型", () => {
  const invalid = code("ARTIFACT_INVALID");
  const { plan, verdict } = synced;
  const receipt = verdict.receipt;
  assert.equal(contract.validateArtifact(receipt), receipt);
  for (const slot of receipt.managedSlots) {
    assert.deepEqual(Object.keys(slot.scopeEvidence), [
      "pageId",
      "scopeRootId",
      "ancestorIds",
    ]);
  }
  for (const artifact of [plan, receipt]) {
    const missing = clone(artifact);
    delete missing.managedSlots[0].scopeEvidence;
    assert.throws(() => contract.validateArtifact(missing), invalid);
    const partial = clone(artifact);
    delete partial.managedSlots[0].scopeEvidence.ancestorIds;
    assert.throws(() => contract.validateArtifact(partial), invalid);
    const released = clone(artifact);
    released.releasedSlots.push({
      locator: released.managedSlots[0].locator,
      previousReceiptDigest: null,
      resolutionEvidenceURL: "https://github.com/acme/widgets/issues/1",
      reason: "preserve-project",
      reviewedValue: { kind: "fixed" },
      sourceMatchDigest: null,
      releasedRunId: "r",
    });
    assert.throws(() => contract.validateArtifact(released), invalid);
  }
});

test("plan 的 verification 欄位:evidence、projection digest 與恢復筆數都是協定的一部分", () => {
  const { plan } = synced;
  assert.deepEqual(Object.keys(plan.verification), [
    "target",
    "expectedRoleValues",
    "expectedPrimaryEffect",
    "protectedBefore",
    "outsideScopeControls",
    "brandProjectionDigest",
    "publicationEvidence",
    "acceptanceEvidence",
    "recoveredAlreadyApplied",
  ]);
  const invalid = code("ARTIFACT_INVALID");
  for (const change of [
    (copy) => delete copy.releasedSlots,
    (copy) => delete copy.verification.brandProjectionDigest,
    (copy) => (copy.verification.recoveredAlreadyApplied = -1),
    (copy) => (copy.verification.target = "full-sync"),
    (copy) => (copy.verification.protectedBefore.digest = "x"),
    (copy) => (copy.verification.publicationEvidence = { label: "v1" }),
  ]) {
    const copy = clone(plan);
    change(copy);
    assert.throws(() => contract.validateArtifact(copy), invalid);
  }
});

test("receipt:只能是 verified、不含其他檔案的項目、沒有未驗證的受管項目", () => {
  const invalid = code("ARTIFACT_INVALID");
  const receipt = synced.verdict.receipt;
  for (const change of [
    (copy) => (copy.status = "failed"),
    (copy) => (copy.managedSlots[0].locator.fileKey = BASE_FILE),
    (copy) => (copy.lastRunScope.fileKey = BASE_FILE),
    (copy) => (copy.managedSlots[0].lastVerifiedRunId = null),
    (copy) => (copy.managedSlots[0].verifiedValue = null),
    (copy) => (copy.managedSlots[0].sourceMatchStatus = "unresolved"),
    (copy) => (copy.verification.errors = null),
    (copy) => (copy.success = true),
  ]) {
    const copy = clone(receipt);
    change(copy);
    assert.throws(() => contract.validateArtifact(copy), invalid);
  }
  // direct-binding 是合法的受管狀態(僅表示當次直接綁定已驗)
  assert.ok(
    receipt.managedSlots.some(
      (slot) => slot.sourceMatchStatus === "direct-binding",
    ),
  );
});

test("attempt:status 與 completedActions 的 result 只接受協定值", () => {
  const invalid = code("ARTIFACT_INVALID");
  for (const change of [
    (copy) => (copy.status = "success"),
    (copy) => (copy.completedActions[0].result = "skipped"),
    (copy) => (copy.planDigest = null),
    (copy) => delete copy.afterInventoryDigest,
    (copy) => (copy.errors = [{ code: "", detail: "" }]),
  ]) {
    const copy = JSON.parse(JSON.stringify(synced.attempt));
    change(copy);
    assert.throws(() => contract.validateArtifact(copy), invalid);
  }
});
