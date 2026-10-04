/**
 * Plugin API 的資產讀取:變數 / alias / mode / style / publication owner,以及 exact import。無場景寫入。
 * 本地 ID 只負責檔內定位,跨檔身分一律是 key;遠端資產在本檔讀不到來源 fileKey,記 null 由 Library inventory 對照。
 * 會被序列化進 Figma 執行,語法維持 ES2017。
 */
// core 依固定接縫注入;資產讀取不需要協定運算,本檔目前不直接取用
export function createAssetRuntime(figma, core) {
  const MAX_ALIAS_DEPTH = 8;
  let variables = new Map();
  let collections = new Map();
  let styles = new Map();
  let seen = new Map();

  function reset() {
    variables = new Map();
    collections = new Map();
    styles = new Map();
    seen = new Map();
  }

  const fileKey = () =>
    typeof figma.fileKey === "string" && figma.fileKey ? figma.fileKey : null;
  const rgba = (color, alpha) => ({
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" ? color.a : alpha,
  });

  async function cached(store, id, read) {
    if (!store.has(id)) {
      let value = null;
      try {
        value = (await read(id)) || null;
      } catch (error) {
        value = null;
      }
      store.set(id, value);
    }
    return store.get(id);
  }
  const variable = (id) =>
    cached(variables, id, (key) => figma.variables.getVariableByIdAsync(key));
  const collection = (id) =>
    cached(collections, id, (key) =>
      figma.variables.getVariableCollectionByIdAsync(key),
    );
  const style = (id) =>
    cached(styles, id, (key) => figma.getStyleByIdAsync(key));

  function effectsView(effects) {
    return effects.map((effect) => {
      const view = {
        type: effect.type,
        radius: effect.radius,
        visible: effect.visible,
      };
      if (effect.color) view.color = rgba(effect.color, 1);
      if (effect.offset)
        view.offset = { x: effect.offset.x, y: effect.offset.y };
      if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
        view.spread = typeof effect.spread === "number" ? effect.spread : 0;
        view.blendMode = effect.blendMode;
      }
      return view;
    });
  }
  const effectBindings = (effects) =>
    effects.filter(
      (effect) =>
        effect.boundVariables && Object.keys(effect.boundVariables).length > 0,
    ).length;

  async function valueView(value) {
    if (value && value.type === "VARIABLE_ALIAS") {
      const target = await variable(value.id);
      return { kind: "alias", variableKey: target ? target.key : null };
    }
    if (value && typeof value === "object" && typeof value.r === "number") {
      return { kind: "rgba", rgba: rgba(value, 1) };
    }
    return { kind: "other" };
  }

  async function describeCollection(item) {
    const entry = {
      kind: "collection",
      fileKey: item.remote ? null : fileKey(),
      key: item.key,
      localId: item.id,
      name: item.name,
      resolvedType: null,
      collectionKey: item.key,
      modes: item.modes.map((mode) => ({
        modeId: mode.modeId,
        name: mode.name,
      })),
      valueOrEffects: { defaultModeId: item.defaultModeId },
    };
    seen.set(`collection:${item.key}`, entry);
    return entry;
  }

  async function describeVariable(item) {
    const id = `variable:${item.key}`;
    if (seen.has(id)) return seen.get(id);
    const owner = await collection(item.variableCollectionId);
    const valuesByMode = {};
    for (const modeId of Object.keys(item.valuesByMode)) {
      valuesByMode[modeId] = await valueView(item.valuesByMode[modeId]);
    }
    const entry = {
      kind: "variable",
      fileKey: item.remote ? null : fileKey(),
      key: item.key,
      localId: item.id,
      name: item.name,
      resolvedType: item.resolvedType,
      collectionKey: owner ? owner.key : null,
      modes: owner
        ? owner.modes.map((mode) => ({ modeId: mode.modeId, name: mode.name }))
        : [],
      valueOrEffects: {
        defaultModeId: owner ? owner.defaultModeId : null,
        valuesByMode,
      },
    };
    seen.set(id, entry);
    return entry;
  }

  function describeStyle(item) {
    const entry = {
      kind: "effect-style",
      fileKey: item.remote ? null : fileKey(),
      key: item.key,
      localId: item.id,
      name: item.name,
      resolvedType: "EFFECT",
      collectionKey: null,
      modes: null,
      valueOrEffects: {
        effects: effectsView(item.effects),
        boundEffects: effectBindings(item.effects),
      },
    };
    seen.set(`effect-style:${item.key}`, entry);
    return entry;
  }

  /**
   * 依節點實際生效的 mode 逐步解析 alias 到實際來源。
   * cycle、缺值、缺 mode、深度超限都回 issue,不靜默取預設。
   */
  async function resolveChain(start, node) {
    const aliasChain = [];
    const visited = new Set();
    const modes = (node && node.resolvedVariableModes) || {};
    let current = start;
    for (;;) {
      if (visited.has(current.id))
        return { aliasChain, resolved: null, code: "ALIAS_CYCLE" };
      if (aliasChain.length >= MAX_ALIAS_DEPTH) {
        return { aliasChain, resolved: null, code: "ALIAS_DEPTH_EXCEEDED" };
      }
      visited.add(current.id);
      await describeVariable(current);
      const owner = await collection(current.variableCollectionId);
      const modeId = owner ? modes[owner.id] || owner.defaultModeId : null;
      const raw = modeId ? current.valuesByMode[modeId] : undefined;
      const isAlias = raw && raw.type === "VARIABLE_ALIAS";
      const target = isAlias ? await variable(raw.id) : null;
      aliasChain.push({
        variableKey: current.key,
        collectionKey: owner ? owner.key : null,
        modeId: modeId || null,
        resolvedType: current.resolvedType,
        aliasTargetKey: target ? target.key : null,
      });
      if (raw === undefined) {
        return { aliasChain, resolved: null, code: "ALIAS_MODE_MISSING" };
      }
      if (!isAlias) {
        return typeof raw === "object" && typeof raw.r === "number"
          ? {
              aliasChain,
              resolved: { kind: "rgba", rgba: rgba(raw, 1) },
              code: null,
            }
          : { aliasChain, resolved: null, code: "ALIAS_VALUE_UNSUPPORTED" };
      }
      if (!target)
        return { aliasChain, resolved: null, code: "ALIAS_TARGET_MISSING" };
      current = target;
    }
  }

  /** SOLID paint 的現值:固定色或變數綁定(找不到變數時為 missing)。 */
  async function paintValue(paint) {
    const bound = paint.boundVariables && paint.boundVariables.color;
    if (!bound)
      return {
        value: { kind: "fixed", rgba: rgba(paint.color, 1) },
        variable: null,
      };
    const item = await variable(bound.id);
    if (!item) return { value: { kind: "missing" }, variable: null };
    return {
      value: {
        kind: "variable",
        key: item.key,
        localId: item.id,
        remote: item.remote,
      },
      variable: item,
    };
  }

  /** 節點 effect style 的現值;沒有套 style 回 null。 */
  async function styleValue(node) {
    const id = node.effectStyleId;
    if (id === figma.mixed) return { value: { kind: "mixed" }, style: null };
    if (typeof id !== "string" || id === "") return null;
    const item = await style(id);
    if (!item) return { value: { kind: "missing" }, style: null };
    describeStyle(item);
    return {
      value: {
        kind: "style",
        key: item.key,
        localId: item.id,
        remote: item.remote,
      },
      style: item,
    };
  }

  /** 本檔全部 collection / variable / effect style(Library metadata 可全檔唯讀列舉)。 */
  async function listLocalAssets() {
    const capabilities = { variablesReadable: true, effectStyleReadable: true };
    try {
      for (const item of await figma.variables.getLocalVariableCollectionsAsync()) {
        collections.set(item.id, item);
        await describeCollection(item);
      }
      for (const item of await figma.variables.getLocalVariablesAsync()) {
        variables.set(item.id, item);
        await describeVariable(item);
      }
    } catch (error) {
      capabilities.variablesReadable = false;
    }
    try {
      for (const item of await figma.getLocalEffectStylesAsync()) {
        styles.set(item.id, item);
        describeStyle(item);
      }
    } catch (error) {
      capabilities.effectStyleReadable = false;
    }
    return capabilities;
  }

  const collectedAssets = () =>
    Array.from(seen.keys())
      .sort()
      .map((id) => seen.get(id));

  /** exact import:取回的資產 key 必須等於要求的 key,否則視為失敗。 */
  async function importByKey(kind, key) {
    const item =
      kind === "variable"
        ? await figma.variables.importVariableByKeyAsync(key)
        : await figma.importStyleByKeyAsync(key);
    const typed =
      kind === "variable"
        ? item && item.resolvedType === "COLOR"
        : item && item.type === "EFFECT";
    if (!item || item.key !== key || !typed)
      throw new Error("IMPORT_NOT_EXACT");
    return item;
  }

  /** 本檔資產以 key 精確尋找(品牌庫寫入用);找不到回 null。 */
  async function findLocal(kind, key) {
    const list =
      kind === "collection"
        ? await figma.variables.getLocalVariableCollectionsAsync()
        : kind === "variable"
          ? await figma.variables.getLocalVariablesAsync()
          : await figma.getLocalEffectStylesAsync();
    return list.find((item) => item.key === key) || null;
  }

  return {
    reset,
    fileKey,
    rgba,
    variable,
    collection,
    effectsView,
    effectBindings,
    describeVariable,
    resolveChain,
    paintValue,
    styleValue,
    listLocalAssets,
    collectedAssets,
    importByKey,
    findLocal,
  };
}
