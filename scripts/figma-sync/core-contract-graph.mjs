/**
 * plan 的相依圖驗證:任何 mutation 前整張驗完,拒絕 forward reference、kind / role / collection 不符。
 * 新建資產沒有 key,只能以 actionId 指向本 plan 前序的同 kind create action。
 * 資產 action(品牌庫)的角色 / 集合規則在 createAssetGraphRules;consumer 的 apply 入口不組它,資產 plan 會被拒絕。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createAssetGraphRules(values) {
  const { ROLES, fail, isObject } = values;

  function check(action, targets, checkRef) {
    const params = action.params;
    const side = action.locator.collectionRole;
    if (action.operation === "create-collection") {
      const valid = params.collectionRole === side && params.name === side;
      if (!valid || params.modeName !== "Light" || !side) {
        fail("PLAN_REF_ROLE", action.actionId);
      }
    }
    if (action.operation === "create-variable") {
      const valid =
        ROLES.includes(action.role) &&
        params.name === `primary/${action.role}` &&
        params.resolvedType === "COLOR" &&
        params.collectionRole === side;
      const owner = targets.collectionRef;
      if (!valid || (owner && owner.params.collectionRole !== side)) {
        fail("PLAN_REF_ROLE", action.actionId);
      }
    }
    if (action.operation === "set-variable-value") {
      const value = params.value;
      const wanted = side === "Brand" ? "rgba" : "alias";
      const typed = isObject(value) && value.kind === wanted;
      if (!typed || params.modeName !== "Light") {
        fail("PLAN_REF_ROLE", action.actionId);
      }
      for (const target of [targets.variableRef, targets.collectionRef]) {
        if (target && target.locator.collectionRole !== side) {
          fail("PLAN_REF_ROLE", action.actionId);
        }
      }
      if (targets.variableRef && targets.variableRef.role !== action.role) {
        fail("PLAN_REF_ROLE", action.actionId);
      }
      if (value.kind === "alias") {
        const target = checkRef(value.targetRef, "variable", action);
        const mismatch =
          target &&
          (target.role !== action.role ||
            target.locator.collectionRole !== "Brand");
        if (mismatch) fail("PLAN_REF_ROLE", action.actionId);
      }
    }
  }

  return { check };
}

export function createPlanGraph(values, assetRules) {
  const { fail, isObject, has } = values;
  const CREATE_KIND = {
    "create-collection": "collection",
    "create-variable": "variable",
    "create-effect-style": "effect-style",
  };
  const REF_FIELDS = {
    "create-variable": { collectionRef: "collection" },
    "set-variable-value": {
      variableRef: "variable",
      collectionRef: "collection",
    },
    "set-effect-style-effects": { styleRef: "effect-style" },
    "set-paint-variable": { variableRef: "variable" },
    "set-effect-style": { styleRef: "effect-style" },
  };
  const isText = (value) => typeof value === "string" && value.length > 0;

  function validatePlanGraph(plan) {
    const sceneOnly = plan.targetKind === "consumer";
    const earlier = new Map();
    const checkRef = (ref, kind, action) => {
      const byKey = isObject(ref) && isText(ref.key);
      const byAction = isObject(ref) && isText(ref.actionId);
      if (!isObject(ref) || ref.kind !== kind || byKey === byAction) {
        fail("PLAN_REF_INVALID", action.actionId);
      }
      if (Object.keys(ref).length !== 2) {
        fail("PLAN_REF_INVALID", action.actionId);
      }
      if (byKey) return null;
      const target = earlier.get(ref.actionId);
      if (!target || sceneOnly) fail("PLAN_REF_FORWARD", action.actionId);
      if (CREATE_KIND[target.operation] !== kind) {
        fail("PLAN_REF_KIND", action.actionId);
      }
      return target;
    };
    for (const action of plan.actions) {
      const scene = /^set-(paint-variable|effect-style)$/.test(
        action.operation,
      );
      const refs = REF_FIELDS[action.operation];
      if (plan.targetKind === "base-library" || scene !== sceneOnly) {
        fail("PLAN_OPERATION_INVALID", action.actionId);
      }
      if (!refs && !has(CREATE_KIND, action.operation)) {
        fail("PLAN_OPERATION_INVALID", action.actionId);
      }
      if (earlier.has(action.actionId)) {
        fail("PLAN_ACTION_DUPLICATE", action.actionId);
      }
      if (action.locator.fileKey !== plan.scope.fileKey) {
        fail("ARTIFACT_INVALID", "action 的 fileKey 與 scope 不符");
      }
      const params = action.params;
      const targets = {};
      for (const name of Object.keys(refs || {})) {
        targets[name] = checkRef(params[name], refs[name], action);
      }
      if (scene) {
        // 場景寫入的目標型別由 field 決定,不沿用被取代的現值 kind
        const style = action.locator.field === "effect-style";
        const valid =
          (action.operation === "set-effect-style") === style &&
          action.expectedAfter.kind === (style ? "style" : "variable");
        if (!valid) fail("PLAN_OPERATION_INVALID", action.actionId);
      }
      if (!scene) {
        // 資產 action 的角色 / 集合規則另行組裝;沒有組進來的入口一律拒絕資產 plan
        if (!assetRules) fail("PLAN_OPERATION_INVALID", action.actionId);
        assetRules.check(action, targets, checkRef);
      }
      earlier.set(action.actionId, action);
    }
    const expected =
      plan.conflicts.length > 0
        ? "blocked"
        : plan.actions.length > 0
          ? "ready"
          : "noop";
    if (plan.status !== expected) {
      fail("ARTIFACT_INVALID", "plan.status 與內容不符");
    }
  }

  return { validatePlanGraph };
}
