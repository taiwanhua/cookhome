/**
 * scan / review / plan / plan-brand / apply 五個命令:生成 request、identity-review、plan 與要交給 Figma 執行的 JS。
 * CLI 不讀 token、不呼叫 Figma;規劃用的 request 在 plan 產生前沒有 plan digest,apply 才補上。
 */
import { existsSync } from "node:fs";
import path from "node:path";

import {
  hashArtifact,
  readReceipt,
  writeArtifact,
  writeExecutionSource,
} from "./artifacts.mjs";
import { buildExecutionSource } from "./execution-source.mjs";
import {
  contract,
  core,
  header,
  ownRunDir,
  readKind,
  runDirOf,
  saveInputs,
} from "./prepare-commands-context.mjs";

const { fail } = contract;

function applyRequest(context, base, targetKind, target, digests, evidence) {
  return Object.assign(base, {
    operation: "apply",
    targetKind,
    target: { fileKey: target.fileKey, rootNodeIds: target.rootNodeIds },
    includeHidden: true,
    brandProjection: context.brandProjection,
    inputDigests: digests,
    publicationEvidence: evidence.publication || null,
    acceptanceEvidence: evidence.acceptance || null,
  });
}

export function scan(options, context) {
  const runDir = runDirOf(context, options.runId);
  if (existsSync(runDir)) fail("RUN_EXISTS");
  const request = Object.assign(header(context, "request", options.runId), {
    operation: "scan",
    targetKind: options.kind,
    target: { fileKey: options.fileKey, rootNodeIds: options.roots },
    includeHidden: true,
    brandProjection: context.brandProjection,
    inputDigests: {
      inventories: [],
      identityReview: null,
      previousReceipt: null,
      plan: null,
    },
    publicationEvidence: null,
    acceptanceEvidence: null,
  });
  const source = buildExecutionSource({ request, plan: null });
  return {
    runId: options.runId,
    status: "scan-requested",
    artifacts: [
      writeArtifact({
        runDir,
        name: `request-${options.kind}-scan.json`,
        artifact: request,
      }),
      writeExecutionSource({ runDir, name: `scan-${options.kind}.js`, source }),
    ],
    counts: { roots: options.roots.length },
  };
}

export function review(options, context) {
  const base = readKind(options.base, "inventory", context);
  const brand = readKind(options.brand, "inventory", context);
  const consumer = options.consumer
    ? readKind(options.consumer, "inventory", context)
    : null;
  const previous = consumer
    ? readReceipt({
        rootDir: context.rootDir,
        fileKey: consumer.observedFileKey,
        project: context.project,
      })
    : null;
  // 既有累積對照可沿用:只帶仍 exact 存在於兩側 inventory 的已驗選擇;新 key / 新角色仍須明示
  const explicit = options.selectionsJson;
  const taken = new Set(explicit.map((item) => item && item.source?.key));
  const present = (inventory, kind, ref) =>
    inventory.assets.some(
      (asset) =>
        asset.kind === kind &&
        asset.key === ref.key &&
        asset.fileKey === ref.fileKey &&
        asset.resolvedType === ref.resolvedType,
    );
  const carried = (previous ? previous.identityMap : [])
    .filter(
      (item) =>
        !taken.has(item.source.key) &&
        present(base, item.assetKind, item.source) &&
        present(brand, item.assetKind, item.project),
    )
    .map(({ role, assetKind, source, project }) => ({
      role,
      assetKind,
      source,
      project,
    }));
  const runId = context.newRunId("review");
  const artifact = core.createIdentityReview(
    Object.assign(header(context, "identity-review", runId), {
      inventories: { base, brand, consumer },
      selections: carried.concat(explicit),
      resolutions: options.resolutionsJson || [],
      reviewEvidenceURL: options.reviewEvidenceUrl,
    }),
  );
  const runDir = runDirOf(context, runId);
  saveInputs(runDir, {
    "inventory-base-library": base,
    "inventory-brand-library": brand,
    "inventory-consumer": consumer,
    "previous-receipt": previous,
  });
  return {
    runId,
    status: "reviewed",
    artifacts: [
      writeArtifact({ runDir, name: "identity-review.json", artifact }),
    ],
    counts: {
      selections: artifact.selections.length,
      carriedSelections: carried.length,
      resolutions: artifact.resolutions.length,
    },
  };
}

function readResume(resumePath, context) {
  if (!resumePath) return { resumePlan: null, resumeAttempt: null };
  const attemptPath = path.join(path.dirname(resumePath), "attempt.json");
  return {
    resumePlan: readKind(resumePath, "plan", context),
    // 原 run 已封存的 attempt 只提供 readBack;沒有就以原 plan + 新掃描恢復
    resumeAttempt: existsSync(attemptPath)
      ? readKind(attemptPath, "attempt", context)
      : null,
  };
}

