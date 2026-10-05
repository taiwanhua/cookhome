import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASE_FILE,
  CONSUMER_FILE,
  RECEIPTS,
  ROLES,
  bootstrapCli,
  bound,
  cliReview,
  cliScan,
  cliSync,
  contract,
  core,
  fixed,
  instantiate,
  makeHeader,
  planArgs,
  readJson,
  runCli,
  selectionsFor,
} from "./test-support.mjs";

const boot = await bootstrapCli();
const { root, world, base, consumer } = boot;
const localBrand = world.addCollection(CONSUMER_FILE, "Brand", ["Light"]);
const localColor = world.addCollection(CONSUMER_FILE, "Color", ["Light"]);
const literal = {};
const aliases = {};
for (const role of ROLES) {
  literal[role] = world.addVariable(
    CONSUMER_FILE,
    `primary/${role}`,
    localBrand,
    {
      [localBrand.defaultModeId]: Object.values(
        base.brand[role].valuesByMode,
      )[0],
    },
  );
  aliases[role] = world.addVariable(
    CONSUMER_FILE,
    `primary/${role}`,
    localColor,
    {
      [localColor.defaultModeId]: {
        type: "VARIABLE_ALIAS",
        id: literal[role].id,
      },
    },
  );
}
const shadow = world.addStyle(
  CONSUMER_FILE,
  "Shadow/Primary",
  base.shadow.effects,
);
const frame = consumer.page.append(
  world.node(CONSUMER_FILE, {
    id: "30:1",
    type: "FRAME",
    fills: [bound(aliases.main)],
    strokes: [bound(literal.dark)],
    effectStyleId: shadow.id,
    children: [
      instantiate(world, CONSUMER_FILE, base.components.button, "30:2"),
      world.node(CONSUMER_FILE, {
        id: "30:3",
        type: "RECTANGLE",
        fills: [bound(consumer.privateColor)],
      }),
      world.node(CONSUMER_FILE, {
        id: "30:4",
        type: "RECTANGLE",
        fills: [fixed()],
      }),
    ],
  }),
);
const paths = {
  ...boot.paths,
  consumer: await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    [frame.id],
    "mixed-local-scan",
  ),
};
const inventories = Object.fromEntries(
  ["base", "brand", "consumer"].map((side) => [
    side,
    readJson(root, paths[side]),
  ]),
);
const localSelections = selectionsFor(inventories.consumer, inventories.brand);
const selections = boot.selections.concat(localSelections);
const reviewInput = {
  ...makeHeader("local-review"),
  inventories,
  selections,
  resolutions: [],
  reviewEvidenceURL: "https://github.com/acme/widgets/issues/23",
};

test("review:本地來源與 Base 精確選擇同 scope,套用後兩側 carry 重跑零修改", async () => {
  const reviewed = cliReview(root, paths, selections, []);
  assert.equal(reviewed.status, 0, reviewed.stderr);
  assert.deepEqual(reviewed.json.counts, {
    selections: 26,
    carriedSelections: 0,
    resolutions: 0,
  });
  paths.review = reviewed.json.artifacts[0].path;
  const review = readJson(root, paths.review);
  assert.equal(
    review.inventoryDigests.consumer,
    contract.digest(inventories.consumer),
  );
  const staleConsumer = await cliScan(
    root,
    world,
    "consumer",
    CONSUMER_FILE,
    [frame.id],
    "mixed-local-stale",
  );
  const stale = runCli(planArgs({ ...paths, consumer: staleConsumer }), {
    cwd: root,
  });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /REVIEW_STALE/);

  const first = await cliSync(root, world, CONSUMER_FILE, planArgs(paths));
  assert.equal(first.record?.status, 0, JSON.stringify(first));
  assert.equal(first.record.json.status, "verified");
  const plan = readJson(root, first.planPath);
  assert.equal(plan.actions.length, 7);
  assert.equal(plan.conflicts.length, 0);
  assert.deepEqual(
    [...new Set(plan.managedSlots.map((slot) => slot.source.fileKey))].sort(),
    [BASE_FILE, CONSUMER_FILE].sort(),
  );
  assert.equal(
    plan.managedSlots.some((slot) =>
      ["30:3", "30:4"].includes(slot.locator.nodeId),
    ),
    false,
  );
  const firstReceipt = readJson(root, `${RECEIPTS}/${CONSUMER_FILE}.json`);
  assert.equal(firstReceipt.identityMap.length, 26);
  assert.equal(firstReceipt.managedSlots.length, 7);

  const freshPaths = {
    ...paths,
    consumer: await cliScan(
      root,
      world,
      "consumer",
      CONSUMER_FILE,
      [frame.id],
      "mixed-local-fresh",
    ),
  };
  const carried = cliReview(root, freshPaths, [], []);
  assert.equal(carried.status, 0, carried.stderr);
  assert.equal(carried.json.counts.carriedSelections, 26);
  freshPaths.review = carried.json.artifacts[0].path;
  world.resetLog();
  const next = await cliSync(root, world, CONSUMER_FILE, planArgs(freshPaths));
  assert.equal(next.record?.status, 0, JSON.stringify(next));
  assert.equal(next.record.json.status, "verified");
  assert.equal(next.planned.json.status, "noop");
  assert.equal(next.planned.json.counts.actions, 0);
  assert.equal(world.writes.scene, 0);
  assert.equal(
    readJson(root, `${RECEIPTS}/${CONSUMER_FILE}.json`).managedSlots.length,
    7,
  );
});

