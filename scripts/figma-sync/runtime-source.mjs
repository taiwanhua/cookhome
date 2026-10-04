/**
 * Source correspondence:instance root 對自己的 main component,沿實際 child-index 路徑逐層比 type / child count。
 * consumer 與 source 皆為 nested INSTANCE 且 actual main key 相同時,保留祖先來源樹中的 source instance context
 *(來源元件自己施加的 inherited override 才不會被誤認為專案客製);key 不同才視為 swap,改以 consumer 的 actual main 為新來源範圍。
 * 指定的 scope root 位於 instance 內部時,從最外層可讀的祖先 instance 建立脈絡再走到該 root,祖先只讀。
 * 不解析 instance ID 字串、不按名稱或同形配對;無法確認一律 unresolved。會被序列化進 Figma 執行。
 */
// figma / core 依固定接縫注入;來源對照只走呼叫端交進來的節點,本檔目前兩者都不必直接取用
export function createSourceRuntime(figma, core) {
  const childrenOf = (node) =>
    Array.isArray(node.children) ? node.children : [];
  const unresolved = (context, reason) =>
    Object.assign({}, context, {
      status: "unresolved",
      sourceNode: null,
      reason,
    });

  /** 頂層 instance 的來源範圍;main 取不到(broken)時整棵子樹 unresolved。 */
  function rootContext(instance, main) {
    const context = {
      status: "exact-root",
      rootInstanceId: instance.id,
      componentKey: main ? main.key : null,
      sourceNode: main,
      ancestryPath: [],
      swaps: [],
      reason: null,
    };
    return main ? context : unresolved(context, "BROKEN_INSTANCE");
  }

  /** 往下一層:第 index 個 child 對來源同 index 的 child,type 與雙方 child count 都要相符。 */
  async function descend(context, parent, index, child) {
    if (context.status === "unresolved") return context;
    const source = context.sourceNode;
    const sourceChildren = childrenOf(source);
    const sourceChild = sourceChildren[index];
    const step = {
      consumerParentId: parent.id,
      sourceParentId: source.id,
      childIndex: index,
      consumerType: child.type,
      sourceType: sourceChild ? sourceChild.type : null,
      consumerChildCount: childrenOf(parent).length,
      sourceChildCount: sourceChildren.length,
      nestedComponentKey: null,
    };
    const next = Object.assign({}, context, {
      status: "validated-structure",
      ancestryPath: context.ancestryPath.concat([step]),
    });
    const aligned =
      sourceChild &&
      step.consumerChildCount === step.sourceChildCount &&
      child.type === sourceChild.type;
    if (!aligned) return unresolved(next, "STRUCTURE_MISMATCH");
    next.sourceNode = sourceChild;
    if (child.type !== "INSTANCE") return next;
    const actual = await child.getMainComponentAsync();
    const inherited = await sourceChild.getMainComponentAsync();
    if (!actual || !inherited) return unresolved(next, "BROKEN_INSTANCE");
    step.nestedComponentKey = actual.key;
    if (actual.key !== inherited.key) {
      // 使用者 swap:來源範圍改為 consumer 的 actual main,並記下前後來源
      next.sourceNode = actual;
      next.swaps = context.swaps.concat([
        {
          kind: "instance-swap",
          nodeId: child.id,
          sourceComponentKey: inherited.key,
          consumerComponentKey: actual.key,
        },
      ]);
    }
    return next;
  }

  /**
   * 任意節點的來源脈絡:找出最外層的祖先 instance,從它的 main 沿實際 child-index 走到該節點。
   * 節點本身不在任何 instance 內時回 null(由呼叫端在遇到 instance 時建立 rootContext)。
   * 以內部節點縮小 scope 不會因此退回孤立 master 或被當成 NOT_IN_INSTANCE。
   */
  async function contextFor(node) {
    const chain = [];
    let outermost = -1;
    for (let up = node; up && up.type !== "PAGE"; up = up.parent) {
      chain.unshift(up);
    }
    for (let i = 0; i < chain.length - 1; i += 1) {
      if (chain[i].type === "INSTANCE") {
        outermost = i;
        break;
      }
    }
    if (outermost < 0) return null;
    const instance = chain[outermost];
    let context = rootContext(instance, await instance.getMainComponentAsync());
    for (let i = outermost; i < chain.length - 1; i += 1) {
      const parent = chain[i];
      const child = chain[i + 1];
      const index = childrenOf(parent).indexOf(child);
      context = await descend(context, parent, index, child);
    }
    return context;
  }

  /** paint 只有 count 與逐項 type 一致才可按 index 對應。 */
  function paintShape(consumerPaints, sourcePaints) {
    const usable = Array.isArray(consumerPaints) && Array.isArray(sourcePaints);
    if (!usable) return { shape: null, aligned: false };
    const shape = {
      consumerCount: consumerPaints.length,
      sourceCount: sourcePaints.length,
      consumerPaintTypes: consumerPaints.map((paint) => paint.type),
      sourcePaintTypes: sourcePaints.map((paint) => paint.type),
    };
    const aligned =
      shape.consumerCount === shape.sourceCount &&
      shape.consumerPaintTypes.every(
        (type, index) => type === shape.sourcePaintTypes[index],
      );
    return { shape, aligned };
  }

  /** raw inventory 的 sourceMatch:三個 digest 一律 null,由 review / plan 在複本上補引用。 */
  function matchOf(context, fileKey, fields) {
    const base = {
      status: context ? context.status : "unresolved",
      componentKey: context ? context.componentKey : null,
      nodeContextFileKey: fileKey,
      sourceNodeId:
        context && context.sourceNode ? context.sourceNode.id : null,
      ancestryPath: context ? context.ancestryPath : [],
      paintShape: null,
      sourceSlot: null,
      sourceInventoryDigest: null,
      consumerInventoryDigest: null,
      previousReceiptDigest: null,
      reason: context ? context.reason : "NOT_IN_INSTANCE",
    };
    return Object.assign(base, fields || {});
  }

  return { rootContext, descend, contextFor, paintShape, matchOf };
}
