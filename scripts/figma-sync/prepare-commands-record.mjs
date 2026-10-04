/**
 * record 命令:接收 runtime 回傳(原協定 JSON,或有界傳輸的 envelope),封存後交給同一份 verifySync,
 * 只有 verified 才以 CAS 更新持久 receipt。執行或驗證失敗先存 attempt 再失敗,前次成功 receipt 原樣保留。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  hashArtifact,
  readArtifact,
  writeArtifact,
  writeVerifiedReceipt,
} from "./artifacts.mjs";
import {
  contract,
  core,
  ownRunDir,
  readKind,
} from "./prepare-commands-context.mjs";
import { recordTransport } from "./transport-record.mjs";

const { fail } = contract;

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fail("RESULT_UNREADABLE");
  }
}

/** runtime 回傳只接受協定 JSON 本身;run、project、tool 都必須是這個 request 的。 */
function checkResult(value, request) {
  const result = contract.validateArtifact(value);
  const wanted = request.operation === "scan" ? "inventory" : "attempt";
  if (result.kind !== wanted) fail("RESULT_KIND_MISMATCH", wanted);
  if (!contract.sameHeader(result, request)) fail("RESULT_SOURCE_MISMATCH");
  return result;
}

/** 同 request / run 的相同 canonical 回傳可重送;不同內容回 RESULT_CHANGED。 */
function archiveResult(runDir, result) {
  const target = path.join(runDir, "runtime-result.json");
  const changed =
    existsSync(target) &&
    hashArtifact(readArtifact(target)) !== hashArtifact(result);
  if (changed) fail("RESULT_CHANGED");
  return writeArtifact({
    runDir,
    name: "runtime-result.json",
    artifact: result,
  });
}

function recordScan(runDir, request, result) {
  const sameScope =
    result.observedFileKey === request.target.fileKey &&
    result.scope.fileKey === request.target.fileKey &&
    contract.sameValue(result.scope.rootNodeIds, request.target.rootNodeIds);
  if (!sameScope) fail("FILE_KEY_MISMATCH");
  const raw = archiveResult(runDir, result);
  return {
    runId: request.runId,
    status: "recorded",
    artifacts: [
      raw,
      writeArtifact({
        runDir,
        name: `inventory-${request.targetKind}.json`,
        artifact: result,
      }),
    ],
    counts: Object.assign({}, result.coverage, {
      slots: result.slots.length,
      assets: result.assets.length,
      issues: result.issues.length,
    }),
  };
}

function recordApply(runDir, request, result, context) {
  const planned = readKind(path.join(runDir, "plan.json"), "plan", context);
  const planDigest = hashArtifact(planned);
  if (planDigest !== request.inputDigests.plan) fail("PLAN_CHANGED");
  if (result.planDigest !== planDigest) fail("RESULT_SOURCE_MISMATCH");
  // raw 回傳的 afterInventoryDigest 必須是 null;補註只發生在封存的 attempt
  if (result.afterInventoryDigest !== null) fail("RESULT_SOURCE_MISMATCH");
  const artifacts = [archiveResult(runDir, result)];
  const after = result.afterInventory;
  if (after) {
    artifacts.push(
      writeArtifact({ runDir, name: "inventory-after.json", artifact: after }),
    );
  }
  const attempt = Object.assign({}, result, {
    afterInventoryDigest: after ? hashArtifact(after) : null,
  });
  artifacts.push(
    writeArtifact({ runDir, name: "attempt.json", artifact: attempt }),
  );
  // 以下任何失敗都發生在 attempt 已封存之後,前次成功 receipt 原樣保留
  if (result.observedFileKey === null || result.status !== "applied") {
    fail("ATTEMPT_NOT_APPLIED", result.status);
  }
  if (!after) fail("AFTER_INVENTORY_MISSING");
  const inputs = (name) => path.join(runDir, "inputs", `${name}.json`);
  const previousPath = inputs("previous-receipt");
  const previousReceipt = existsSync(previousPath)
    ? readKind(previousPath, "receipt", context)
    : null;
  const verdict = core.verifySync({
    plan: planned,
    beforeInventory: readKind(
      inputs(`inventory-${planned.targetKind}`),
      "inventory",
      context,
    ),
    afterInventory: after,
    previousReceipt,
    attempt,
  });
  if (verdict.status !== "verified") {
    const codes = verdict.verification.errors.map((error) => error.code);
    const unique = Array.from(new Set(codes)).slice(0, 5).join(",");
    fail("VERIFICATION_FAILED", unique);
  }
  const receipt = writeVerifiedReceipt({
    rootDir: context.rootDir,
    receipt: verdict.receipt,
    expectedPreviousDigest: planned.inputDigests.previousReceipt,
  });
  artifacts.push({
    kind: receipt.kind,
    path: receipt.path,
    digest: receipt.digest,
  });
  return {
    runId: request.runId,
    status: "verified",
    artifacts,
    counts: Object.assign({}, verdict.receipt.changes, {
      managedSlots: verdict.receipt.managedSlots.length,
      releasedSlots: verdict.receipt.releasedSlots.length,
      managedAssets: verdict.receipt.managedAssets.length,
    }),
  };
}

export function record(options, context) {
  const request = readKind(options.request, "request", context);
  const names =
    request.operation === "scan"
      ? [`request-${request.targetKind}-scan.json`]
      : ["request-apply.json"];
  const runDir = ownRunDir(options.request, request, context, names);
  let value;
  if (options.transportResult) {
    // 先持久保存收到的 head / chunk;未接齊時只回下一支唯讀 JS,pending 不是成功
    const received = recordTransport({
      request,
      envelope: readJson(options.transportResult),
      runDir,
      context,
    });
    if (!received.complete) {
      return {
        runId: request.runId,
        status: "transport-pending",
        artifacts: received.artifacts,
        counts: received.counts,
      };
    }
    value = received.artifact;
  } else {
    value = readJson(options.result);
  }
  const result = checkResult(value, request);
  return request.operation === "scan"
    ? recordScan(runDir, request, result)
    : recordApply(runDir, request, result, context);
}
