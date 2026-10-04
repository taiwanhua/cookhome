/**
 * consumer 補套規劃的組裝:核對輸入、建立規劃狀態,交給來源 guards 與 ownership 規則逐一判定,再輸出 plan。
 * parts={guards,ownership} 由呼叫端建立後注入。只認精確 key 與已審查的 selections;名稱、HEX 相同都不構成身分。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createConsumerPlanner(contract, parts) {
  const { fail, digest, slotKey, sameValue } = contract;
  const { guards, ownership } = parts;

  function planConsumer(input) {
    const { request, identityReview: review } = input;
    const { base, brand, consumer } = input.inventories;
    const prior = input.previousReceipt || null;
    const upgrade = input.verificationTarget === "library-upgrade";
    if (!upgrade && input.verificationTarget !== "brand-bindings") {
      fail("VERIFICATION_TARGET_INVALID");
    }
    const fileKey = consumer.observedFileKey;
    if (
      request.target.fileKey !== fileKey ||
      !sameValue(request.target.rootNodeIds, consumer.scope.rootNodeIds)
    ) {
      fail("SCOPE_MISMATCH");
    }
    const digests = {
      base: digest(base),
      brand: digest(brand),
      consumer: digest(consumer),
    };
    const reviewed = review.inventoryDigests;
    const stale =
      reviewed.base !== digests.base ||
      reviewed.brand !== digests.brand ||
      (reviewed.consumer !== null && reviewed.consumer !== digests.consumer);
    if (stale) fail("REVIEW_STALE");
    if (prior && prior.targetFileKey !== fileKey) fail("RECEIPT_FOREIGN");

    const nodes = contract.indexNodes(consumer);
    const state = {
      request,
      review,
      consumer,
      upgrade,
      digests,
      nodes,
      priorDigest: prior ? digest(prior) : null,
      roots: new Set(consumer.scope.rootNodeIds),
      liveNodes: new Set(),
      sourceSelection: new Map(),
      projectRole: new Map(),
      priorSourceRole: new Map(),
      baseAssets: contract.indexAssets(base),
      brandAssets: contract.indexAssets(brand),
      priorManaged: new Map(),
      priorReleased: new Map(),
      resolutions: new Map(),
      recovered: new Map(),
      seen: new Set(),
      actions: [],
      preserved: [],
      conflicts: [],
      managed: new Map(),
      released: new Map(),
      recoveredCount: 0,
    };
    for (const selection of review.selections) {
      state.sourceSelection.set(selection.source.key, selection);
      state.projectRole.set(selection.project.key, selection.role);
    }
    for (const identity of prior ? prior.identityMap : []) {
      state.priorSourceRole.set(identity.source.key, identity.role);
    }
    for (const slot of prior ? prior.managedSlots : []) {
      state.priorManaged.set(slotKey(slot.locator), slot);
    }
    for (const slot of prior ? prior.releasedSlots : []) {
      state.priorReleased.set(slotKey(slot.locator), slot);
      state.released.set(slotKey(slot.locator), slot);
    }
    for (const resolution of review.resolutions) {
      state.resolutions.set(slotKey(resolution.locator), resolution);
    }
    for (const item of input.reconciliation
      ? input.reconciliation.actions
      : []) {
      state.recovered.set(slotKey(item.action.locator), item);
    }

    // 品牌庫現值必須已等於程式推導;否則先 plan-brand,不在 consumer 端另填色
    const projection = request.brandProjection;
    const reviewedIdentities = review.selections.map((selection) => {
      const isStyle = selection.assetKind === "effect-style";
      const asset = state.brandAssets.get(
        `${selection.assetKind}:${selection.project.key}`,
      );
      const chain = isStyle
        ? { chain: [], value: asset.valueOrEffects }
        : contract.resolveAssetChain(state.brandAssets, selection.project.key);
      const matches = isStyle
        ? sameValue(chain.value.effects, [projection.primaryEffect])
        : sameValue(chain.value.rgba, projection.primary[selection.role]);
      if (!matches) {
        state.conflicts.push({
          code: "BRAND_LIBRARY_MISMATCH",
          locator: null,
          observed: { key: selection.project.key, role: selection.role },
          expected: null,
          resolutionRequired: true,
        });
      }
      return {
        role: selection.role,
        assetKind: selection.assetKind,
        source: selection.source,
        project: selection.project,
        aliasChain: chain.chain,
        reviewEvidenceURL: review.reviewEvidenceURL,
      };
    });
    // 對照與受管 slots 一樣累積;本輪審查只取代同一來源身分,其餘保留原證據。
    // 分類與寫入仍只使用上方 review.selections,不以歷史對照自動擴大本輪授權。
    const identityKey = (item) =>
      `${item.assetKind}:${item.source.fileKey}:${item.source.key}`;
    const renewed = new Set(reviewedIdentities.map(identityKey));
    const identityMap = (prior ? prior.identityMap : [])
      .filter((item) => !renewed.has(identityKey(item)))
      .concat(reviewedIdentities);

    // 範圍內的節點與用到的元件 key 取自完整的 nodes,不靠有沒有可補套的 slot
    const usedComponents = new Set();
    for (const node of consumer.nodes) {
      if (node.scopeRootId !== null) state.liveNodes.add(node.nodeId);
    }
    const inScope = consumer.slots.filter((slot) =>
      state.liveNodes.has(slot.locator.nodeId),
    );
    for (const slot of inScope) {
      state.seen.add(slotKey(slot.locator));
      const match = slot.sourceMatch;
      if (match.componentKey) usedComponents.add(match.componentKey);
      for (const step of match.ancestryPath) {
        if (step.nestedComponentKey) {
          usedComponents.add(step.nestedComponentKey);
        }
      }
    }
    state.tombstoneRoots = ownership.tombstoneRoots(state);
    for (const slot of inScope) ownership.classifySlot(state, slot);
    ownership.settleMissing(state);

    // 掃描時留下的問題不靜默略過
    const identityKeys = new Set();
    for (const selection of review.selections) {
      identityKeys.add(selection.source.key);
      identityKeys.add(selection.project.key);
    }
    const managedKeys = new Set(state.managed.keys());
    for (const issue of consumer.issues) {
      if (contract.blockingIssue(issue, identityKeys, managedKeys)) {
        state.conflicts.push({
          code: issue.code,
          locator: issue.locator || null,
          observed: issue.detail,
          expected: null,
          resolutionRequired: true,
        });
      }
    }
    const withEvidence =
      upgrade || request.publicationEvidence || request.acceptanceEvidence;
    if (withEvidence) {
      const found = guards.evidenceConflicts(
        request,
        base,
        consumer,
        usedComponents,
      );
      for (const item of found) state.conflicts.push(item);
    }

    const actionKeys = new Set(
      state.actions.map((action) => slotKey(action.locator)),
    );
    const status =
      state.conflicts.length > 0
        ? "blocked"
        : state.actions.length > 0
          ? "ready"
          : "noop";
    return contract.validateArtifact(
      Object.assign(contract.stamp("plan", request), {
        status,
        targetKind: "consumer",
        scope: consumer.scope,
        inputDigests: {
          inventories: [digests.base, digests.brand, digests.consumer],
          identityReview: digest(review),
          previousReceipt: state.priorDigest,
          plan: input.resumePlan ? digest(input.resumePlan) : null,
        },
        identityMap,
        actions: state.actions,
        preserved: state.preserved,
        conflicts: state.conflicts,
        managedSlots: Array.from(state.managed.values()),
        releasedSlots: Array.from(state.released.values()),
        managedAssets: prior ? prior.managedAssets : [],
        verification: {
          target: input.verificationTarget,
          expectedRoleValues: projection.primary,
          expectedPrimaryEffect: projection.primaryEffect,
          protectedBefore: contract.scopeGuard(consumer, actionKeys, null),
          outsideScopeControls: contract.controlGuard(consumer),
          brandProjectionDigest: digest(projection),
          publicationEvidence: request.publicationEvidence,
          acceptanceEvidence: request.acceptanceEvidence,
          recoveredAlreadyApplied: state.recoveredCount,
        },
      }),
    );
  }

  return { planConsumer };
}
