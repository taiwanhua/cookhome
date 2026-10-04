/**
 * 完整 scope inventory 的遍歷:roots 與所有後代(含隱藏)各一筆 node 觀測,以及 fill / stroke / effect style slots。
 * 一次 request 的 roots 限同一 page,最多切頁一次;scope 外只在同頁明列取樣控制節點(scopeRootId=null)。
 * parts={snapshots,slots} 由呼叫端建立後注入。全程唯讀。會被序列化進 Figma 執行。
 */
export function createScopeScanner(figma, core, assets, source, parts) {
  const CONTROL_LIMIT = 200;
  const PAINT_FIELDS = [
    ["fills", "fill-color"],
    ["strokes", "stroke-color"],
  ];
  const childrenOf = (node) =>
    Array.isArray(node.children) ? node.children : [];
  const pageOf = (node) => {
    let up = node;
    while (up && up.type !== "PAGE") up = up.parent;
    return up || null;
  };

  /** options.controls=false 時不取樣 scope 外控制節點(apply 逐筆寫前的小範圍重驗用)。 */
  async function scanScope(request, options) {
    assets.reset();
    const fileKey = assets.fileKey();
    const target = request.target;
    const issues = [];
    const slots = [];
    const nodes = [];
    const publicationOwners = [];
    const pageIds = [];
    const coverage = {
      nodes: 0,
      instances: 0,
      remoteInstances: 0,
      hiddenNodes: 0,
      brokenInstances: 0,
      unsupportedNodes: 0,
    };
    const capabilities = {
      fileKeyReadable: fileKey !== null,
      variablesReadable: true,
      effectStyleReadable: true,
      sourceTreeReadable: true,
    };
    const finish = () =>
      core.validateArtifact({
        schemaVersion: 1,
        kind: "inventory",
        runId: request.runId,
        generatedAt: new Date().toISOString(),
        project: request.project,
        tool: request.tool,
        observedFileKey: fileKey,
        scope: {
          fileKey: target.fileKey,
          rootNodeIds: target.rootNodeIds,
          pageIds,
          includeHidden: true,
        },
        capabilities,
        coverage,
        assets: assets.collectedAssets(),
        publicationOwners,
        slots,
        nodes,
        issues,
      });
    const stop = (code, detail) => {
      issues.push({ code, detail });
      return finish();
    };
    // v1 要求 figma.fileKey 可讀且 exact match;不設檔名或 request echo 備援
    if (fileKey !== target.fileKey) {
      return stop(
        fileKey === null ? "FILE_KEY_UNREADABLE" : "FILE_KEY_MISMATCH",
        "figma.fileKey 與 request.target.fileKey 不符,未掃描",
      );
    }
    figma.skipInvisibleInstanceChildren = false;

    const rootIds = new Set(target.rootNodeIds);
    const roots = [];
    const pages = [];
    for (const id of target.rootNodeIds) {
      const node = await figma.getNodeByIdAsync(id);
      const page = node && node.type !== "DOCUMENT" ? pageOf(node) : null;
      if (!page) return stop("ROOT_NOT_FOUND", "指定的 root 不存在");
      if (!pages.includes(page)) pages.push(page);
      let nested = false;
      for (let up = node.parent; up; up = up.parent) {
        if (rootIds.has(up.id)) nested = true;
      }
      // root 已是另一個 root 的後代時不重複掃
      if (!nested) roots.push(node);
    }
    if (pages.length !== 1) {
      return stop("ROOTS_NOT_SAME_PAGE", "一次 request 的 roots 必須在同一頁");
    }
    const page = pages[0];
    pageIds.push(page.id);
    if (figma.currentPage && figma.currentPage.id !== page.id) {
      await figma.setCurrentPageAsync(page);
    }

    const mainOf = async (node) => {
      try {
        return await node.getMainComponentAsync();
      } catch (error) {
        capabilities.sourceTreeReadable = false;
        return null;
      }
    };
    const publishStatus = async (node) => {
      try {
        return String(await node.getPublishStatusAsync());
      } catch (error) {
        return "UNREADABLE";
      }
    };

    async function emit(node, context, scopeRootId) {
      const observed = await parts.snapshots.observe(node, scopeRootId);
      nodes.push(observed);
      const resolved = context && context.status !== "unresolved";
      const locatorOf = (field, index) => ({
        fileKey,
        rootInstanceId: context ? context.rootInstanceId : null,
        nodeId: node.id,
        field,
        index,
      });
      let unsupported = false;
      const push = (locator, value, chain, match) => {
        const sourceSlot = match.sourceSlot;
        const bound = value.key || null;
        const overrides = (context ? context.swaps : []).slice();
        if (sourceSlot && sourceSlot.bindingKey !== bound) {
          overrides.push({
            kind: "binding",
            sourceBindingKey: sourceSlot.bindingKey,
            consumerKind: value.kind,
            consumerKey: bound,
          });
        }
        slots.push({
          locator,
          value,
          resolvedValue: chain.resolved,
          aliasChain: chain.aliasChain,
          sourceMatch: match,
          observedOverrides: overrides,
          protectedSnapshot: observed.protectedSnapshot,
        });
      };
      const unsupportedBinding = async (locator, variableId) => {
        const item = await assets.variable(variableId);
        unsupported = true;
        const issue = {
          code: "UNSUPPORTED_BINDING",
          locator,
          detail: "未支援的綁定位置(gradient / mixed text / effect)",
        };
        if (item) issue.assetKey = item.key;
        issues.push(issue);
      };

      for (const [prop, field] of PAINT_FIELDS) {
        const paints = node[prop];
        if (paints === figma.mixed) {
          // mixed text:不拆段補套;任何一段綁了變數都列為未支援
          const locator = locatorOf(field, 0);
          for (const segment of node.getStyledTextSegments([prop])) {
            for (const paint of segment[prop]) {
              const bound = paint.boundVariables && paint.boundVariables.color;
              if (bound) await unsupportedBinding(locator, bound.id);
            }
          }
          unsupported = true;
          const fields = resolved
            ? { status: "unresolved", reason: "UNSUPPORTED_BINDING" }
            : undefined;
          push(
            locator,
            { kind: "mixed" },
            { resolved: null, aliasChain: [] },
            source.matchOf(context, fileKey, fields),
          );
          continue;
        }
        if (!Array.isArray(paints)) continue;
        const shape = resolved
          ? source.paintShape(paints, context.sourceNode[prop])
          : null;
        for (let index = 0; index < paints.length; index += 1) {
          const paint = paints[index];
          const locator = locatorOf(field, index);
          if (paint.type !== "SOLID") {
            for (const stop of paint.gradientStops || []) {
              const bound = stop.boundVariables && stop.boundVariables.color;
              if (bound) await unsupportedBinding(locator, bound.id);
            }
            continue;
          }
          const read = await assets.paintValue(paint);
          let chain = {
            aliasChain: [],
            resolved:
              read.value.kind === "fixed"
                ? { kind: "rgba", rgba: read.value.rgba }
                : null,
            code: read.value.kind === "missing" ? "VARIABLE_MISSING" : null,
          };
          if (read.variable) {
            chain = await assets.resolveChain(read.variable, node);
          }
          if (chain.code) {
            const issue = {
              code: chain.code,
              locator,
              detail: "變數或 alias 無法解析",
            };
            if (read.variable) issue.assetKey = read.variable.key;
            issues.push(issue);
          }
          const match = await parts.slots.match(
            context,
            fileKey,
            locator,
            issues,
            () =>
              parts.slots.paintMatch(context, node, prop, field, index, shape),
          );
          push(locator, read.value, chain, match);
        }
      }

      if ("effectStyleId" in node) {
        const locator = locatorOf("effect-style", null);
        const read = await assets.styleValue(node);
        if (read) {
          const item = read.style;
          if (!item) {
            const mixed = read.value.kind === "mixed";
            unsupported = mixed || unsupported;
            issues.push({
              code: mixed ? "UNSUPPORTED_BINDING" : "STYLE_MISSING",
              locator,
              detail: "effect style 無法讀取或為 mixed",
            });
          } else if (assets.effectBindings(item.effects) > 0) {
            // 色彩綁變數的 effect 無法保留陰影自己的 alpha,不當成已支援
            unsupported = true;
            issues.push({
              code: "UNSUPPORTED_BINDING",
              locator,
              assetKey: item.key,
              detail: "effect style 內含變數綁定",
            });
          }
          const chain = {
            aliasChain: [],
            resolved: item
              ? { kind: "effects", effects: assets.effectsView(item.effects) }
              : null,
          };
          const match = await parts.slots.match(
            context,
            fileKey,
            locator,
            issues,
            () => parts.slots.styleMatch(context),
          );
          push(locator, read.value, chain, match);
        } else if (Array.isArray(node.effects)) {
          for (const effect of node.effects) {
            const bound = effect.boundVariables && effect.boundVariables.color;
            if (bound) await unsupportedBinding(locator, bound.id);
          }
        }
      }
      if (unsupported && scopeRootId !== null) coverage.unsupportedNodes += 1;
    }

    async function visit(node, context, scopeRootId, parentHidden) {
      coverage.nodes += 1;
      const hidden = parentHidden || node.visible === false;
      if (hidden) coverage.hiddenNodes += 1;
      let current = context;
      if (node.type === "INSTANCE") {
        coverage.instances += 1;
        const main = await mainOf(node);
        if (!main) {
          coverage.brokenInstances += 1;
          issues.push({
            code: "BROKEN_INSTANCE",
            locator: {
              fileKey,
              rootInstanceId: context ? context.rootInstanceId : node.id,
              nodeId: node.id,
              field: "effect-style",
              index: null,
            },
            detail: "instance 的 main component 無法取得",
          });
        } else if (main.remote) {
          coverage.remoteInstances += 1;
        }
        if (!context) current = source.rootContext(node, main);
      }
      if (node.type === "COMPONENT" && !node.remote) {
        const owner =
          node.parent && node.parent.type === "COMPONENT_SET"
            ? node.parent
            : node;
        const rawStatus = await publishStatus(node);
        publicationOwners.push({
          componentKey: node.key,
          componentNodeId: node.id,
          rawStatus,
          ownerKind: owner.type,
          ownerKey: owner.key,
          ownerNodeId: owner.id,
          ownerRawStatus:
            owner === node ? rawStatus : await publishStatus(owner),
        });
      }
      await emit(node, current, scopeRootId);
      const children = childrenOf(node);
      for (let index = 0; index < children.length; index += 1) {
        const next = current
          ? await source.descend(current, node, index, children[index])
          : null;
        await visit(children[index], next, scopeRootId, hidden);
      }
    }

    const local = await assets.listLocalAssets();
    capabilities.variablesReadable = local.variablesReadable;
    capabilities.effectStyleReadable = local.effectStyleReadable;
    for (const root of roots) {
      // root 在 instance 內部時,先由可讀的祖先 instance 建立來源脈絡(祖先只讀)
      const context = await source.contextFor(root);
      let hidden = false;
      for (let up = root.parent; up; up = up.parent) {
        if (up.visible === false) hidden = true;
      }
      await visit(root, context, root.id, hidden);
    }
    for (const name of Object.keys(capabilities)) {
      if (!capabilities[name]) {
        issues.push({ code: "CAPABILITY_MISSING", detail: name });
      }
    }

    // scope 外控制值:只在同一頁,取前 CONTROL_LIMIT 個非範圍節點;不冒稱驗過其他頁
    let budget = options && options.controls === false ? 0 : CONTROL_LIMIT;
    async function control(node) {
      if (budget <= 0 || rootIds.has(node.id)) return;
      budget -= 1;
      await emit(node, null, null);
      for (const child of childrenOf(node)) await control(child);
    }
    if (!rootIds.has(page.id)) {
      for (const child of childrenOf(page)) await control(child);
    }
    return finish();
  }

  return { scanScope };
}
