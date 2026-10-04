/**
 * 協定 schema 的形狀引擎與共用片段,以及 request / inventory 兩種 artifact 的欄位與跨欄檢查(每個 operation 都需要)。
 * plan / attempt 在 core-contract-schema-records.mjs,receipt 在 core-contract-schema-receipt.mjs,
 * identity-review 在 core-contract-review.mjs;各組回傳 {bodies,checks},由 assembleContract 依 operation 組裝。
 * 無 Node / Figma import;會被序列化進 Figma 執行。
 */
export function createContractSchema(values) {
  const { ROLES, SHADOW_ROLE, fail, isObject, has } = values;
  const TARGET_KINDS = ["base-library", "brand-library", "consumer"];
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
  const nullable = (spec) => (value, where) =>
    value === null ? undefined : shape(value, spec, where);
  const oneOf = (list) => (value, where) =>
    list.includes(value)
      ? undefined
      : fail("ARTIFACT_INVALID", `${where} 不在允許值內`);

  // 型別名的區域常數(生成碼的字元預算:同一個字串不重複出現)
  const STR = "string";
  const STR_N = "string?";
  const COUNT = "count";
  const COUNT_N = "count?";
  const OBJ = "object";
  const OBJ_N = "object?";
  const DIG = "digest";
  const DIG_N = "digest?";
  const ARR = "array";
  const STRS = "strings";
  const BOOL = "boolean";
  const TIME = "timestamp";
  const RGBA = { r: "any", g: "any", b: "any", a: "any" };
  const PRIMARY = ROLES.reduce(
    (spec, role) => Object.assign(spec, { [role]: RGBA }),
    {},
  );
  const FIELD = oneOf(["fill-color", "stroke-color", "effect-style"]);
  const ASSET_KIND = oneOf(["collection", "variable", "effect-style"]);
  const ROLE = oneOf(ROLES.concat([SHADOW_ROLE]));
  const ROLE_OR_NULL = oneOf([null, SHADOW_ROLE].concat(ROLES));
  const SIDE = oneOf([null, "Brand", "Color"]);
  const SCENE_LOCATOR = {
    fileKey: STR,
    rootInstanceId: STR_N,
    nodeId: STR,
    field: FIELD,
    index: COUNT_N,
  };
  const ASSET_LOCATOR = {
    fileKey: STR,
    assetKind: ASSET_KIND,
    key: STR_N,
    localId: STR_N,
    collectionRole: SIDE,
    role: ROLE_OR_NULL,
  };
  const locator = (value, where) => {
    shape(value, SCENE_LOCATOR, where);
    if ((value.field === "effect-style") !== (value.index === null)) {
      fail("ARTIFACT_INVALID", `${where}.index 與 field 不符`);
    }
  };
  const anyLocator = (value, where) =>
    isObject(value) && has(value, "assetKind")
      ? shape(value, ASSET_LOCATOR, where)
      : locator(value, where);
  const SOURCE_MATCH = {
    status: oneOf(["exact-root", "validated-structure", "unresolved"]),
    componentKey: STR_N,
    nodeContextFileKey: STR,
    sourceNodeId: STR_N,
    ancestryPath: ARR,
    paintShape: OBJ_N,
    sourceSlot: OBJ_N,
    sourceInventoryDigest: DIG_N,
    consumerInventoryDigest: DIG_N,
    previousReceiptDigest: DIG_N,
    reason: STR_N,
  };
  const SCOPE = {
    fileKey: STR,
    rootNodeIds: STRS,
    pageIds: STRS,
    includeHidden: oneOf([true]),
  };
  const SCOPE_EVIDENCE = {
    pageId: STR,
    scopeRootId: STR_N,
    ancestorIds: STRS,
  };
  const INPUT_DIGESTS = {
    inventories: [DIG],
    identityReview: DIG_N,
    previousReceipt: DIG_N,
    plan: DIG_N,
  };
  const PUBLICATION = nullable({
    baseGitTag: STR,
    baseGitCommit: "sha",
    sourceFileKey: STR,
    label: STR,
    versionId: STR,
    versionUrl: STR,
    observedAt: TIME,
    changedAssetKeys: STRS,
  });
  const ACCEPTANCE = nullable({
    sourceFileKey: STR,
    consumerFileKey: STR,
    observedAt: TIME,
    acceptedAssetKeys: STRS,
    pageIds: STRS,
    rootNodeIds: STRS,
    scope: oneOf(["partial", "listed-scope"]),
    evidenceUrl: STR,
  });
  const ASSET_REF = {
    fileKey: STR,
    key: STR,
    resolvedType: STR,
  };
  const issue = (value, where) => {
    const spec = { code: STR, detail: "text" };
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
  const COVERAGE = {
    nodes: COUNT,
    instances: COUNT,
    remoteInstances: COUNT,
    hiddenNodes: COUNT,
    brokenInstances: COUNT,
    unsupportedNodes: COUNT,
  };

  const bodies = {
    request: {
      operation: oneOf(["scan", "apply"]),
      targetKind: oneOf(TARGET_KINDS),
      target: { fileKey: STR, rootNodeIds: STRS },
      includeHidden: oneOf([true]),
      brandProjection: {
        name: STR,
        primary: PRIMARY,
        aliases: ARR,
        primaryEffect: OBJ,
      },
      inputDigests: INPUT_DIGESTS,
      publicationEvidence: PUBLICATION,
      acceptanceEvidence: ACCEPTANCE,
    },
    inventory: {
      observedFileKey: STR_N,
      scope: SCOPE,
      capabilities: {
        fileKeyReadable: BOOL,
        variablesReadable: BOOL,
        effectStyleReadable: BOOL,
        sourceTreeReadable: BOOL,
      },
      coverage: COVERAGE,
      assets: [
        {
          kind: ASSET_KIND,
          fileKey: STR_N,
          key: STR,
          localId: STR,
          name: "text",
          resolvedType: STR_N,
          collectionKey: STR_N,
          modes: "array?",
          valueOrEffects: OBJ,
        },
      ],
      publicationOwners: [
        {
          componentKey: STR,
          componentNodeId: STR,
          rawStatus: STR,
          ownerKind: oneOf(["COMPONENT", "COMPONENT_SET"]),
          ownerKey: STR,
          ownerNodeId: STR,
          ownerRawStatus: STR,
        },
      ],
      slots: [
        {
          locator,
          value: slotValue,
          resolvedValue: OBJ_N,
          aliasChain: ARR,
          sourceMatch: SOURCE_MATCH,
          observedOverrides: ARR,
          protectedSnapshot: OBJ,
        },
      ],
      nodes: [
        {
          nodeId: STR,
          pageId: STR,
          scopeRootId: STR_N,
          ancestorIds: STRS,
          protectedSnapshot: OBJ,
        },
      ],
      issues: [issue],
    },
  };

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

  return {
    TARGET_KINDS,
    types,
    shape,
    nullable,
    oneOf,
    bodies,
    checks,
    pieces: {
      PRIMARY,
      FIELD,
      ASSET_KIND,
      ROLE,
      ROLE_OR_NULL,
      SIDE,
      locator,
      anyLocator,
      issue,
      SCOPE,
      SCOPE_EVIDENCE,
      INPUT_DIGESTS,
      PUBLICATION,
      ACCEPTANCE,
      ASSET_REF,
      COVERAGE,
    },
  };
}
