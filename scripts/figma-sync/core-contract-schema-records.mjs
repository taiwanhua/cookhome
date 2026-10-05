/**
 * plan / attempt 兩種 artifact 的欄位與跨欄檢查(共用片段取自 core-contract-schema.mjs);apply 的生成碼與 Node 端使用。
 * managedSlots / releasedSlots 帶由 inventory.nodes 產生的 scopeEvidence;plan 與 receipt 同型,receipt 沿用這裡的 pieces。
 * plan 的相依圖檢查由 assembleContract 以 core-contract-graph.mjs 掛進 checks.plan。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createRecordSchema(schema, checks = {}) {
  const { oneOf, pieces } = schema;
  const targets = oneOf(["brand-bindings", "library-upgrade"]);

  // 型別名的區域常數(生成碼的字元預算:同一個字串不重複出現)
  const STR = "string";
  const STR_N = "string?";
  const COUNT = "count";
  const COUNT_N = "count?";
  const OBJ = "object";
  const OBJ_N = "object?";
  const DIG = "digest";
  const DIG_N = "digest?";
  const ARR = "array";

  const MANAGED_SLOT = {
    locator: pieces.locator,
    role: pieces.ROLE,
    scopeEvidence: pieces.SCOPE_EVIDENCE,
    source: {
      fileKey: STR,
      componentKey: STR_N,
      nodeContextFileKey: STR,
      sourceNodeId: STR_N,
      ancestryPath: ARR,
      field: pieces.FIELD,
      index: COUNT_N,
      bindingKey: STR_N,
      aliasChain: ARR,
    },
    lastWrittenValue: OBJ,
    verifiedValue: OBJ_N,
    sourceMatchStatus: oneOf([
      "exact-root",
      "validated-structure",
      "direct-binding",
    ]),
    firstManagedRunId: STR,
    lastVerifiedRunId: STR_N,
  };
  const MANAGED_ASSET = {
    fileKey: STR,
    kind: pieces.ASSET_KIND,
    key: STR_N,
    localId: STR_N,
    role: pieces.ROLE_OR_NULL,
    collectionRole: pieces.SIDE,
    collectionKey: STR_N,
    lastWrittenValue: OBJ_N,
    verifiedValue: OBJ_N,
    firstManagedRunId: STR,
    lastVerifiedRunId: STR_N,
  };
  const RELEASED_SLOT = {
    locator: pieces.locator,
    scopeEvidence: pieces.SCOPE_EVIDENCE,
    previousReceiptDigest: DIG_N,
    resolutionEvidenceURL: STR,
    reason: STR,
    reviewedValue: OBJ,
    sourceMatchDigest: DIG_N,
    releasedRunId: STR,
  };
  const IDENTITY = {
    role: pieces.ROLE,
    assetKind: oneOf(["variable", "effect-style"]),
    source: pieces.ASSET_REF,
    project: pieces.ASSET_REF,
    aliasChain: ARR,
    reviewEvidenceURL: STR,
  };

  const bodies = {
    plan: {
      status: oneOf(["ready", "blocked", "noop"]),
      targetKind: oneOf(schema.TARGET_KINDS),
      scope: pieces.SCOPE,
      inputDigests: pieces.INPUT_DIGESTS,
      identityMap: [IDENTITY],
      actions: [
        {
          actionId: STR,
          locator: pieces.anyLocator,
          operation: STR,
          params: OBJ,
          role: pieces.ROLE_OR_NULL,
          sourceEvidence: OBJ_N,
          before: OBJ_N,
          expectedAfter: OBJ,
          preconditions: OBJ,
        },
      ],
      preserved: [
        {
          locator: pieces.anyLocator,
          reason: STR,
          snapshotDigest: DIG,
        },
      ],
      conflicts: ARR,
      managedSlots: [MANAGED_SLOT],
      releasedSlots: [RELEASED_SLOT],
      managedAssets: [MANAGED_ASSET],
      verification: {
        target: targets,
        expectedRoleValues: pieces.PRIMARY,
        expectedPrimaryEffect: OBJ,
        protectedBefore: { nodes: COUNT, digest: DIG },
        outsideScopeControls: { controls: COUNT, digest: DIG },
        brandProjectionDigest: DIG,
        publicationEvidence: pieces.PUBLICATION,
        acceptanceEvidence: pieces.ACCEPTANCE,
        recoveredAlreadyApplied: COUNT,
      },
    },
    attempt: {
      observedFileKey: STR_N,
      planDigest: DIG,
      status: oneOf(["interrupted", "failed", "applied"]),
      completedActions: [
        {
          actionId: STR,
          result: oneOf(["applied", "already-applied"]),
          readBack: OBJ,
        },
      ],
      errors: [pieces.issue],
      afterInventory: OBJ_N,
      afterInventoryDigest: DIG_N,
    },
  };

  return {
    bodies,
    checks,
    pieces: {
      TARGETS: targets,
      MANAGED_SLOT,
      MANAGED_ASSET,
      RELEASED_SLOT,
      IDENTITY,
    },
  };
}

/** plan 由 graph factory 另驗；attempt 內嵌 inventory 的來源沿同一檢查。 */
export function createRecordChecks() {
  return {
    attempt(value, tools) {
      if (value.afterInventory === null) return;
      const after = tools.validateArtifact(value.afterInventory);
      // 內嵌的 after 必須是同一輪 run / project / tool 的掃描,不能拼接別次的 inventory
      if (after.kind !== "inventory" || !tools.sameHeader(after, value)) {
        tools.fail(
          "ARTIFACT_INVALID",
          "attempt.afterInventory 的來源與 attempt 不符",
        );
      }
    },
  };
}
