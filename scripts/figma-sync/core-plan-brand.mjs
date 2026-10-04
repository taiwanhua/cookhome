/**
 * 品牌庫規劃:Brand / Color 兩個只有 Light 的集合、六個 Brand 值、六個 Color alias、一個 Shadow/Primary。
 * 值只來自 request.brandProjection;同名未登記資產阻擋,不按名稱認養。新建資產以前序 create action 的 reference 相依。
 * 無 Node / Figma import,語法維持 ES2017。
 */
export function createBrandPlanner(contract) {
  const { ROLES, SHADOW_ROLE, digest, sameValue, fail } = contract;
  const SIDES = ["Brand", "Color"];
  const STYLE_NAME = "Shadow/Primary";
  const triple = (kind, collectionRole, role) =>
    [kind, collectionRole, role].join("|");

  function planBrand(input) {
    const { request } = input;
    const brand = input.inventories.brand;
    const prior = input.previousReceipt || null;
    const fileKey = brand.observedFileKey;
    if (
      request.target.fileKey !== fileKey ||
      !sameValue(request.target.rootNodeIds, brand.scope.rootNodeIds)
    ) {
      fail("SCOPE_MISMATCH");
    }
    if (prior && prior.targetFileKey !== fileKey) fail("RECEIPT_FOREIGN");
    const projection = request.brandProjection;
    const assets = contract.indexAssets(brand);
    const local = brand.assets.filter((asset) => asset.fileKey === fileKey);
    const conflicts = [];
    const actions = [];
    const managedAssets = [];
    const block = (code, locator, observed) =>
      conflicts.push({
        code,
        locator,
        observed: observed === undefined ? null : observed,
        expected: null,
        resolutionRequired: true,
      });

    // 已登記身分:前次 receipt 的 managedAssets,加上恢復時由原 attempt readBack 確認的新建資產
    const known = new Map();
    const unresolved = new Set();
    // 恢復的新建資產:原 plan 的 set 經逐筆判定為 pending(現值是建立初值)或 already-applied 才算持有
    const recoveredExplained = new Set();
    let recoveredCount = 0;
    for (const asset of prior ? prior.managedAssets : []) {
      known.set(triple(asset.kind, asset.collectionRole, asset.role), asset);
    }
    for (const item of input.reconciliation
      ? input.reconciliation.actions
      : []) {
      const at = item.action.locator;
      const id = triple(at.assetKind, at.collectionRole, at.role);
      if (item.status === "conflict") {
        unresolved.add(id);
        block(item.code, at, item.observed);
      } else if (item.status === "already-applied") {
        recoveredCount += 1;
        if (/^create-/.test(item.action.operation)) {
          known.set(id, {
            key: item.readBack.key,
            localId: item.readBack.localId,
            lastWrittenValue: null,
            recovered: true,
            firstManagedRunId: request.runId,
          });
        }
      }
      // 原 plan 的 set 已判定為 pending 或 already-applied:恢復證據能解釋這個資產的現值
      if (item.status !== "conflict" && /^set-/.test(item.action.operation)) {
        recoveredExplained.add(id);
      }
    }

    const locatorOf = (kind, collectionRole, role, entry) => ({
      fileKey,
      assetKind: kind,
      key: entry ? entry.key : null,
      localId: entry ? entry.localId : null,
      collectionRole,
      role,
    });
    const refOf = (kind, entry, actionId) =>
      entry ? { kind, key: entry.key } : { kind, actionId };
    const lightMode = (asset) =>
      asset.modes.length === 1 && asset.modes[0].name === "Light"
        ? asset.modes[0].modeId
        : null;
    const record = (at, entry, collectionKey, lastWrittenValue) =>
      managedAssets.push({
        fileKey,
        kind: at.assetKind,
        key: at.key,
        localId: at.localId,
        role: at.role,
        collectionRole: at.collectionRole,
        collectionKey,
        lastWrittenValue,
        verifiedValue: null,
        firstManagedRunId:
          entry && entry.firstManagedRunId
            ? entry.firstManagedRunId
            : request.runId,
        lastVerifiedRunId: null,
      });
    const act = (actionId, at, operation, params, before, expectedAfter) =>
      actions.push({
        actionId,
        locator: at,
        operation,
        params,
        role: at.role,
        sourceEvidence: null,
        before,
        expectedAfter,
        preconditions: { value: before },
      });
    /** 既有登記的資產必須仍以同一把 key 存在於本檔;回傳 null 表示已記衝突。 */
    const registered = (kind, entry, at) => {
      const asset = assets.get(`${kind}:${entry.key}`);
      if (asset && asset.fileKey === fileKey) return asset;
      block("MANAGED_ASSET_MISSING", at);
      return null;
    };
    const sameName = (id, at, exists) => {
      if (exists && !unresolved.has(id)) block("UNREGISTERED_SAME_NAME", at);
      return exists;
    };
    /**
     * ownership 與是否需要寫入無關:現值必須等於上次工具寫入,或能由恢復證據解釋;
     * 否則即使它恰好等於本次要的值,也是人工改動,不悄悄收管。
     */
    const owned = (entry, current, at) => {
      const mine = entry.recovered
        ? recoveredExplained.has(
            triple(at.assetKind, at.collectionRole, at.role),
          )
        : sameValue(current, entry.lastWrittenValue);
      if (!mine) block("MANAGED_VALUE_CHANGED", at, current);
      return mine;
    };

    const collections = {};
    for (const side of SIDES) {
      const id = triple("collection", side, null);
      const entry = known.get(id) || null;
      const at = locatorOf("collection", side, null, entry);
      const createId = `create-collection:${side}`;
      let asset = null;
      if (entry) {
        asset = registered("collection", entry, at);
        if (asset && (asset.name !== side || !lightMode(asset))) {
          block("MANAGED_ASSET_CHANGED", at);
        }
      } else {
        const taken = local.some(
          (item) => item.kind === "collection" && item.name === side,
        );
        if (!sameName(id, at, taken)) {
          const params = {
            collectionRole: side,
            name: side,
            modeName: "Light",
          };
          act(createId, at, "create-collection", params, null, {
            kind: "collection",
            name: side,
            modeName: "Light",
          });
        }
      }
      collections[side] = {
        entry,
        asset,
        ref: refOf("collection", entry, createId),
      };
      record(at, entry, entry ? entry.key : null, {
        kind: "collection",
        modeName: "Light",
      });
    }

    for (const side of SIDES) {
      for (const role of ROLES) {
        const id = triple("variable", side, role);
        const entry = known.get(id) || null;
        const owner = collections[side];
        const at = locatorOf("variable", side, role, entry);
        const name = `primary/${role}`;
        const brandEntry = known.get(triple("variable", "Brand", role)) || null;
        const targetRef = refOf(
          "variable",
          brandEntry,
          `create-variable:Brand:${role}`,
        );
        const desired =
          side === "Brand"
            ? { kind: "rgba", rgba: projection.primary[role] }
            : {
                kind: "alias",
                variableKey: brandEntry ? brandEntry.key : null,
              };
        const value = side === "Brand" ? desired : { kind: "alias", targetRef };
        const createId = `create-variable:${side}:${role}`;
        const set = (variableRef, before) =>
          act(
            `set-variable-value:${side}:${role}`,
            at,
            "set-variable-value",
            { variableRef, collectionRef: owner.ref, modeName: "Light", value },
            before,
            value,
          );
        if (entry) {
          const asset = registered("variable", entry, at);
          const modeId = asset ? lightMode(asset) : null;
          const current = modeId
            ? asset.valueOrEffects.valuesByMode[modeId]
            : null;
          const intact =
            asset &&
            asset.name === name &&
            asset.resolvedType === "COLOR" &&
            owner.entry &&
            asset.collectionKey === owner.entry.key &&
            current;
          if (asset && !intact) block("MANAGED_ASSET_CHANGED", at);
          if (
            intact &&
            owned(entry, current, at) &&
            !sameValue(current, desired)
          ) {
            set({ kind: "variable", key: entry.key }, current);
          }
        } else {
          const taken =
            owner.asset !== null &&
            local.some(
              (item) =>
                item.kind === "variable" &&
                item.collectionKey === owner.asset.key &&
                item.name === name,
            );
          if (!sameName(id, at, taken)) {
            const params = {
              collectionRef: owner.ref,
              collectionRole: side,
              name,
              resolvedType: "COLOR",
            };
            act(createId, at, "create-variable", params, null, {
              kind: "variable",
              name,
              resolvedType: "COLOR",
            });
            set({ kind: "variable", actionId: createId }, null);
          }
        }
        record(at, entry, owner.entry ? owner.entry.key : null, desired);
      }
    }

    const styleId = triple("effect-style", null, SHADOW_ROLE);
    const styleEntry = known.get(styleId) || null;
    const styleAt = locatorOf("effect-style", null, SHADOW_ROLE, styleEntry);
    const effects = [projection.primaryEffect];
    const setEffects = (styleRef, before) =>
      act(
        "set-effect-style-effects",
        styleAt,
        "set-effect-style-effects",
        { styleRef, effects },
        before,
        { effects },
      );
    if (styleEntry) {
      const asset = registered("effect-style", styleEntry, styleAt);
      const current = asset ? { effects: asset.valueOrEffects.effects } : null;
      if (asset && asset.name !== STYLE_NAME) {
        block("MANAGED_ASSET_CHANGED", styleAt);
      } else if (asset) {
        const before = { kind: "effects", effects: current.effects };
        const mine = owned(styleEntry, before, styleAt);
        if (mine && !sameValue(current.effects, effects)) {
          setEffects({ kind: "effect-style", key: styleEntry.key }, current);
        }
      }
    } else {
      const taken = local.some(
        (item) => item.kind === "effect-style" && item.name === STYLE_NAME,
      );
      if (!sameName(styleId, styleAt, taken)) {
        act(
          "create-effect-style",
          styleAt,
          "create-effect-style",
          { name: STYLE_NAME },
          null,
          {
            kind: "effect-style",
            name: STYLE_NAME,
          },
        );
        setEffects(
          { kind: "effect-style", actionId: "create-effect-style" },
          null,
        );
      }
    }
    record(styleAt, styleEntry, null, { kind: "effects", effects });

    for (const issue of brand.issues) {
      if (!issue.locator && !issue.assetKey) {
        block(issue.code, null, issue.detail);
      }
    }

    const blocked = conflicts.length > 0;
    // 先驗 guard 含非本次 action 的本檔資產:規劃後被人改動就不能執行
    const targeted = new Set(
      actions.map((action) => action.locator.key).filter((key) => key !== null),
    );
    return contract.validateArtifact(
      Object.assign(contract.stamp("plan", request), {
        status: blocked ? "blocked" : actions.length > 0 ? "ready" : "noop",
        targetKind: "brand-library",
        scope: brand.scope,
        inputDigests: {
          inventories: [digest(brand)],
          identityReview: null,
          previousReceipt: prior ? digest(prior) : null,
          plan: input.resumePlan ? digest(input.resumePlan) : null,
        },
        identityMap: [],
        // 有衝突時相依圖可能不完整,blocked plan 不列 actions
        actions: blocked ? [] : actions,
        preserved: [],
        conflicts,
        managedSlots: prior ? prior.managedSlots : [],
        releasedSlots: prior ? prior.releasedSlots : [],
        managedAssets,
        verification: {
          target: "brand-bindings",
          expectedRoleValues: projection.primary,
          expectedPrimaryEffect: projection.primaryEffect,
          protectedBefore: contract.scopeGuard(brand, new Set(), targeted),
          outsideScopeControls: contract.controlGuard(brand),
          brandProjectionDigest: digest(projection),
          publicationEvidence: null,
          acceptanceEvidence: null,
          recoveredAlreadyApplied: recoveredCount,
        },
      }),
    );
  }

  return { planBrand };
}
