/**
 * 測試用的 fake Figma:可執行真 runtime 與生成碼的 Plugin API 子集(節點樹、變數、style、import、寫入紀錄)。
 * 只用 Node 內建模組;fake 不能充當真發布 / 搬檔證據。
 */
class FakeNode {
  constructor(world, fileKey, spec) {
    const { fills, strokes, effectStyleId = "", children, ...rest } = spec;
    Object.assign(this, { visible: true, x: 0, y: 0, width: 100, height: 40 });
    Object.assign(this, rest);
    Object.defineProperties(this, {
      world: { value: world },
      parent: { value: null, writable: true },
      state: { value: { fills, strokes, effectStyleId } },
    });
    this.fileKey = fileKey;
    if (children) this.children = [];
    world.nodes.set(this.id, this);
    for (const child of children ?? []) this.append(child);
  }
  append(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  get remote() {
    return this.fileKey !== this.world.viewer;
  }
  get fills() {
    return this.state.fills;
  }
  set fills(value) {
    this.world.mutate({ type: "scene", nodeId: this.id, prop: "fills" });
    this.state.fills = value;
  }
  get strokes() {
    return this.state.strokes;
  }
  set strokes(value) {
    this.world.mutate({ type: "scene", nodeId: this.id, prop: "strokes" });
    this.state.strokes = value;
  }
  get effectStyleId() {
    return this.state.effectStyleId;
  }
  async setEffectStyleIdAsync(id) {
    this.world.mutate({ type: "scene", nodeId: this.id, prop: "effectStyle" });
    this.state.effectStyleId = id;
  }
  async getMainComponentAsync() {
    return this.mainComponent ?? null;
  }
  async getPublishStatusAsync() {
    return this.publishStatus ?? "CURRENT";
  }
  getStyledTextSegments() {
    return this.segments ?? [];
  }
  getRangeAllFontNames() {
    return this.fonts ?? [];
  }
  async loadAsync() {}
  toJSON() {
    return { id: this.id, type: this.type };
  }
}

/** 一個 world = 多個 Figma 檔與它們之間已發布的 Library 資產。 */
export function createWorld() {
  const world = {
    mixed: Symbol("figma.mixed"),
    viewer: null,
    files: new Map(),
    nodes: new Map(),
    variables: new Map(),
    collections: new Map(),
    styles: new Map(),
    mutations: [],
    writes: { scene: 0, asset: 0, import: 0 },
    // 測試用故障注入:{ scene: 3 } 表示第 4 次場景寫入時丟例外
    failAfter: {},
    createWithoutKey: null,
    // 測試用:新建資產回報的 key(模擬超出支援範圍的身分);null 表示正常流水號
    createdKey: null,
    // 測試用:每次寫入完成後呼叫(模擬 apply 進行中有人改動檔案)
    afterWrite: null,
    missingFonts: new Set(),
    serial: 0,
    pageSwitches: 0,
  };
  const remote = (item) => ({
    get() {
      return item.fileKey !== world.viewer;
    },
    enumerable: true,
  });
  world.mutate = (entry) => {
    if (world.writes[entry.type] === world.failAfter[entry.type]) {
      throw new Error("fake: 寫入中斷");
    }
    world.writes[entry.type] += 1;
    world.mutations.push(entry);
    if (world.afterWrite) world.afterWrite(entry);
  };
  world.count = (type) =>
    world.mutations.filter((entry) => entry.type === type).length;
  world.resetLog = () => {
    world.mutations.length = 0;
    world.writes = { scene: 0, asset: 0, import: 0 };
    world.failAfter = {};
  };
  world.nextKey = (prefix) => {
    world.serial += 1;
    return `${prefix}${String(world.serial).padStart(4, "0")}`;
  };
  world.addFile = (fileKey, pageNames = ["Page 1"]) => {
    const pages = pageNames.map((name, index) =>
      world.node(fileKey, {
        id: `P${fileKey}:${index}`,
        type: "PAGE",
        name,
        children: [],
      }),
    );
    world.files.set(fileKey, { fileKey, pages });
    return pages;
  };
  world.node = (fileKey, spec) => new FakeNode(world, fileKey, spec);
  world.addCollection = (fileKey, name, modeNames = ["Mode 1"]) => {
    const key =
      world.createWithoutKey === "collection"
        ? ""
        : (world.createdKey ?? world.nextKey("ck"));
    const id = `VariableCollectionId:${world.nextKey("c")}`;
    const item = {
      id,
      key,
      name,
      fileKey,
      modes: modeNames.map((mode, index) => ({
        modeId: `${id}/m${index}`,
        name: mode,
      })),
      renameMode(modeId, value) {
        this.modes.find((mode) => mode.modeId === modeId).name = value;
      },
    };
    item.defaultModeId = item.modes[0].modeId;
    Object.defineProperty(item, "remote", remote(item));
    world.collections.set(id, item);
    return item;
  };
  world.addVariable = (fileKey, name, collection, values = {}) => {
    const key =
      world.createWithoutKey === "variable"
        ? ""
        : (world.createdKey ?? world.nextKey("vk"));
    const item = {
      id: `VariableID:${world.nextKey("v")}`,
      key,
      name,
      fileKey,
      resolvedType: "COLOR",
      variableCollectionId: collection.id,
      valuesByMode: { [collection.defaultModeId]: { r: 1, g: 1, b: 1, a: 1 } },
      setValueForMode(modeId, value) {
        world.mutate({ type: "asset", key: this.key, op: "set-value" });
        this.valuesByMode[modeId] = value;
      },
    };
    Object.assign(item.valuesByMode, values);
    Object.defineProperty(item, "remote", remote(item));
    world.variables.set(item.id, item);
    return item;
  };
  world.addStyle = (fileKey, name, effects = []) => {
    const key =
      world.createWithoutKey === "effect-style"
        ? ""
        : (world.createdKey ?? world.nextKey("sk"));
    const state = { effects };
    const item = {
      id: `S:${world.nextKey("s")}`,
      key,
      name,
      fileKey,
      type: "EFFECT",
      get effects() {
        return state.effects;
      },
      set effects(value) {
        world.mutate({ type: "asset", key: this.key, op: "set-effects" });
        state.effects = value;
      },
    };
    Object.defineProperty(item, "remote", remote(item));
    world.styles.set(item.id, item);
    return item;
  };
  return world;
}

/** 指定檔案視角的 Plugin API。options.fileKey 可模擬 fileKey 不可讀(null)或回報別的檔。 */
export function createFakeFigma(world, fileKey, options = {}) {
  const file = world.files.get(fileKey);
  const local = (store) =>
    Array.from(store.values()).filter((item) => item.fileKey === fileKey);
  const published = (store, key) => {
    const item = Array.from(store.values()).find(
      (candidate) => candidate.key === key && !candidate.unpublished,
    );
    if (!item) throw new Error("fake: 找不到已發布資產");
    world.mutate({ type: "import", key });
    return item;
  };
  const api = {
    mixed: world.mixed,
    skipInvisibleInstanceChildren: true,
    get fileKey() {
      world.viewer = fileKey;
      return "fileKey" in options ? options.fileKey : fileKey;
    },
    root: { id: "0:0", type: "DOCUMENT", children: file.pages },
    get currentPage() {
      return file.currentPage ?? file.pages[0];
    },
    async setCurrentPageAsync(page) {
      world.pageSwitches += 1;
      file.currentPage = page;
    },
    async getNodeByIdAsync(id) {
      const node = world.nodes.get(id);
      return node && node.fileKey === fileKey ? node : null;
    },
    async getStyleByIdAsync(id) {
      return world.styles.get(id) ?? null;
    },
    async getLocalEffectStylesAsync() {
      return local(world.styles);
    },
    async importStyleByKeyAsync(key) {
      return published(world.styles, key);
    },
    createEffectStyle() {
      world.mutate({ type: "asset", op: "create-effect-style" });
      return world.addStyle(fileKey, "");
    },
    async loadFontAsync(font) {
      if (world.missingFonts.has(font.family)) throw new Error("fake: 缺字型");
    },
    variables: {
      async getVariableByIdAsync(id) {
        return world.variables.get(id) ?? null;
      },
      async getVariableCollectionByIdAsync(id) {
        return world.collections.get(id) ?? null;
      },
      async getLocalVariablesAsync() {
        return local(world.variables);
      },
      async getLocalVariableCollectionsAsync() {
        return local(world.collections);
      },
      async importVariableByKeyAsync(key) {
        return published(world.variables, key);
      },
      setBoundVariableForPaint(paint, field, variable) {
        return {
          ...paint,
          boundVariables: {
            ...paint.boundVariables,
            [field]: { type: "VARIABLE_ALIAS", id: variable.id },
          },
        };
      },
      createVariableAlias(variable) {
        return { type: "VARIABLE_ALIAS", id: variable.id };
      },
      createVariableCollection(name) {
        world.mutate({ type: "asset", op: "create-collection" });
        return world.addCollection(fileKey, name);
      },
      createVariable(name, collection) {
        world.mutate({ type: "asset", op: "create-variable" });
        return world.addVariable(fileKey, name, collection);
      },
    },
  };
  // 每次呼叫都切到本檔視角(remote 是相對於呼叫端檔案的屬性)
  const enter = (target) => {
    for (const [name, value] of Object.entries(target)) {
      if (typeof value !== "function") continue;
      target[name] = (...args) => {
        world.viewer = fileKey;
        return value.apply(target, args);
      };
    }
  };
  enter(api);
  enter(api.variables);
  world.viewer = fileKey;
  return api;
}
