/**
 * 每個 slot 的來源對照:依祖先來源脈絡讀出來源節點同位置的綁定與 alias 鏈,組成 sourceMatch。
 * 來源端的解析失敗(alias cycle、缺 mode、缺目標、讀不到 style)不會被吞掉:
 * 對照改為 unresolved、保留已讀到的鏈作為證據,並另列 SOURCE_* issue。會被序列化進 Figma 執行。
 */
export function createSourceSlots(figma, assets, source) {
  /** 回傳 {fields, issue}:fields 併入 sourceMatch;issue 不為 null 時須列入 inventory.issues。 */
  async function paintMatch(context, node, prop, field, index, shape) {
    if (!shape) return { fields: undefined, issue: null };
    if (!shape.aligned) {
      const reason = shape.shape
        ? "PAINT_SHAPE_CONFLICT"
        : "UNSUPPORTED_BINDING";
      return {
        fields: { status: "unresolved", paintShape: shape.shape, reason },
        issue: null,
      };
    }
    const read = await assets.paintValue(context.sourceNode[prop][index]);
    // 來源也依 consumer 節點實際生效的 mode 解析
    const chain = read.variable
      ? await assets.resolveChain(read.variable, node)
      : { aliasChain: [], code: null };
    const code =
      read.value.kind === "missing" ? "VARIABLE_MISSING" : chain.code;
    const sourceSlot = {
      field,
      index,
      bindingKey: read.variable ? read.variable.key : null,
      aliasChain: chain.aliasChain,
    };
    if (!code) {
      return { fields: { paintShape: shape.shape, sourceSlot }, issue: null };
    }
    return {
      fields: {
        status: "unresolved",
        paintShape: shape.shape,
        sourceSlot,
        reason: `SOURCE_${code}`,
      },
      issue: {
        code: `SOURCE_${code}`,
        assetKey: sourceSlot.bindingKey,
        detail: "來源節點的變數或 alias 無法解析",
      },
    };
  }

  async function styleMatch(context) {
    const node = context.sourceNode;
    const read = "effectStyleId" in node ? await assets.styleValue(node) : null;
    const sourceSlot = {
      field: "effect-style",
      index: null,
      bindingKey: read && read.style ? read.style.key : null,
      aliasChain: [],
    };
    if (!read || read.style) return { fields: { sourceSlot }, issue: null };
    const code =
      read.value.kind === "mixed"
        ? "SOURCE_UNSUPPORTED_BINDING"
        : "SOURCE_STYLE_MISSING";
    return {
      fields: { status: "unresolved", sourceSlot, reason: code },
      issue: {
        code,
        assetKey: null,
        detail: "來源節點的 effect style 無法讀取",
      },
    };
  }

  /** 組出 sourceMatch,並把來源端的問題寫進 issues(帶 consumer 的 locator)。 */
  async function match(context, fileKey, locator, issues, read) {
    const resolved = context && context.status !== "unresolved";
    const result = resolved ? await read() : { fields: undefined, issue: null };
    if (result.issue) {
      const issue = {
        code: result.issue.code,
        locator,
        detail: result.issue.detail,
      };
      if (result.issue.assetKey) issue.assetKey = result.issue.assetKey;
      issues.push(issue);
    }
    return source.matchOf(context, fileKey, result.fields);
  }

  return { paintMatch, styleMatch, match };
}