export function plan(options, context, targetKind) {
  const brandOnly = targetKind === "brand-library";
  const inventories = { brand: readKind(options.brand, "inventory", context) };
  if (!brandOnly) {
    inventories.base = readKind(options.base, "inventory", context);
    inventories.consumer = readKind(options.consumer, "inventory", context);
  }
  const identityReview = brandOnly
    ? null
    : readKind(options.identityReview, "identity-review", context);
  const target = brandOnly ? inventories.brand : inventories.consumer;
  const previousReceipt = readReceipt({
    rootDir: context.rootDir,
    fileKey: target.observedFileKey || "",
    project: context.project,
  });
  const { resumePlan, resumeAttempt } = readResume(options.resume, context);
  const runId = context.newRunId(brandOnly ? "plan-brand" : "plan");
  const names = brandOnly ? ["brand"] : ["base", "brand", "consumer"];
  // 規劃用的 request:此時還沒有 plan,digest 只在恢復時指向原 plan
  const request = applyRequest(
    context,
    header(context, "request", runId),
    targetKind,
    { fileKey: target.observedFileKey, rootNodeIds: target.scope.rootNodeIds },
    {
      inventories: names.map((name) => hashArtifact(inventories[name])),
      identityReview: identityReview ? hashArtifact(identityReview) : null,
      previousReceipt: previousReceipt ? hashArtifact(previousReceipt) : null,
      plan: resumePlan ? hashArtifact(resumePlan) : null,
    },
    {
      publication: options.publicationEvidenceJson,
      acceptance: options.acceptanceEvidenceJson,
    },
  );
  const artifact = core.planSync({
    request,
    inventories,
    identityReview,
    previousReceipt,
    resumePlan,
    resumeAttempt,
    verificationTarget: brandOnly
      ? "brand-bindings"
      : options.verificationTarget,
  });
  const runDir = runDirOf(context, runId);
  saveInputs(runDir, {
    "inventory-base-library": inventories.base,
    "inventory-brand-library": inventories.brand,
    "inventory-consumer": inventories.consumer,
    "identity-review": identityReview,
    "previous-receipt": previousReceipt,
    "resume-plan": resumePlan,
    "resume-attempt": resumeAttempt,
  });
  return {
    runId,
    status: artifact.status,
    artifacts: [writeArtifact({ runDir, name: "plan.json", artifact })],
    counts: {
      actions: artifact.actions.length,
      conflicts: artifact.conflicts.length,
      preserved: artifact.preserved.length,
      managedSlots: artifact.managedSlots.length,
      releasedSlots: artifact.releasedSlots.length,
      managedAssets: artifact.managedAssets.length,
    },
  };
}

export function apply(options, context) {
  const artifact = readKind(options.plan, "plan", context);
  const runDir = ownRunDir(options.plan, artifact, context, ["plan.json"]);
  if (artifact.status === "blocked") fail("PLAN_BLOCKED");
  // plan 之後品牌輸入、工具原始碼或持久 receipt 若有變,要重新 plan
  const expected = artifact.verification.brandProjectionDigest;
  if (hashArtifact(context.brandProjection) !== expected) {
    fail("BRAND_INPUT_CHANGED");
  }
  if (artifact.tool.sourceDigest !== context.tool.sourceDigest) {
    fail("TOOL_CHANGED");
  }
  const current = readReceipt({
    rootDir: context.rootDir,
    fileKey: artifact.scope.fileKey,
    project: context.project,
  });
  const currentDigest = current ? hashArtifact(current) : null;
  if (currentDigest !== artifact.inputDigests.previousReceipt) {
    fail("RECEIPT_CHANGED");
  }
  // request 的 header 沿用 plan(含 generatedAt),重跑 apply 會得到相同內容
  const request = applyRequest(
    context,
    {
      schemaVersion: 1,
      kind: "request",
      runId: artifact.runId,
      generatedAt: artifact.generatedAt,
      project: artifact.project,
      tool: artifact.tool,
    },
    artifact.targetKind,
    artifact.scope,
    Object.assign({}, artifact.inputDigests, { plan: hashArtifact(artifact) }),
    {
      publication: artifact.verification.publicationEvidence,
      acceptance: artifact.verification.acceptanceEvidence,
    },
  );
  const source = buildExecutionSource({
    request,
    plan: artifact,
    limits: context.toolLimits,
  });
  return {
    runId: artifact.runId,
    status: "apply-requested",
    artifacts: [
      writeArtifact({ runDir, name: "request-apply.json", artifact: request }),
      writeExecutionSource({ runDir, name: "execute.js", source }),
    ],
    counts: { actions: artifact.actions.length },
  };
}
