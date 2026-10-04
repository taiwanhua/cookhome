/**
 * 資產寫入(品牌庫的集合 / 變數 / effect style):新建後必須讀得到真身分才繼續,不按名稱尋找、也不再建一份;
 * 既有 key 的更新寫前再驗 before,寫入後讀回。回傳 begin(run),由 runtime-apply.mjs 的 executor 呼叫。
 * 會被序列化進 Figma 執行。
 */
export function createAssetWriter(figma, assets) {
  // 新建身分的支援範圍(傳輸 trace 以此上界預留);範圍外視為身分未解
  const IDENTITY = /^[A-Za-z0-9:_./;-]+$/;
  const bounded = (value, limit) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= limit &&
    IDENTITY.test(value);

  return function begin(run) {
    const { near, coded } = run;
    const created = new Map();
    const identity = (action, kind, item, defaultModeId) => {
      const known =
        item &&
        bounded(item.key, 64) &&
        bounded(item.id, 128) &&
        (defaultModeId === null || bounded(defaultModeId, 64));
      // 建立後讀不到(或超出支援範圍的)真身分就停:不按名稱尋找,也不再建一份
      if (!known) throw coded("CREATED_ASSET_IDENTITY_UNRESOLVED");
      const readBack = { kind, key: item.key, localId: item.id, defaultModeId };
      created.set(action.actionId, readBack);
      return readBack;
    };
    const resolveRef = async (ref) => {
      if (ref.key) {
        const found = await assets.findLocal(ref.kind, ref.key);
        if (!found) throw coded("STALE_PLAN");
        return found;
      }
      const readBack = created.get(ref.actionId);
      if (!readBack) throw coded("CREATED_ASSET_IDENTITY_UNRESOLVED");
      const item =
        ref.kind === "collection"
          ? await figma.variables.getVariableCollectionByIdAsync(
              readBack.localId,
            )
          : ref.kind === "variable"
            ? await figma.variables.getVariableByIdAsync(readBack.localId)
            : await figma.getStyleByIdAsync(readBack.localId);
      if (!item || item.key !== readBack.key) {
        throw coded("CREATED_ASSET_IDENTITY_UNRESOLVED");
      }
      return item;
    };

    async function write(action) {
      const params = action.params;
      if (action.operation === "create-collection") {
        run.touch();
        const item = figma.variables.createVariableCollection(params.name);
        item.renameMode(item.modes[0].modeId, params.modeName);
        const single =
          item.modes.length === 1 && item.modes[0].name === params.modeName;
        if (!single) throw coded("WRITE_VERIFY_FAILED");
        return identity(action, "collection", item, item.defaultModeId);
      }
      if (action.operation === "create-variable") {
        const owner = await resolveRef(params.collectionRef);
        run.touch();
        const item = figma.variables.createVariable(
          params.name,
          owner,
          params.resolvedType,
        );
        return identity(action, "variable", item, null);
      }
      if (action.operation === "create-effect-style") {
        run.touch();
        const item = figma.createEffectStyle();
        item.name = params.name;
        return identity(action, "effect-style", item, null);
      }
      if (action.operation === "set-effect-style-effects") {
        const item = await resolveRef(params.styleRef);
        const current = { effects: assets.effectsView(item.effects) };
        if (action.before !== null && !near(current, action.before)) {
          throw coded("STALE_PLAN");
        }
        run.touch();
        item.effects = params.effects;
        const effects = assets.effectsView(item.effects);
        if (!near(effects, params.effects)) throw coded("WRITE_VERIFY_FAILED");
        return { value: { effects }, importedAssetKey: null };
      }
      const item = await resolveRef(params.variableRef);
      const owner = await resolveRef(params.collectionRef);
      // modeName 對應該集合的實際 mode ID,不跨集合沿用
      const mode = owner.modes.find((entry) => entry.name === params.modeName);
      if (!mode || item.variableCollectionId !== owner.id) {
        throw coded("STALE_PLAN");
      }
      const view = async (raw) => {
        if (!raw || raw.type !== "VARIABLE_ALIAS") {
          return { kind: "rgba", rgba: assets.rgba(raw, 1) };
        }
        const aliased = await figma.variables.getVariableByIdAsync(raw.id);
        return { kind: "alias", variableKey: aliased ? aliased.key : null };
      };
      const target =
        params.value.kind === "alias"
          ? await resolveRef(params.value.targetRef)
          : null;
      const wanted = target
        ? { kind: "alias", variableKey: target.key }
        : params.value;
      // 既有 key 的更新:寫前再驗 before(rgba 與 alias 都驗);本 plan 新建者沒有 before
      const current = await view(item.valuesByMode[mode.modeId]);
      if (action.before !== null && !near(current, action.before)) {
        throw coded("STALE_PLAN");
      }
      run.touch();
      item.setValueForMode(
        mode.modeId,
        target
          ? figma.variables.createVariableAlias(target)
          : params.value.rgba,
      );
      const value = await view(item.valuesByMode[mode.modeId]);
      if (!near(value, wanted)) throw coded("WRITE_VERIFY_FAILED");
      return { value, importedAssetKey: null };
    }

    // 資產寫入沒有需要事先完成的檢查:相依與 before 都在逐筆寫前驗
    return { prepare: async () => null, write };
  };
}
