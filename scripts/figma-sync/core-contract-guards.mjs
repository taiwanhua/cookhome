/**
 * 建立在基本值運算之上的兩組 helpers,依 operation 組裝:
 * createGuardValues:slot / 資產索引、綁定值比對,以及 plan / apply 先驗 / after 驗證共用的 scope guards(apply 的生成碼需要);
 * createPlanningValues:alias 解析、artifact 表頭、範圍證據與 issue 判定(只有 Node 端的規劃與驗證使用)。
 * 無 Node / Figma import;會被序列化進 Figma 執行,依賴只來自參數。
 */
export function createGuardValues(values) {
  const { digest, sameValue } = values;

  /** slot 唯一鍵:fileKey+nodeId+field+index;rootInstanceId 只是路徑證據。 */
  const slotKey = (locator) =>
    [locator.fileKey, locator.nodeId, locator.field, locator.index].join("|");

  /** 綁定值只比 kind 與跨檔身分 key;本地 ID 只負責定位。 */
  function valueMatches(observed, expected) {
    if (!observed || !expected || observed.kind !== expected.kind) return false;
    if (observed.kind === "variable" || observed.kind === "style") {
      return observed.key === expected.key;
    }
    if (observed.kind === "fixed") {
      return sameValue(observed.rgba, expected.rgba);
    }
    return true;
  }

  function indexBy(items, keyOf) {
    const index = new Map();
    for (const item of items) index.set(keyOf(item), item);
    return index;
  }
  const indexAssets = (inventory) =>
    indexBy(inventory.assets, (asset) => `${asset.kind}:${asset.key}`);
  const indexSlots = (inventory) =>
    indexBy(inventory.slots, (slot) => slotKey(slot.locator));
  const indexNodes = (inventory) =>
    indexBy(inventory.nodes, (node) => node.nodeId);

  /**
   * 整個 scope 的 guard:每個節點的 protected snapshot 與路徑、非 action slot 的現值 / alias / 來源對照、
   * issues 與 capabilities。action 自己的 slot 由逐筆 before / expectedAfter 判定,不在這裡。
   * 品牌庫另含非 action 的本檔資產(excludedAssetKeys 不為 null 時)。
   */
  function scopeGuard(inventory, actionKeys, excludedAssetKeys) {
    const nodes = inventory.nodes.filter((node) => node.scopeRootId !== null);
    const inside = new Set(nodes.map((node) => node.nodeId));
    const slots = inventory.slots.filter(
      (slot) =>
        inside.has(slot.locator.nodeId) &&
        !actionKeys.has(slotKey(slot.locator)),
    );
    const assets = excludedAssetKeys
      ? inventory.assets.filter(
          (asset) =>
            asset.fileKey === inventory.observedFileKey &&
            !excludedAssetKeys.has(asset.key),
        )
      : [];
    return {
      nodes: nodes.length,
      digest: digest({
        nodes: nodes.map((node) => [
          node.nodeId,
          node.scopeRootId,
          node.ancestorIds,
          node.protectedSnapshot,
        ]),
        slots: slots.map((slot) => [
          slotKey(slot.locator),
          slot.value,
          slot.aliasChain,
          slot.sourceMatch,
        ]),
        assets: assets.map((asset) => [asset.kind, asset.key, asset]),
        issues: inventory.issues.map((issue) => [
          issue.code,
          issue.locator ? slotKey(issue.locator) : null,
          issue.assetKey || null,
        ]),
        capabilities: inventory.capabilities,
      }),
    };
  }

  /** scope 外控制節點的 guard:明列抽樣節點的 snapshot 與 slot 現值。 */
  function controlGuard(inventory) {
    const nodes = inventory.nodes.filter((node) => node.scopeRootId === null);
    const outside = new Set(nodes.map((node) => node.nodeId));
    const slots = inventory.slots.filter((slot) =>
      outside.has(slot.locator.nodeId),
    );
    return {
      controls: nodes.length,
      digest: digest({
        nodes: nodes.map((node) => [node.nodeId, node.protectedSnapshot]),
        slots: slots.map((slot) => [slotKey(slot.locator), slot.value]),
      }),
    };
  }

  return {
    slotKey,
    valueMatches,
    indexAssets,
    indexSlots,
    indexNodes,
    scopeGuard,
    controlGuard,
  };
}

export function createPlanningValues(values, guards) {
  const { fail, has } = values;
  const { slotKey } = guards;
  const MAX_ALIAS_DEPTH = 8;

  /** 以 Library inventory 內的資產解析 alias 到實際來源;cycle、缺 mode、深度超限、缺目標皆失敗。 */
  function resolveAssetChain(assets, startKey) {
    const chain = [];
    const seen = new Set();
    let key = startKey;
    for (;;) {
      if (seen.has(key)) fail("ALIAS_CYCLE", startKey);
      if (chain.length >= MAX_ALIAS_DEPTH) {
        fail("ALIAS_DEPTH_EXCEEDED", startKey);
      }
      seen.add(key);
      const asset = key === null ? undefined : assets.get(`variable:${key}`);
      if (!asset) fail("ALIAS_TARGET_MISSING", startKey);
      const modeId = asset.valueOrEffects.defaultModeId;
      const values = asset.valueOrEffects.valuesByMode;
      if (!modeId || !has(values, modeId)) fail("ALIAS_MODE_MISSING", key);
      const value = values[modeId];
      const target = value.kind === "alias" ? value.variableKey : null;
      if (value.kind !== "alias" && value.kind !== "rgba") {
        fail("ALIAS_VALUE_UNSUPPORTED", key);
      }
      chain.push({
        variableKey: key,
        collectionKey: asset.collectionKey,
        modeId,
        resolvedType: asset.resolvedType,
        aliasTargetKey: target,
      });
      if (value.kind === "rgba") return { chain, terminalKey: key, value };
      key = target;
    }
  }

  /** alias 鏈的身分:逐步的 variable key 與它指向的 key(mode / collection 的本地 ID 不參與)。 */
  const chainKeys = (aliasChain) =>
    aliasChain.map((step) => [step.variableKey, step.aliasTargetKey]);

  const stamp = (kind, header) => ({
    schemaVersion: 1,
    kind,
    runId: header.runId,
    generatedAt: header.generatedAt,
    project: header.project,
    tool: header.tool,
  });

  /** 由 inventory.nodes 產生持久的範圍證據;判斷日後消失的節點屬範圍內或外。 */
  function scopeEvidenceOf(nodes, nodeId) {
    const node = nodes.get(nodeId);
    return {
      pageId: node.pageId,
      scopeRootId: node.scopeRootId,
      ancestorIds: node.ancestorIds,
    };
  }

  /** 掃描時留下、不能靜默略過的問題:全域問題、alias / 讀取錯誤、或涉及已審 key / 受管 slot 者。 */
  function blockingIssue(issue, identityKeys, managedKeys) {
    return Boolean(
      (!issue.locator && !issue.assetKey) ||
      /^(ALIAS_|SOURCE_|VARIABLE_MISSING|STYLE_MISSING)/.test(issue.code) ||
      (issue.assetKey && identityKeys.has(issue.assetKey)) ||
      (issue.locator && managedKeys.has(slotKey(issue.locator))),
    );
  }

  return {
    resolveAssetChain,
    chainKeys,
    stamp,
    scopeEvidenceOf,
    blockingIssue,
  };
}
