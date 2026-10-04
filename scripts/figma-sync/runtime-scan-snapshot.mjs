/**
 * 節點的受保護觀測:每個走訪到的節點都有一筆(不論有沒有可補套的 slot),純圖片、空 fills、
 * container 的 visible / geometry / nested swap 才驗得到。另保存 page 與祖先鏈作為範圍證據。
 * 會被序列化進 Figma 執行。
 */
export function createNodeSnapshots(figma, assets) {
  const GEOMETRY = [
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "cornerRadius",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "itemSpacing",
    "strokeWeight",
  ];

  function paintViews(paints) {
    if (paints === figma.mixed) return "mixed";
    if (!Array.isArray(paints)) return null;
    return paints.map((paint) => ({
      type: paint.type,
      visible: paint.visible !== false,
      opacity: typeof paint.opacity === "number" ? paint.opacity : 1,
      blendMode: paint.blendMode || "NORMAL",
      imageHash: paint.imageHash || null,
      gradientStops: Array.isArray(paint.gradientStops)
        ? paint.gradientStops.map((stop) => ({
            position: stop.position,
            color: assets.rgba(stop.color, 1),
          }))
        : null,
    }));
  }

  /**
   * SOLID paint 的色與綁定、effect style 不在這裡(它們是 slot.value,由 action 精確比對),
   * 其餘 paint 欄位、文字、圖片 hash、visible、nested main、幾何與未套 style 的 raw effects 都在。
   */
  async function snapshot(node) {
    const geometry = {};
    for (const name of GEOMETRY) {
      geometry[name] = typeof node[name] === "number" ? node[name] : null;
    }
    const main =
      node.type === "INSTANCE" ? await node.getMainComponentAsync() : null;
    const styled =
      typeof node.effectStyleId === "string" && node.effectStyleId !== "";
    return {
      nodeType: node.type,
      visible: node.visible !== false,
      characters: node.type === "TEXT" ? node.characters : null,
      mainComponentKey: main ? main.key : null,
      childCount: Array.isArray(node.children) ? node.children.length : 0,
      geometry,
      fills: paintViews(node.fills),
      strokes: paintViews(node.strokes),
      effects:
        styled || !Array.isArray(node.effects)
          ? null
          : assets.effectsView(node.effects),
    };
  }

  /** inventory.nodes 的一筆;ancestorIds 由近到遠,最後一個是 page。 */
  async function observe(node, scopeRootId) {
    const ancestorIds = [];
    let pageId = null;
    for (let up = node.parent; up; up = up.parent) {
      if (up.type === "DOCUMENT") break;
      ancestorIds.push(up.id);
      if (up.type === "PAGE") pageId = up.id;
    }
    return {
      nodeId: node.id,
      pageId: pageId || node.id,
      scopeRootId,
      ancestorIds,
      protectedSnapshot: await snapshot(node),
    };
  }

  return { snapshot, observe };
}
