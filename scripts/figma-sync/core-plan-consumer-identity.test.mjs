import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONSUMER_FILE,
  buildBaseLibrary,
  createScenario,
  instantiate,
  scan,
} from "./test-support.mjs";

test("局部審查保留其他來源的對應,回到先前範圍仍可零修改驗證", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("identity-first", { roots: ["10:2"] });
  assert.equal(first.verdict.status, "verified");
  const prior = first.verdict.receipt;
  const selections = scenario
    .review()
    .selections.filter(
      (item) => item.source.key === scenario.base.color.main.key,
    );
  const review = scenario.review(null, [], { selections });
  review.reviewEvidenceURL = "https://github.com/acme/widgets/issues/2";
  const next = await scenario.sync("identity-partial", {
    roots: ["10:7"],
    identityReview: review,
    previousReceipt: prior,
  });
  assert.equal(next.verdict.status, "verified");
  const receipt = next.verdict.receipt;
  assert.equal(receipt.identityMap.length, prior.identityMap.length);
  for (const entry of prior.identityMap) {
    const actual = receipt.identityMap.find(
      (item) => item.source.key === entry.source.key,
    );
    assert.deepEqual(actual, {
      ...entry,
      reviewEvidenceURL:
        entry.source.key === selections[0].source.key
          ? review.reviewEvidenceURL
          : entry.reviewEvidenceURL,
    });
  }
  for (const slot of prior.managedSlots) {
    assert.deepEqual(
      receipt.managedSlots.find(
        (item) =>
          item.locator.nodeId === slot.locator.nodeId &&
          item.locator.field === slot.locator.field,
      ),
      slot,
    );
  }
  const carried = receipt.identityMap.map(
    ({ role, assetKind, source, project }) => ({
      role,
      assetKind,
      source,
      project,
    }),
  );
  const last = await scenario.sync("identity-return", {
    roots: ["10:2"],
    identityReview: scenario.review(null, [], { selections: carried }),
    previousReceipt: receipt,
  });
  assert.equal(last.verdict.status, "verified");
  assert.equal(last.verdict.receipt.changes.applied, 0);
  assert.equal(last.verdict.receipt.changes.importedAssets, 0);
  assert.equal(
    last.verdict.receipt.identityMap.length,
    prior.identityMap.length,
  );
});

test("累積對應不取代本輪審查:受管範圍缺少必要選擇仍阻擋", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("identity-owned", { roots: ["10:2"] });
  const selections = scenario
    .review()
    .selections.filter(
      (item) => item.source.key === scenario.base.color.main.key,
    );
  const next = await scenario.sync("identity-unreviewed", {
    roots: ["10:2"],
    identityReview: scenario.review(null, [], { selections }),
    previousReceipt: first.verdict.receipt,
  });
  assert.equal(next.plan.status, "blocked");
  assert.equal(next.attempt, null);
  assert.equal(next.verdict, null);
});

test("同一 consumer 輪流同步兩個 Library,保留雙方的精確對照與 scope 外受管紀錄", async () => {
  const scenario = await createScenario();
  const initialBase = scenario.inventories.base;
  const first = await scenario.sync("first-library", { roots: ["10:2"] });
  assert.equal(first.verdict.status, "verified");
  const other = buildBaseLibrary(scenario.world, "OTHERbase01");
  scenario.consumer.control.append(
    instantiate(scenario.world, CONSUMER_FILE, other.components.button, "20:3"),
  );
  scenario.inventories.base = await scan(
    scenario.world,
    "base-library",
    other.fileKey,
    [other.page.id],
    "other-base-scan",
  );
  const second = await scenario.sync("other-library", {
    roots: ["20:3"],
    previousReceipt: first.verdict.receipt,
  });
  assert.equal(second.verdict.status, "verified");
  const receipt = second.verdict.receipt;
  assert.equal(receipt.identityMap.length, 26);
  for (const entry of first.verdict.receipt.identityMap) {
    assert.deepEqual(
      receipt.identityMap.find((item) => item.source.key === entry.source.key),
      entry,
    );
  }
  scenario.inventories.base = initialBase;
  const carried = receipt.identityMap
    .filter((item) => item.source.fileKey === initialBase.observedFileKey)
    .map(({ role, assetKind, source, project }) => ({
      role,
      assetKind,
      source,
      project,
    }));
  const last = await scenario.sync("return-first-library", {
    roots: ["10:2"],
    identityReview: scenario.review(null, [], { selections: carried }),
    previousReceipt: receipt,
  });
  assert.equal(last.verdict.status, "verified");
  assert.equal(last.verdict.receipt.identityMap.length, 26);
  assert.equal(last.verdict.receipt.changes.applied, 0);
  assert.deepEqual(
    last.verdict.receipt.managedSlots.filter(
      (slot) => slot.locator.rootInstanceId === "20:3",
    ),
    receipt.managedSlots.filter(
      (slot) => slot.locator.rootInstanceId === "20:3",
    ),
  );
});
