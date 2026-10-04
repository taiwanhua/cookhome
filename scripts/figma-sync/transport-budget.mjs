/**
 * 寫前 trace 預算:apply 的 attemptHead 必須放得進有界的 head,而且要在任何 mutation 之前就能確定。
 * 無 Node / Figma I/O;會被序列化進 Figma 執行。
 */
export function createTraceBudget(contract) {
  const ATTEMPT_HEAD_BYTES = 10240;

  /**
   * 寫前 trace 預算:attemptHead 的保守未壓縮上界,以各欄位最大值計(新建身分 key 64、localId 128、
   * defaultModeId 64 bytes),不靠預期壓縮率。任何 mutation 前超量就不執行。
   */
  function traceBudget(request, plan) {
    const pad = (length) => "x".repeat(length);
    const entry = (action) => {
      const params = action.params;
      let readBack;
      if (/^create-/.test(action.operation)) {
        const collection = action.operation === "create-collection";
        readBack = {
          kind: "effect-style",
          key: pad(64),
          localId: pad(128),
          defaultModeId: collection ? pad(64) : null,
        };
      } else if (action.operation === "set-effect-style-effects") {
        readBack = {
          value: { effects: params.effects, reserve: pad(64) },
          importedAssetKey: null,
        };
      } else if (action.operation === "set-variable-value") {
        const value =
          params.value.kind === "alias"
            ? { kind: "alias", variableKey: pad(64) }
            : { kind: "rgba", rgba: params.value.rgba, reserve: pad(32) };
        readBack = { value, importedAssetKey: null };
      } else {
        readBack = {
          value: {
            kind: "variable",
            key: pad(64),
            localId: pad(128),
            remote: false,
          },
          importedAssetKey: pad(64),
        };
      }
      return { actionId: action.actionId, result: "already-applied", readBack };
    };
    const longest = plan.actions.reduce(
      (length, action) => Math.max(length, action.actionId.length),
      0,
    );
    const error = { code: pad(40), detail: pad(longest + 40) };
    const worst = {
      schemaVersion: 1,
      kind: "attempt",
      runId: request.runId,
      generatedAt: pad(24),
      project: request.project,
      tool: request.tool,
      observedFileKey: request.target.fileKey,
      planDigest: pad(64),
      status: "interrupted",
      completedActions: plan.actions.map(entry),
      errors: [error, error],
      afterInventoryDigest: null,
    };
    const bytes = contract.utf8Length(JSON.stringify(worst));
    return { bytes, ok: bytes <= ATTEMPT_HEAD_BYTES };
  }

  return { ATTEMPT_HEAD_BYTES, traceBudget };
}
