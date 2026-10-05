/**
 * consumer 規劃的 ownership 與 resolution 規則:逐一判定每個 slot 是寫入、沿用受管、釋出、保留或衝突。
 * 工具 ownership 只來自既有 receipt、已驗的恢復證據或 fresh adopt-source resolution;
 * 現值恰好是專案 key、HEX 相同或來源對照吻合都不足以自動收管。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createOwnershipRules(contract, guards) {
  const { digest, slotKey, sameValue } = contract;

  const observation = (state, slot) => ({
    value: slot.value,
    sourceMatchDigest: digest(slot.sourceMatch),
    consumerInventoryDigest: state.digests.consumer,
  });
  const conflict = (state, code, slot, expected) =>
    state.conflicts.push({
      code,
      locator: slot.locator,
      observed: observation(state, slot),
      expected: expected === undefined ? null : expected,
      resolutionRequired: true,
    });
  const keep = (state, slot, reason) =>
    state.preserved.push({
      locator: slot.locator,
      reason,
      snapshotDigest: digest(slot.protectedSnapshot),
    });
  /** 寫入後的值型別由 field 決定:paint 一律是 variable、effect style 一律是 style。 */
  const writtenValue = (slot, selection) => ({
    kind: slot.locator.field === "effect-style" ? "style" : "variable",
    key: selection.project.key,
  });
  /** 新 locator 是否位於某個消失釋出項仍存續的祖先之下(這種位置不自動收管)。 */
  const underTombstone = (state, locator) =>
    state.nodes
      .get(locator.nodeId)
      .ancestorIds.concat(
        locator.rootInstanceId ? [locator.rootInstanceId] : [],
      )
      .some((id) => state.tombstoneRoots.has(id));

  function manage(state, slot, selection, boundBaseKey) {
    const match = slot.sourceMatch;
    const sourceSlot = match.sourceSlot;
    const key = slotKey(slot.locator);
    const before = state.priorManaged.get(key);
    state.managed.set(key, {
      locator: slot.locator,
      role: selection.role,
      scopeEvidence: contract.scopeEvidenceOf(state.nodes, slot.locator.nodeId),
      source: {
        fileKey: selection.source.fileKey,
        componentKey: match.componentKey,
        nodeContextFileKey: match.nodeContextFileKey,
        sourceNodeId: match.sourceNodeId,
        ancestryPath: match.ancestryPath,
        field: slot.locator.field,
        index: slot.locator.index,
        bindingKey: sourceSlot ? sourceSlot.bindingKey : boundBaseKey,
        aliasChain: sourceSlot ? sourceSlot.aliasChain : slot.aliasChain,
      },
      lastWrittenValue: writtenValue(slot, selection),
      verifiedValue: null,
      sourceMatchStatus:
        match.status === "unresolved" ? "direct-binding" : match.status,
      firstManagedRunId: before
        ? before.firstManagedRunId
        : state.request.runId,
      lastVerifiedRunId: null,
    });
  }

  function write(state, slot, selection, boundBaseKey) {
    const isStyle = slot.locator.field === "effect-style";
    const ref = {
      kind: isStyle ? "effect-style" : "variable",
      key: selection.project.key,
    };
    const matchDigest = digest(slot.sourceMatch);
    state.actions.push({
      actionId: `set:${slotKey(slot.locator)}`,
      locator: slot.locator,
      operation: isStyle ? "set-effect-style" : "set-paint-variable",
      params: isStyle ? { styleRef: ref } : { variableRef: ref },
      role: selection.role,
      sourceEvidence: {
        sourceMatchDigest: matchDigest,
        sourceMatch: Object.assign({}, slot.sourceMatch, {
          consumerInventoryDigest: state.digests.consumer,
          previousReceiptDigest: state.priorDigest,
        }),
      },
      before: slot.value,
      expectedAfter: writtenValue(slot, selection),
      preconditions: {
        value: slot.value,
        sourceMatchDigest: matchDigest,
        protectedDigest: digest(slot.protectedSnapshot),
      },
    });
    manage(state, slot, selection, boundBaseKey);
  }

  function release(state, locator, evidence, resolution, reason) {
    state.released.set(slotKey(locator), {
      locator,
      scopeEvidence: evidence,
      previousReceiptDigest: state.priorDigest,
      resolutionEvidenceURL: state.review.reviewEvidenceURL,
      reason,
      reviewedValue: resolution.before,
      sourceMatchDigest: resolution.sourceMatchDigest,
      releasedRunId: state.request.runId,
    });
  }

  /** 明示決定:綁定本次掃描、實際 before 與來源對照 digest;過期或無法確認來源仍阻擋。 */
  function resolve(state, slot, resolution, facts) {
    const key = slotKey(slot.locator);
    const fresh =
      resolution.consumerInventoryDigest === state.digests.consumer &&
      sameValue(resolution.before, slot.value) &&
      resolution.sourceMatchDigest === digest(slot.sourceMatch);
    if (!fresh) return conflict(state, "RESOLUTION_STALE", slot);
    if (resolution.decision === "preserve-project") {
      const evidence = contract.scopeEvidenceOf(
        state.nodes,
        slot.locator.nodeId,
      );
      release(state, slot.locator, evidence, resolution, "preserve-project");
      return keep(state, slot, "released");
    }
    // 採來源:有可靠的來源 slot 時,唯一候選是它已審的角色,不退回 consumer 現在綁的舊角色;
    // 只有沒有 counterpart 的 direct binding(僅 brand-bindings)才以現在綁的已審 key 確認
    const candidate = slot.sourceMatch.sourceSlot
      ? facts.sourceBound
      : facts.boundSelection;
    const adopted =
      candidate && candidate.role === resolution.expectedRole
        ? candidate
        : undefined;
    const problem = guards.sourceProblem(slot, state.upgrade);
    if (!adopted || problem) {
      return conflict(state, problem || "RESOLUTION_ROLE_UNCONFIRMED", slot);
    }
    const kind = slot.value.kind;
    if (facts.bound === adopted.project.key) {
      state.released.delete(key);
      return manage(state, slot, adopted, adopted.source.key);
    }
    // 固定色、底座 key 或其他變數都能依 field 重新綁成 variable / style;mixed / missing 不支援
    if (kind === "mixed" || kind === "missing") {
      return conflict(state, "UNSUPPORTED_BINDING", slot);
    }
    state.released.delete(key);
    return write(state, slot, adopted, facts.bound || adopted.source.key);
  }

  function classifySlot(state, slot) {
    const key = slotKey(slot.locator);
    const match = slot.sourceMatch;
    const value = slot.value;
    const bound =
      value.kind === "variable" || value.kind === "style" ? value.key : null;
    const sourceBinding = match.sourceSlot ? match.sourceSlot.bindingKey : null;
    const facts = {
      bound,
      boundSelection: bound ? state.sourceSelection.get(bound) : undefined,
      sourceBound: sourceBinding
        ? state.sourceSelection.get(sourceBinding)
        : undefined,
    };
    const before = state.priorManaged.get(key);
    const resolution = state.resolutions.get(key);
    if (resolution) return resolve(state, slot, resolution, facts);
    if (state.released.has(key)) return keep(state, slot, "released");
    if (before) {
      const code = guards.managedDrift(state, slot, before);
      if (code) {
        conflict(state, code, slot, {
          lastWrittenValue: before.lastWrittenValue,
          role: before.role,
          sourceBindingKey: before.source.bindingKey,
        });
      }
      // 未解衝突時保留原登記;plan 為 blocked,不會據此寫成功狀態
      state.managed.set(
        key,
        code ? before : Object.assign({}, before, { lastVerifiedRunId: null }),
      );
      return undefined;
    }
    const resumed = state.recovered.get(key);
    if (resumed && resumed.status === "conflict") {
      return conflict(state, "RESUME_CONFLICT", slot);
    }
    if (facts.boundSelection) {
      const problem = guards.sourceProblem(slot, state.upgrade);
      if (underTombstone(state, slot.locator)) {
        return conflict(state, "RELEASED_IDENTITY_UNRESOLVED", slot);
      }
      if (problem) return conflict(state, problem, slot);
      return write(state, slot, facts.boundSelection, bound);
    }
    if (bound && state.projectRole.has(bound)) {
      // 沒有 receipt 的專案 key:只有原 plan 的恢復證據(expectedAfter + guards)能證明是工具寫的
      if (!resumed || resumed.status !== "already-applied") {
        return keep(state, slot, "project-brand-binding-unowned");
      }
      const selection = state.review.selections.find(
        (item) =>
          item.project.key === bound && item.role === resumed.action.role,
      );
      if (!selection) return conflict(state, "RESUME_CONFLICT", slot);
      state.recoveredCount += 1;
      return manage(state, slot, selection, selection.source.key);
    }
    const viaAlias = slot.aliasChain
      .slice(1)
      .some((step) => state.sourceSelection.has(step.variableKey));
    if (viaAlias) return conflict(state, "BASE_BRAND_VIA_ALIAS", slot);
    if (value.kind === "mixed" || value.kind === "missing") {
      return facts.sourceBound
        ? conflict(state, "UNSUPPORTED_BINDING", slot)
        : undefined;
    }
    if (value.kind === "fixed") {
      return facts.sourceBound
        ? keep(state, slot, "custom-fixed-color")
        : undefined;
    }
    if (value.remote === false) {
      return facts.sourceBound
        ? keep(state, slot, "project-private-binding")
        : undefined;
    }
    const kind = value.kind === "style" ? "effect-style" : "variable";
    const known =
      state.baseAssets.has(`${kind}:${bound}`) ||
      state.brandAssets.has(`${kind}:${bound}`);
    return known ? undefined : conflict(state, "UNKNOWN_ASSET", slot);
  }

  /**
   * 這次掃不到的既有登記。scope 外原樣保留;範圍內消失的受管 slot 須有明示決定才釋出。
   * 釋出項消失時 tombstone 留著(經確認者記 node-missing),不因節點重建就失效。
   */
  function settleMissing(state) {
    const missing = { kind: "missing" };
    for (const [key, slot] of state.priorManaged) {
      if (state.seen.has(key)) continue;
      const resolution = state.resolutions.get(key);
      if (!guards.vanishedInScope(state, slot.scopeEvidence)) {
        state.managed.set(key, slot);
      } else if (resolution && resolution.decision === "preserve-project") {
        release(
          state,
          slot.locator,
          slot.scopeEvidence,
          resolution,
          "node-missing",
        );
      } else {
        state.managed.set(key, slot);
        state.conflicts.push({
          code: "MANAGED_SLOT_MISSING",
          locator: slot.locator,
          observed: { value: missing, sourceMatchDigest: null },
          expected: { lastWrittenValue: slot.lastWrittenValue },
          resolutionRequired: true,
        });
      }
    }
    for (const [key, slot] of state.priorReleased) {
      const resolution = state.resolutions.get(key);
      const acknowledged =
        !state.seen.has(key) &&
        resolution &&
        resolution.decision === "preserve-project";
      if (acknowledged) {
        state.released.set(
          key,
          Object.assign({}, slot, { reason: "node-missing" }),
        );
      }
    }
  }

  /**
   * 消失的釋出項各自「仍存續的最近祖先」(舊 parent 被刪就往上找,直到本次的 root)。
   * 其下新出現的底座綁定不自動收管,需要該新 locator 自己的 fresh adopt-source(或明示保留)。
   * 確認舊 locator 已不存在(node-missing)不等於同意收管新 locator,所以不因此解除。
   */
  function tombstoneRoots(state) {
    const roots = new Set();
    for (const [key, slot] of state.priorReleased) {
      const evidence = slot.scopeEvidence;
      if (state.seen.has(key)) continue;
      if (!state.consumer.scope.pageIds.includes(evidence.pageId)) continue;
      const anchor = evidence.ancestorIds.find(
        (id) => state.roots.has(id) || state.liveNodes.has(id),
      );
      if (anchor) roots.add(anchor);
    }
    return roots;
  }

  return { classifySlot, settleMissing, tombstoneRoots };
}
