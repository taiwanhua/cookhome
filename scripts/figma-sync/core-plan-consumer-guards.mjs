/**
 * consumer 規劃的來源 guards:來源對照能否用於受管、既有受管 slot 的來源漂移、library-upgrade 的證據涵蓋,
 * 以及消失節點是否屬於本次範圍。只認精確 key、完整祖先來源鏈與 alias 鏈;同名同形不構成身分。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createConsumerGuards(contract) {
  const { sameValue, valueMatches, chainKeys } = contract;

  /** 來源可用於受管:結構已驗,或不在任何 instance 內的 direct binding(僅 brand-bindings)。 */
  function sourceProblem(slot, upgrade) {
    const match = slot.sourceMatch;
    if (match.status !== "unresolved") return null;
    if (match.reason !== "NOT_IN_INSTANCE") return match.reason;
    return upgrade ? "SOURCE_MATCH_UNSUPPORTED" : null;
  }

  /**
   * 既有受管 slot 是否仍可沿用登記;回傳 conflict code 或 null。
   * 來源由 main 改 light 時,即使現值等於上次工具值、最外層 binding key 沒變,也要列 SOURCE_ROLE_DRIFT:
   * 比對 alias 鏈,以及同一把 key 在前次與本次已審對照中的角色。
   */
  function managedDrift(state, slot, before) {
    const match = slot.sourceMatch;
    const source = before.source;
    const direct = before.sourceMatchStatus === "direct-binding";
    const sourceSlot = match.sourceSlot;
    if (!valueMatches(slot.value, before.lastWrittenValue)) {
      return "MANAGED_VALUE_CHANGED";
    }
    if (sourceProblem(slot, state.upgrade) || direct !== !sourceSlot) {
      return "SOURCE_MATCH_UNSUPPORTED";
    }
    const written = before.lastWrittenValue.key;
    if (state.projectRole.get(written) !== before.role) {
      return "SOURCE_ROLE_DRIFT";
    }
    if (direct) return null;
    const sameIdentity =
      match.componentKey === source.componentKey &&
      match.sourceNodeId === source.sourceNodeId &&
      sameValue(match.ancestryPath, source.ancestryPath);
    if (!sameIdentity) return "SOURCE_IDENTITY_CHANGED";
    const key = source.bindingKey;
    const selected = key ? state.sourceSelection.get(key) : undefined;
    const sameSemantics =
      sourceSlot.bindingKey === key &&
      sameValue(
        chainKeys(sourceSlot.aliasChain),
        chainKeys(source.aliasChain),
      ) &&
      (selected ? selected.role : undefined) ===
        (key ? state.priorSourceRole.get(key) : undefined);
    return sameSemantics ? null : "SOURCE_ROLE_DRIFT";
  }

  /**
   * 既有登記的節點這次掃不到時,它是否屬於本次範圍:看保存的祖先鏈有沒有本次的 root 或範圍內仍存在的節點。
   * 不能因為現在找不到 node 就當成 scope 外。
   */
  function vanishedInScope(state, evidence) {
    return (
      state.consumer.scope.pageIds.includes(evidence.pageId) &&
      evidence.ancestorIds.some(
        (id) => state.roots.has(id) || state.liveNodes.has(id),
      )
    );
  }

  /** library-upgrade 必須有涵蓋本次 file、資產與 scope 的發布 / 接受證據。 */
  function evidenceConflicts(request, base, consumer, usedKeys) {
    const publication = request.publicationEvidence;
    const acceptance = request.acceptanceEvidence;
    if (!publication || !acceptance) {
      return [
        {
          code: "EVIDENCE_REQUIRED",
          locator: null,
          observed: null,
          expected: null,
          resolutionRequired: true,
        },
      ];
    }
    const conflicts = [];
    const add = (code, observed) =>
      conflicts.push({
        code,
        locator: null,
        observed,
        expected: null,
        resolutionRequired: true,
      });
    const files =
      publication.sourceFileKey === base.observedFileKey &&
      acceptance.sourceFileKey === base.observedFileKey &&
      acceptance.consumerFileKey === consumer.observedFileKey;
    if (!files) add("EVIDENCE_FILE_MISMATCH", null);
    const roots = consumer.scope.rootNodeIds;
    const covered =
      roots.every((id) => acceptance.rootNodeIds.includes(id)) ||
      consumer.scope.pageIds.every((id) => acceptance.pageIds.includes(id));
    if (!covered) add("EVIDENCE_SCOPE_MISMATCH", roots);
    const ownerOf = new Map();
    for (const owner of base.publicationOwners) {
      ownerOf.set(owner.componentKey, owner.ownerKey);
    }
    const listed = (list, key) =>
      list.includes(key) || list.includes(ownerOf.get(key));
    const missing = Array.from(usedKeys)
      .filter(
        (key) =>
          listed(publication.changedAssetKeys, key) &&
          !listed(acceptance.acceptedAssetKeys, key),
      )
      .sort();
    if (missing.length > 0) add("PARTIAL_ACCEPTANCE", missing);
    return conflicts;
  }

  return { sourceProblem, managedDrift, vanishedInScope, evidenceConflicts };
}
