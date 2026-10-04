/**
 * 精驗與累積 receipt:以封存的 plan / before 與 runtime 實際回傳的 after 重新驗,不信任 runtime 自報成功。
 * after 必須就是 attempt 內嵌的那份掃描;受管 slot 另核對完整來源鏈、來源與專案的 alias 鏈,
 * 不把「sourceSlot 存在、最終顏色相同」當成來源語意完整。只有全部通過才產生 receipt;
 * 範圍外的既有登記原樣保留其 lastVerifiedRunId。無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createSyncVerifier(contract) {
  const { digest, slotKey, sameValue, valueMatches, chainKeys } = contract;
  const { SHADOW_ROLE } = contract;
  const triple = (kind, collectionRole, role) =>
    [kind, collectionRole, role].join("|");

  function verifySync(input) {
    const { plan, attempt } = input;
    const before = input.beforeInventory;
    const after = input.afterInventory;
    const prior = input.previousReceipt || null;
    const errors = [];
    const error = (code, detail) => errors.push({ code, detail: detail || "" });
    const fileKey = plan.scope.fileKey;
    const planDigest = digest(plan);
    const expected = plan.verification;
    const upgrade = expected.target === "library-upgrade";
    const consumer = plan.targetKind === "consumer";
    const inventories = plan.inputDigests.inventories;
    const afterDigest = digest(after);

    if (plan.status === "blocked") error("PLAN_BLOCKED");
    if (attempt.planDigest !== planDigest) error("ATTEMPT_PLAN_MISMATCH");
    if (attempt.status !== "applied") error("ATTEMPT_NOT_APPLIED");
    if (!contract.sameHeader(attempt, plan)) error("RUN_MISMATCH");
    if (inventories[inventories.length - 1] !== digest(before)) {
      error("BEFORE_INVENTORY_MISMATCH");
    }
    if ((prior ? digest(prior) : null) !== plan.inputDigests.previousReceipt) {
      error("PREVIOUS_RECEIPT_MISMATCH");
    }
    // 所驗的 after 必須是這份 attempt 內嵌、同一輪 run 的掃描
    const embedded =
      attempt.afterInventory !== null &&
      digest(attempt.afterInventory) === afterDigest &&
      contract.sameHeader(after, attempt) &&
      (attempt.afterInventoryDigest === null ||
        attempt.afterInventoryDigest === afterDigest);
    if (!embedded) error("AFTER_INVENTORY_MISMATCH");
    const sameFile =
      attempt.observedFileKey === fileKey &&
      before.observedFileKey === fileKey &&
      after.observedFileKey === fileKey &&
      sameValue(after.scope, plan.scope);
    if (!sameFile) error("SCOPE_MISMATCH");

    const completed = new Map();
    for (const done of attempt.completedActions) {
      completed.set(done.actionId, done);
    }
    const actionKeys = new Set();
    for (const action of plan.actions) {
      if (!completed.has(action.actionId)) {
        error("ACTION_NOT_COMPLETED", action.actionId);
      }
      if (!action.locator.assetKind) actionKeys.add(slotKey(action.locator));
    }

    // protected / scope 外控制值:每個節點(不論有沒有 slot)與非本次 action 的 slot 逐一比對
    const afterNodes = contract.indexNodes(after);
    const afterSlots = contract.indexSlots(after);
    const beforeNodes = contract.indexNodes(before);
    const beforeSlots = contract.indexSlots(before);
    const scopeOf = (nodes, nodeId) => nodes.get(nodeId).scopeRootId;
    const changes = { inside: 0, outside: 0 };
    const count = (inside) => {
      changes[inside ? "inside" : "outside"] += 1;
    };
    for (const [nodeId, node] of beforeNodes) {
      if (!sameValue(node, afterNodes.get(nodeId) || null)) {
        count(node.scopeRootId !== null);
      }
    }
    for (const [nodeId, node] of afterNodes) {
      if (!beforeNodes.has(nodeId)) count(node.scopeRootId !== null);
    }
    let sourceKeysPreserved = true;
    const keysOf = (slot) => [
      slot.sourceMatch.componentKey,
      slot.sourceMatch.ancestryPath.map((step) => step.nestedComponentKey),
    ];
    for (const [key, slot] of beforeSlots) {
      const now = afterSlots.get(key);
      const inside = scopeOf(beforeNodes, slot.locator.nodeId) !== null;
      const untouched =
        now &&
        (actionKeys.has(key) ||
          (sameValue(slot.value, now.value) &&
            sameValue(slot.aliasChain, now.aliasChain) &&
            sameValue(slot.sourceMatch, now.sourceMatch) &&
            (!consumer || sameValue(slot.resolvedValue, now.resolvedValue))));
      if (!untouched) count(inside);
      if (now && !sameValue(keysOf(slot), keysOf(now))) {
        sourceKeysPreserved = false;
      }
    }
    for (const [key, slot] of afterSlots) {
      if (beforeSlots.has(key)) continue;
      count(scopeOf(afterNodes, slot.locator.nodeId) !== null);
    }
    if (changes.inside > 0) error("PROTECTED_CHANGED");
    if (changes.outside > 0) error("OUTSIDE_SCOPE_CHANGED");
    if (!sourceKeysPreserved) error("SOURCE_KEYS_CHANGED");

    const projectChains = new Map();
    const sourceKeys = new Set();
    const identityKeys = new Set();
    for (const identity of plan.identityMap) {
      projectChains.set(identity.project.key, chainKeys(identity.aliasChain));
      sourceKeys.add(identity.source.key);
      identityKeys.add(identity.source.key);
      identityKeys.add(identity.project.key);
    }
    const expectedFor = (role) =>
      role === SHADOW_ROLE
        ? { kind: "effects", effects: [expected.expectedPrimaryEffect] }
        : { kind: "rgba", rgba: expected.expectedRoleValues[role] };
    /** 來源語意:完整祖先來源鏈、來源 binding 與 alias 鏈都要等於 plan 封存的證據。 */
    const sameSource = (entry, slot) => {
      const match = slot.sourceMatch;
      const source = entry.source;
      if (entry.sourceMatchStatus === "direct-binding") {
        return match.sourceSlot === null;
      }
      return (
        match.sourceSlot !== null &&
        match.status === entry.sourceMatchStatus &&
        match.componentKey === source.componentKey &&
        match.sourceNodeId === source.sourceNodeId &&
        sameValue(match.ancestryPath, source.ancestryPath) &&
        match.sourceSlot.bindingKey === source.bindingKey &&
        sameValue(
          chainKeys(match.sourceSlot.aliasChain),
          chainKeys(source.aliasChain),
        )
      );
    };
    let exactColors = 0;
    let exactPrimaryEffects = 0;
    let unresolved = 0;
    const semantic = { managed: 0, withSourceSlot: 0, directBinding: 0 };
    const liveAfter = (id) =>
      afterNodes.has(id) && afterNodes.get(id).scopeRootId !== null;
    const managedSlots = plan.managedSlots.map((entry) => {
      const key = slotKey(entry.locator);
      const slot = afterSlots.get(key);
      if (!slot || !liveAfter(entry.locator.nodeId)) {
        // 不在本次範圍才可沿用既有已驗登記;範圍內消失或本輪新收管卻讀不到都是失敗
        const evidence = entry.scopeEvidence;
        const inScope =
          liveAfter(entry.locator.nodeId) ||
          (after.scope.pageIds.includes(evidence.pageId) &&
            evidence.ancestorIds.some(
              (id) => after.scope.rootNodeIds.includes(id) || liveAfter(id),
            ));
        if (inScope || entry.lastVerifiedRunId === null) {
          error("MANAGED_SLOT_MISSING", key);
        }
        return entry;
      }
      const exact =
        valueMatches(slot.value, entry.lastWrittenValue) &&
        sameValue(slot.resolvedValue, expectedFor(entry.role));
      if (!exact) error("MANAGED_VALUE_MISMATCH", key);
      const chain = projectChains.get(entry.lastWrittenValue.key);
      const projectAlias =
        entry.role === SHADOW_ROLE ||
        (chain && sameValue(chainKeys(slot.aliasChain), chain));
      if (!projectAlias) error("PROJECT_ALIAS_CHANGED", key);
      const sourced = sameSource(entry, slot);
      if (!sourced) {
        unresolved += 1;
        error("SOURCE_SEMANTICS_CHANGED", key);
      }
      if (!exact || !projectAlias || !sourced) return entry;
      if (entry.role === SHADOW_ROLE) exactPrimaryEffects += 1;
      else exactColors += 1;
      semantic.managed += 1;
      if (slot.sourceMatch.sourceSlot) semantic.withSourceSlot += 1;
      else semantic.directBinding += 1;
      return Object.assign({}, entry, {
        verifiedValue: { kind: slot.value.kind, key: slot.value.key },
        lastVerifiedRunId: plan.runId,
      });
    });

    const released = new Set();
    for (const slot of plan.releasedSlots) released.add(slotKey(slot.locator));
    const managedKeys = new Set();
    for (const slot of plan.managedSlots)
      managedKeys.add(slotKey(slot.locator));
    let remainingBaseBrandSlots = 0;
    for (const [key, slot] of afterSlots) {
      if (!liveAfter(slot.locator.nodeId) || released.has(key)) continue;
      const direct = slot.value.key && sourceKeys.has(slot.value.key);
      const viaAlias = slot.aliasChain.some((step) =>
        sourceKeys.has(step.variableKey),
      );
      if (direct || viaAlias) remainingBaseBrandSlots += 1;
    }
    // after 重套與規劃相同的 fail-closed 規則:alias / 讀取錯誤與全域掃描問題都不能標記成功
    const blocking = after.issues.filter((issue) =>
      contract.blockingIssue(issue, identityKeys, managedKeys),
    );
    const unsupported = blocking.filter(
      (issue) => issue.code === "UNSUPPORTED_BINDING",
    ).length;
    unresolved += blocking.length - unsupported;
    const brokenInstances = after.coverage.brokenInstances;
    if (remainingBaseBrandSlots > 0) error("BASE_BRAND_REMAINING");
    for (const issue of blocking) error("AFTER_ISSUE", issue.code);
    if (brokenInstances > before.coverage.brokenInstances) {
      error("BROKEN_INSTANCES");
    }
    if (upgrade) {
      if (!expected.publicationEvidence || !expected.acceptanceEvidence) {
        error("EVIDENCE_REQUIRED");
      }
      if (semantic.directBinding > 0 || brokenInstances > 0) {
        error("SOURCE_SEMANTIC_INCOMPLETE");
      }
    }

    // 品牌庫資產:新建者只認 attempt readBack 的真身分,再以 after inventory 精驗
    let managedAssets = plan.managedAssets;
    if (!consumer) {
      const assets = contract.indexAssets(after);
      const identities = new Map();
      for (const entry of plan.managedAssets) {
        const id = triple(entry.kind, entry.collectionRole, entry.role);
        const creator = plan.actions.find(
          (action) =>
            /^create-/.test(action.operation) &&
            triple(
              action.locator.assetKind,
              action.locator.collectionRole,
              action.role,
            ) === id,
        );
        const done = creator ? completed.get(creator.actionId) : null;
        const key = entry.key || (done ? done.readBack.key : null);
        const asset = key ? assets.get(`${entry.kind}:${key}`) : null;
        identities.set(id, asset && asset.fileKey === fileKey ? asset : null);
      }
      const keyOf = (kind, collectionRole, role) => {
        const asset = identities.get(triple(kind, collectionRole, role));
        return asset ? asset.key : null;
      };
      const actual = (entry, asset) => {
        const light = asset.modes
          ? asset.modes.filter((item) => item.name === "Light")
          : [];
        if (entry.kind === "collection") {
          const single = asset.modes.length === 1 && light.length === 1;
          return asset.name === entry.collectionRole && single
            ? { kind: "collection", modeName: "Light" }
            : null;
        }
        if (entry.kind === "effect-style") {
          const effects = asset.valueOrEffects.effects;
          const exact =
            asset.name === "Shadow/Primary" &&
            sameValue(effects, [expected.expectedPrimaryEffect]);
          return exact ? { kind: "effects", effects } : null;
        }
        const side = entry.collectionRole;
        const values = asset.valueOrEffects.valuesByMode;
        const value = light.length === 1 ? values[light[0].modeId] : null;
        const want =
          side === "Brand"
            ? { kind: "rgba", rgba: expected.expectedRoleValues[entry.role] }
            : {
                kind: "alias",
                variableKey: keyOf("variable", "Brand", entry.role),
              };
        const exact =
          asset.name === `primary/${entry.role}` &&
          asset.resolvedType === "COLOR" &&
          asset.collectionKey === keyOf("collection", side, null) &&
          value &&
          sameValue(value, want);
        return exact ? value : null;
      };
      managedAssets = plan.managedAssets.map((entry) => {
        const id = triple(entry.kind, entry.collectionRole, entry.role);
        const asset = identities.get(id);
        const value = asset ? actual(entry, asset) : null;
        if (!value) {
          error(
            asset
              ? "MANAGED_ASSET_MISMATCH"
              : "CREATED_ASSET_IDENTITY_UNRESOLVED",
            id,
          );
          return entry;
        }
        if (entry.kind === "variable") exactColors += 1;
        if (entry.kind === "effect-style") exactPrimaryEffects += 1;
        return Object.assign({}, entry, {
          key: asset.key,
          localId: asset.localId,
          collectionKey: asset.collectionKey,
          lastWrittenValue: value,
          verifiedValue: value,
          lastVerifiedRunId: plan.runId,
        });
      });
    }

    const done = attempt.completedActions;
    const imported = new Set();
    for (const item of done) {
      if (item.readBack.importedAssetKey) {
        imported.add(item.readBack.importedAssetKey);
      }
    }
    const applied = done.filter((item) => item.result === "applied");
    const created = applied.filter((item) =>
      plan.actions.some(
        (action) =>
          action.actionId === item.actionId &&
          /^create-/.test(action.operation),
      ),
    );
    const verification = {
      exactColors,
      exactPrimaryEffects,
      remainingBaseBrandSlots,
      sourceKeysPreserved,
      brokenInstances,
      protectedChanges: changes.inside,
      outsideScopeChanges: changes.outside,
      unresolved,
      unsupported,
      coverage: after.coverage,
      sourceSemanticCoverage: semantic,
      errors,
    };
    if (errors.length > 0) {
      return { status: "failed", verification, receipt: null };
    }
    const header = {
      runId: plan.runId,
      generatedAt: attempt.generatedAt,
      project: plan.project,
      tool: plan.tool,
    };
    const receipt = Object.assign(contract.stamp("receipt", header), {
      status: "verified",
      verifiedFor: expected.target,
      targetFileKey: fileKey,
      lastRunScope: plan.scope,
      planDigest,
      beforeDigest: digest(before),
      afterDigest,
      previousReceiptDigest: plan.inputDigests.previousReceipt,
      publicationEvidence: expected.publicationEvidence,
      acceptanceEvidence: expected.acceptanceEvidence,
      identityMap: plan.identityMap,
      identityReviewDigest: plan.inputDigests.identityReview,
      brand: {
        inputDigest: plan.project.brandInputDigest,
        projectionDigest: expected.brandProjectionDigest,
        sourceGitCommit: plan.project.gitCommit,
      },
      releasedSlots: plan.releasedSlots,
      managedSlots,
      managedAssets,
      changes: {
        planned: plan.actions.length,
        applied: applied.length,
        recoveredAlreadyApplied:
          expected.recoveredAlreadyApplied + done.length - applied.length,
        createdAssets: created.length,
        importedAssets: imported.size,
      },
      verification,
    });
    return {
      status: "verified",
      verification,
      receipt: contract.validateArtifact(receipt),
    };
  }

  return { verifySync };
}