test("review:本地來源仍拒未知檔、remote、缺資產、type、alias 鏈與角色衝突", () => {
  const rejected = (change, expected) => {
    const input = structuredClone(reviewInput);
    change(input);
    assert.throws(() => core.createIdentityReview(input), { code: expected });
  };
  rejected((input) => {
    input.selections[13].source.fileKey = "OTHERfile01";
  }, "SELECTION_NOT_EXACT");
  rejected((input) => {
    input.inventories.consumer.assets.find(
      (asset) => asset.key === input.selections[13].source.key,
    ).fileKey = null;
  }, "SELECTION_NOT_EXACT");
  rejected((input) => {
    input.inventories.consumer.assets =
      input.inventories.consumer.assets.filter(
        (asset) => asset.key !== input.selections[13].source.key,
      );
  }, "SELECTION_NOT_EXACT");
  rejected((input) => {
    input.inventories.consumer.assets.find(
      (asset) => asset.key === input.selections[13].source.key,
    ).resolvedType = "FLOAT";
  }, "SELECTION_NOT_EXACT");
  rejected((input) => {
    input.selections = [input.selections[19]];
    input.inventories.consumer.assets =
      input.inventories.consumer.assets.filter(
        (asset) => asset.key !== literal.lighter.key,
      );
  }, "ALIAS_TARGET_MISSING");
  rejected((input) => {
    input.selections[13].role = "main";
  }, "SELECTION_ROLE_CONFLICT");
  rejected((input) => {
    input.inventories.consumer = null;
  }, "SELECTION_NOT_EXACT");
});

test("review:同檔 Base 缺的資產不從 consumer 補入,remote 同 key 也不代替 Base", () => {
  const sameFile = structuredClone(reviewInput);
  sameFile.inventories.base = structuredClone(sameFile.inventories.consumer);
  sameFile.selections = [structuredClone(localSelections[0])];
  sameFile.inventories.base.assets = sameFile.inventories.base.assets.filter(
    (asset) => asset.key !== localSelections[0].source.key,
  );
  assert.throws(() => core.createIdentityReview(sameFile), {
    code: "SELECTION_NOT_EXACT",
  });

  const remote = structuredClone(reviewInput);
  remote.selections = [structuredClone(boot.selections[8])];
  remote.inventories.base.assets = remote.inventories.base.assets.filter(
    (asset) => asset.key !== remote.selections[0].source.key,
  );
  assert.equal(
    remote.inventories.consumer.assets.find(
      (asset) => asset.key === remote.selections[0].source.key,
    ).fileKey,
    null,
  );
  assert.throws(() => core.createIdentityReview(remote), {
    code: "SELECTION_NOT_EXACT",
  });
});
