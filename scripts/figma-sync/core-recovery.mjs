/**
 * 中斷恢復與 apply 前先驗共用的判定:以原 plan 對新掃描分類每筆 action,並核對整個 scope 的 guards。
 * 等於 before → pending;等於 expectedAfter 且 guards 有效 → already-applied;兩者皆非 → conflict。
 * classifiers={scene,asset}:逐筆的分類規則在 core-recovery-classify.mjs,依 operation 組裝;
 * plan 內有 action 的分類規則沒有組進來時,該筆回 conflict(EXECUTOR_UNAVAILABLE),不會被執行。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createRecoveryCore(contract, classifiers) {
  const { digest, slotKey, sameValue, fail } = contract;

  /** 整個 scope 的先驗:非 action 的節點 / slot / 資產、issues、capabilities 與 scope 外控制值。 */
  function staleGuards(plan, inventory) {
    const actionKeys = new Set();
    const targeted = new Set();
    for (const action of plan.actions) {
      if (action.locator.assetKind) {
        if (action.locator.key) targeted.add(action.locator.key);
      } else {
        actionKeys.add(slotKey(action.locator));
      }
    }
    const brand = plan.targetKind === "brand-library";
    const expected = plan.verification;
    const scope = contract.scopeGuard(
      inventory,
      actionKeys,
      brand ? targeted : null,
    );
    const stale = [];
    if (!sameValue(inventory.scope, plan.scope)) stale.push("SCOPE_MISMATCH");
    if (scope.digest !== expected.protectedBefore.digest) {
      stale.push("SCOPE_GUARD_CHANGED");
    }
    const controls = contract.controlGuard(inventory);
    if (controls.digest !== expected.outsideScopeControls.digest) {
      stale.push("OUTSIDE_SCOPE_CHANGED");
    }
    return stale;
  }

  function reconcileInterruptedPlan(input) {
    const { plan, inventory } = input;
    const attempt = input.attempt || null;
    const planDigest = digest(plan);
    if (attempt) {
      // 恢復用的 attempt 必須是原 plan 那一輪的:digest、run、project、tool 都相符
      const same =
        attempt.planDigest === planDigest && contract.sameHeader(attempt, plan);
      if (!same) fail("ATTEMPT_PLAN_MISMATCH");
    }
    if (inventory.observedFileKey !== plan.scope.fileKey) {
      fail("SCOPE_MISMATCH");
    }
    const readBacks = new Map();
    for (const done of attempt ? attempt.completedActions : []) {
      readBacks.set(done.actionId, done.readBack);
    }
    const outcomes = new Map();
    const result = (action, status, code, observed, readBack) => ({
      actionId: action.actionId,
      action,
      status,
      code: code || null,
      observed: observed === undefined ? null : observed,
      readBack: readBack || null,
    });
    const state = { plan, inventory, readBacks, outcomes, result };
    const classify = {};
    for (const kind of ["scene", "asset"]) {
      classify[kind] = classifiers[kind] ? classifiers[kind](state) : null;
    }

    const actions = plan.actions.map((action) => {
      const scene = /^set-(paint-variable|effect-style)$/.test(
        action.operation,
      );
      const rule = classify[scene ? "scene" : "asset"];
      const outcome = rule
        ? rule(action)
        : result(action, "conflict", "EXECUTOR_UNAVAILABLE");
      outcomes.set(action.actionId, outcome);
      return outcome;
    });
    const count = (status) =>
      actions.filter((item) => item.status === status).length;
    return {
      planDigest,
      actions,
      stale: staleGuards(plan, inventory),
      counts: {
        pending: count("pending"),
        alreadyApplied: count("already-applied"),
        conflict: count("conflict"),
      },
    };
  }

  return { reconcileInterruptedPlan };
}

/** 依清單組裝:沒有列入的分類規則不組(對應的 action 回 conflict)。Node 端與生成碼共用這一支。 */
export function assembleRecovery(factories, contract) {
  return factories.createRecoveryCore(contract, {
    scene: factories.createSceneClassifier
      ? factories.createSceneClassifier(contract)
      : null,
    asset: factories.createAssetClassifier
      ? factories.createAssetClassifier(contract)
      : null,
  });
}
