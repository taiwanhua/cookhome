/**
 * 場景寫入(consumer 的補套):只寫 roots 與其後代,且只動指定 paint 的 color 綁定或 effectStyleId,其他欄位原樣保留。
 * prepare 在任何寫入前確認每個節點在 scope 內、字型可載入、匯入的專案資產實際值仍是 plan 的品牌推導;
 * write 逐筆寫前只重掃該節點再驗一次,寫入後讀回。回傳 begin(run),由 runtime-apply.mjs 的 executor 呼叫。
 * 會被序列化進 Figma 執行。
 */
export function createSceneWriter(figma, core, assets, scanScope) {
  async function readSlot(node, locator) {
    if (locator.field === "effect-style") {
      const read = await assets.styleValue(node);
      return read ? read.value : { kind: "missing" };
    }
    const paints = node[locator.field === "fill-color" ? "fills" : "strokes"];
    const paint = Array.isArray(paints) ? paints[locator.index] : null;
    if (!paint || paint.type !== "SOLID") return { kind: "missing" };
    return (await assets.paintValue(paint)).value;
  }

  return function begin(run) {
    const { request, plan, fileKey, roots, near, coded } = run;
    const nodes = new Map();
    const imported = new Map();
    const refOf = (action) =>
      action.params.variableRef || action.params.styleRef;
    const matches = (observed, expected) =>
      observed.kind === expected.kind &&
      (observed.kind === "fixed"
        ? near(observed.rgba, expected.rgba)
        : observed.key === expected.key);

    /** 回傳 null,或第一個不能開始寫入的原因 {code,detail}。 */
    async function prepare(scene) {
      for (const action of scene) {
        const node = await figma.getNodeByIdAsync(action.locator.nodeId);
        let inScope = false;
        for (let up = node; up; up = up.parent) {
          if (roots.includes(up.id)) inScope = true;
        }
        if (!inScope) return { code: "OUT_OF_SCOPE", detail: action.actionId };
        if (node.type === "TEXT" && action.locator.field !== "effect-style") {
          // 文字 paint 寫入前載入需要的字型;缺字型失敗,不代換
          try {
            if (node.hasMissingFont) throw coded("FONT_MISSING");
            const fonts =
              node.fontName === figma.mixed
                ? node.getRangeAllFontNames(0, node.characters.length)
                : [node.fontName];
            for (const font of fonts) await figma.loadFontAsync(font);
          } catch (error) {
            return { code: "FONT_MISSING", detail: action.actionId };
          }
        }
        nodes.set(action.actionId, node);
      }
      const expected = plan.verification;
      for (const action of scene) {
        const ref = refOf(action);
        if (imported.has(ref.key)) continue;
        let item;
        try {
          item = await assets.importByKey(ref.kind, ref.key);
        } catch (error) {
          return { code: "IMPORT_FAILED", detail: action.actionId };
        }
        // 要寫入的專案資產:匯入後的實際值必須仍是 plan 的品牌推導,否則不開始寫場景
        const actual =
          ref.kind === "variable"
            ? (await assets.resolveChain(item, nodes.get(action.actionId)))
                .resolved
            : { kind: "effects", effects: assets.effectsView(item.effects) };
        const wanted =
          ref.kind === "variable"
            ? { kind: "rgba", rgba: expected.expectedRoleValues[action.role] }
            : { kind: "effects", effects: [expected.expectedPrimaryEffect] };
        if (!near(actual, wanted)) {
          return {
            code: "STALE_PLAN",
            detail: `${action.actionId} ASSET_VALUE`,
          };
        }
        imported.set(ref.key, item);
      }
      return null;
    }

    /** 每筆寫前再驗:只重掃該節點,value、來源對照與 protected 欄位都要仍是 plan 的 before。 */
    async function guard(action) {
      const scoped = Object.assign({}, request, {
        target: { fileKey, rootNodeIds: [action.locator.nodeId] },
      });
      const inventory = await scanScope(scoped, { controls: false });
      const single = Object.assign({}, plan, {
        status: "ready",
        conflicts: [],
        actions: [action],
      });
      const verdict = core.reconcileInterruptedPlan({
        plan: single,
        inventory,
        attempt: null,
      }).actions[0];
      if (verdict.status !== "pending") throw coded("STALE_PLAN");
    }

    async function write(action) {
      const node = nodes.get(action.actionId);
      const locator = action.locator;
      const ref = refOf(action);
      await guard(action);
      run.touch();
      if (locator.field === "effect-style") {
        await node.setEffectStyleIdAsync(imported.get(ref.key).id);
      } else {
        const prop = locator.field === "fill-color" ? "fills" : "strokes";
        const paints = node[prop].slice();
        paints[locator.index] = figma.variables.setBoundVariableForPaint(
          paints[locator.index],
          "color",
          imported.get(ref.key),
        );
        node[prop] = paints;
      }
      const value = await readSlot(node, locator);
      if (!matches(value, action.expectedAfter)) {
        throw coded("WRITE_VERIFY_FAILED");
      }
      return { value, importedAssetKey: ref.key };
    }

    return { prepare, write };
  };
}
