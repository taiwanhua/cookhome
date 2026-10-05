/**
 * 逐筆 action 的分類規則,由 core-recovery.mjs 的 reconcileInterruptedPlan 以 state={plan,inventory,readBacks,outcomes,result} 呼叫。
 * createSceneClassifier:consumer 的場景 action,比 slot 現值、來源對照與 protected 欄位。
 * createAssetClassifier:品牌庫的資產 action。本 plan 新建的資產沒有 before:只有現值仍是建立初值、且原 attempt 沒有該筆
 * 寫入的 readBack 才算 pending,已寫入後被改成第三值是 conflict,不會被覆寫;create 已發生卻沒有 readBack 身分時回
 * CREATED_ASSET_IDENTITY_UNRESOLVED,不按名稱認養。無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createSceneClassifier(contract) {
  const { digest, slotKey, valueMatches } = contract;

  return function begin(state) {
    const { result } = state;
    const slots = contract.indexSlots(state.inventory);

    return function classifyScene(action) {
      const slot = slots.get(slotKey(action.locator));
      if (!slot) return result(action, "conflict", "SLOT_MISSING");
      const guards =
        digest(slot.sourceMatch) === action.preconditions.sourceMatchDigest &&
        digest(slot.protectedSnapshot) === action.preconditions.protectedDigest;
      if (valueMatches(slot.value, action.before)) {
        return guards
          ? result(action, "pending", null, slot.value)
          : result(action, "conflict", "STALE_GUARD", slot.value);
      }
      if (guards && valueMatches(slot.value, action.expectedAfter)) {
        return result(action, "already-applied", null, slot.value, {
          value: slot.value,
          importedAssetKey: null,
        });
      }
      return result(action, "conflict", "THIRD_VALUE", slot.value);
    };
  };
}

export function createAssetClassifier(contract) {
  const { sameValue } = contract;
  const CREATE_KIND = {
    "create-collection": "collection",
    "create-variable": "variable",
    "create-effect-style": "effect-style",
  };
  // Plugin API 建立資產時的已知初值:COLOR 變數為不透明白、effect style 沒有 effects
  const INITIAL_VARIABLE = { kind: "rgba", rgba: { r: 1, g: 1, b: 1, a: 1 } };
  const INITIAL_EFFECTS = { effects: [] };

  return function begin(state) {
    const { inventory, readBacks, outcomes, result } = state;
    const fileKey = state.plan.scope.fileKey;
    const assets = contract.indexAssets(inventory);
    const local = inventory.assets.filter((asset) => asset.fileKey === fileKey);

    /** 回傳資產、"pending"(前序 create 尚未執行)或 "conflict"(前序身分未解)。 */
    const resolve = (ref) => {
      if (ref.key) return assets.get(`${ref.kind}:${ref.key}`) || "conflict";
      const creator = outcomes.get(ref.actionId);
      if (creator.status === "pending") return "pending";
      if (creator.status === "conflict") return "conflict";
      return assets.get(`${ref.kind}:${creator.readBack.key}`) || "conflict";
    };
    const lightValue = (asset) => {
      const mode = asset.modes.find((item) => item.name === "Light");
      return mode ? asset.valueOrEffects.valuesByMode[mode.modeId] : null;
    };
    const settle = (action, current, expected, initial) => {
      if (sameValue(current, expected)) {
        return result(action, "already-applied", null, current, {
          value: current,
          importedAssetKey: null,
        });
      }
      const untouched =
        action.before === null
          ? !readBacks.has(action.actionId) && sameValue(current, initial)
          : sameValue(current, action.before);
      return untouched
        ? result(action, "pending", null, current)
        : result(action, "conflict", "THIRD_VALUE", current);
    };

    function classifyCreate(action) {
      const kind = CREATE_KIND[action.operation];
      const readBack = readBacks.get(action.actionId);
      if (readBack) {
        return assets.has(`${kind}:${readBack.key}`)
          ? result(action, "already-applied", null, null, readBack)
          : result(action, "conflict", "CREATED_ASSET_IDENTITY_UNRESOLVED");
      }
      const params = action.params;
      let owner = null;
      if (kind === "variable") {
        owner = resolve(params.collectionRef);
        if (owner === "conflict") {
          return result(action, "conflict", "DEPENDENCY_UNRESOLVED");
        }
      }
      const sameName = local.some(
        (asset) =>
          asset.kind === kind &&
          asset.name === params.name &&
          (kind !== "variable" ||
            (owner !== "pending" && asset.collectionKey === owner.key)),
      );
      return sameName
        ? result(action, "conflict", "CREATED_ASSET_IDENTITY_UNRESOLVED")
        : result(action, "pending");
    }

    function classifySet(action) {
      const params = action.params;
      const target = resolve(params.variableRef || params.styleRef);
      if (target === "pending") return result(action, "pending");
      if (target === "conflict") {
        return result(action, "conflict", "DEPENDENCY_UNRESOLVED");
      }
      if (action.operation === "set-effect-style-effects") {
        const current = { effects: target.valueOrEffects.effects };
        const expected = { effects: params.effects };
        return settle(action, current, expected, INITIAL_EFFECTS);
      }
      let expected = params.value;
      if (expected.kind === "alias") {
        const aliased = resolve(expected.targetRef);
        if (aliased === "conflict") {
          return result(action, "conflict", "DEPENDENCY_UNRESOLVED");
        }
        expected = {
          kind: "alias",
          variableKey: aliased === "pending" ? null : aliased.key,
        };
      }
      const current = lightValue(target);
      if (!current) {
        return result(action, "conflict", "COLLECTION_MODE_MISSING");
      }
      return settle(action, current, expected, INITIAL_VARIABLE);
    }

    return (action) =>
      CREATE_KIND[action.operation]
        ? classifyCreate(action)
        : classifySet(action);
  };
}
