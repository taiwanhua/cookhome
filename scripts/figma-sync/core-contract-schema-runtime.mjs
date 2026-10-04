/**
 * schema 的共同形狀引擎與具名跨欄檢查。Node 與 Figma 都執行這份 factory。
 * definitions 是由既有 schema builders 自動產生的純 JSON；不接受使用者提供的 schema。
 * $enum / $nullable / $validator 是 builder 產物，不是新的 artifact 或人工設定格式。
 */
export function createSchemaRuntime(values, definitions) {
  const { fail, isObject, has } = values;
  const DIGEST = /^[0-9a-f]{64}$/;

  const types = {
    string: (value) => typeof value === "string" && value.length > 0,
    text: (value) => typeof value === "string",
    boolean: (value) => typeof value === "boolean",
    count: (value) => Number.isInteger(value) && value >= 0,
    array: (value) => Array.isArray(value),
    object: isObject,
    any: (value) => value !== undefined,
    digest: (value) => typeof value === "string" && DIGEST.test(value),
    sha: (value) => /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(String(value)),
    timestamp: (value) =>
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(String(value)),
    strings: (value) => Array.isArray(value) && value.every(types.string),
  };
  for (const name of ["string", "count", "object", "digest", "array"]) {
    types[`${name}?`] = (value) => value === null || types[name](value);
  }

  /** spec 可以是型別名、函式、[元素 spec] 或欄位表;欄位表拒絕缺欄與未知欄位。 */
  function shape(value, spec, where) {
    if (typeof spec === "function") return spec(value, where);
    if (isObject(spec) && has(spec, "$enum")) {
      if (!spec.$enum.includes(value))
        fail("ARTIFACT_INVALID", `${where} 不在允許值內`);
      return;
    }
    if (isObject(spec) && has(spec, "$nullable")) {
      return value === null ? undefined : shape(value, spec.$nullable, where);
    }
    if (isObject(spec) && has(spec, "$validator")) {
      const validator = validators[spec.$validator];
      if (!validator) fail("SCHEMA_INVALID");
      return validator(value, where);
    }
    if (typeof spec === "string") {
      if (!types[spec](value)) fail("ARTIFACT_INVALID", `${where} 型別錯誤`);
      return undefined;
    }
    if (Array.isArray(spec)) {
      if (!Array.isArray(value)) fail("ARTIFACT_INVALID", `${where} 須為陣列`);
      value.forEach((item, i) => shape(item, spec[0], `${where}[${i}]`));
      return undefined;
    }
    if (!isObject(value)) fail("ARTIFACT_INVALID", `${where} 須為物件`);
    for (const name of Object.keys(spec)) {
      if (!has(value, name)) fail("ARTIFACT_INVALID", `${where}.${name} 缺少`);
      shape(value[name], spec[name], `${where}.${name}`);
    }
    if (Object.keys(value).some((name) => !has(spec, name))) {
      fail("ARTIFACT_INVALID", `${where} 含未知欄位`);
    }
    return undefined;
  }

  const locator = (value, where) => {
    shape(value, definitions.pieces.SCENE_LOCATOR, where);
    if ((value.field === "effect-style") !== (value.index === null)) {
      fail("ARTIFACT_INVALID", `${where}.index 與 field 不符`);
    }
  };
  const anyLocator = (value, where) =>
    isObject(value) && has(value, "assetKind")
      ? shape(value, definitions.pieces.ASSET_LOCATOR, where)
      : locator(value, where);
  const issue = (value, where) => {
    const spec = { code: "string", detail: "text" };
    if (isObject(value) && has(value, "locator")) spec.locator = anyLocator;
    if (isObject(value) && has(value, "assetKey")) spec.assetKey = "string";
    shape(value, spec, where);
  };
  // slot.value 依 kind 帶不同欄位,這裡只鎖 kind;其餘由 valueMatches / planner 精確比對
  const slotValue = (value, where) => {
    const kinds = ["fixed", "variable", "style", "mixed", "missing"];
    if (!isObject(value) || !kinds.includes(value.kind)) {
      fail("ARTIFACT_INVALID", `${where}.kind 不在允許值內`);
    }
  };

  const validators = { locator, anyLocator, issue, slotValue };
  const nullable = (spec) => ({ $nullable: spec });
  const oneOf = (list) => ({ $enum: list });
  const checks = {
    request(value) {
      if (value.target.rootNodeIds.length === 0) {
        fail("ARTIFACT_INVALID", "request.target.rootNodeIds 不可為空");
      }
      // scan 沒有 plan;規劃用的 apply request 在 plan 產生前 digest 仍為 null
      if (value.operation === "scan" && value.inputDigests.plan !== null) {
        fail("ARTIFACT_INVALID", "scan request 不帶 plan digest");
      }
    },
    inventory(value) {
      const known = new Set(value.nodes.map((node) => node.nodeId));
      for (const slot of value.slots) {
        if (slot.locator.fileKey !== value.scope.fileKey) {
          fail("ARTIFACT_INVALID", "slot 的 fileKey 與 scope 不符");
        }
        if (!known.has(slot.locator.nodeId)) {
          fail("ARTIFACT_INVALID", "slot 的節點不在 nodes 內");
        }
      }
    },
  };

  return Object.assign({}, definitions, {
    types,
    shape,
    nullable,
    oneOf,
    checks,
  });
}
