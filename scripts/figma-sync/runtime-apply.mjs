/**
 * 執行已驗的 plan:先驗(fileKey、整張相依圖、重掃後整個 scope 的 guards 與逐筆 before)→ 逐筆寫前再驗、寫入並讀回
 * → 內嵌實際 afterInventory。任何先驗不符都在零場景寫入時以 STALE_PLAN 失敗;中途失敗只留 attempt,不 rollback、不自報成功。
 * writers={scene,asset}:場景寫入在 runtime-apply-scene.mjs、資產寫入在 runtime-apply-assets.mjs,依 operation 組裝;
 * plan 需要的 writer 沒有組進來時,在任何 mutation 前以 EXECUTOR_UNAVAILABLE 失敗。會被序列化進 Figma 執行。
 */
export function createPlanExecutor(figma, core, assets, scanScope, writers) {
  const SCENE = /^set-(paint-variable|effect-style)$/;
  const TOLERANCE = 1e-6;
  const coded = (code) => Object.assign(new Error(code), { code });

  function near(a, b) {
    if (typeof a === "number" && typeof b === "number") {
      return Math.abs(a - b) <= TOLERANCE;
    }
    if (a === null || b === null || typeof a !== "object") return a === b;
    if (typeof b !== "object") return false;
    const names = Object.keys(a);
    return (
      names.length === Object.keys(b).length &&
      names.every((name) => near(a[name], b[name]))
    );
  }

  async function applyPlan(request, plan) {
    core.validateArtifact(request);
    core.validateArtifact(plan);
    const fileKey = assets.fileKey();
    const completedActions = [];
    const errors = [];
    let mutated = false;
    const finish = async (status, afterInventory, rescan) => {
      let after = afterInventory;
      if (rescan) {
        try {
          after = await scanScope(request);
        } catch (error) {
          errors.push({ code: "AFTER_SCAN_FAILED", detail: "" });
        }
      }
      return core.validateArtifact({
        schemaVersion: 1,
        kind: "attempt",
        runId: request.runId,
        generatedAt: new Date().toISOString(),
        project: request.project,
        tool: request.tool,
        observedFileKey: fileKey,
        planDigest: request.inputDigests.plan,
        status,
        completedActions,
        errors,
        afterInventory: after,
        afterInventoryDigest: null,
      });
    };
    const reject = (code, detail, afterInventory) => {
      errors.push({ code, detail: detail || "" });
      return finish("failed", afterInventory || null, false);
    };

    const roots = plan.scope.rootNodeIds;
    const consistent =
      request.kind === "request" &&
      plan.kind === "plan" &&
      request.operation === "apply" &&
      request.runId === plan.runId &&
      request.targetKind === plan.targetKind &&
      request.target.fileKey === plan.scope.fileKey &&
      near(request.target.rootNodeIds, roots);
    if (!consistent) return reject("REQUEST_PLAN_MISMATCH");
    // fileKey 缺或不符:任何 mutation / import 之前失敗
    if (fileKey === null) return reject("FILE_KEY_UNREADABLE");
    if (fileKey !== plan.scope.fileKey) return reject("FILE_KEY_MISMATCH");
    if (plan.status === "blocked") return reject("PLAN_BLOCKED");

    // 全域先驗:非 action 的節點 / slot / 資產、issues 與 scope 外控制值都要等於規劃時;再逐筆判定
    const before = await scanScope(request);
    const reconciled = core.reconcileInterruptedPlan({
      plan,
      inventory: before,
      attempt: null,
    });
    const conflict = reconciled.actions.find(
      (item) => item.status === "conflict",
    );
    if (reconciled.stale.length > 0) {
      return reject("STALE_PLAN", reconciled.stale.join(","), before);
    }
    if (conflict) {
      const detail = `${conflict.actionId} ${conflict.code}`;
      return reject("STALE_PLAN", detail, before);
    }
    // noop:通過完整先驗後不 import、不寫入,先驗用的掃描就是實際 after
    if (plan.actions.length === 0) return finish("applied", before, false);

    const pending = reconciled.actions
      .filter((item) => item.status === "pending")
      .map((item) => item.action);
    const run = {
      request,
      plan,
      fileKey,
      roots,
      near,
      coded,
      touch: () => {
        mutated = true;
      },
    };
    // 依 action 種類取得 writer;場景 writer 先完成 scope / 字型 / 匯入值的檢查,全部通過才開始任何寫入
    const write = {};
    for (const kind of ["scene", "asset"]) {
      const own = pending.filter(
        (action) => SCENE.test(action.operation) === (kind === "scene"),
      );
      if (own.length === 0) continue;
      if (!writers[kind]) {
        return reject("EXECUTOR_UNAVAILABLE", own[0].actionId, before);
      }
      const session = writers[kind](run);
      const problem = await session.prepare(own);
      if (problem) return reject(problem.code, problem.detail, before);
      write[kind] = session.write;
    }

    for (const item of reconciled.actions) {
      const action = item.action;
      if (item.status === "already-applied") {
        completedActions.push({
          actionId: action.actionId,
          result: "already-applied",
          readBack: item.readBack,
        });
        continue;
      }
      try {
        const kind = SCENE.test(action.operation) ? "scene" : "asset";
        const readBack = await write[kind](action);
        completedActions.push({
          actionId: action.actionId,
          result: "applied",
          readBack,
        });
      } catch (error) {
        errors.push({
          code: error && error.code ? error.code : "WRITE_FAILED",
          detail: action.actionId,
        });
        return finish(mutated ? "interrupted" : "failed", null, true);
      }
    }
    return finish("applied", null, true);
  }

  return { applyPlan };
}
