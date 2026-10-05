/**
 * request / inventory schema 的唯一欄位定義。builder 自動產生純 JSON descriptor，
 * Node 與生成碼都交給 core-contract-schema-runtime.mjs 的同一引擎和具名檢查。
 */
import { createSchemaRuntime } from "./core-contract-schema-runtime.mjs";

export function createSchemaDefinitions(values) {
  const { ROLES, SHADOW_ROLE } = values;
  const TARGET_KINDS = ["base-library", "brand-library", "consumer"];
  const oneOf = (list) => ({ $enum: list });
  const nullable = (spec) => ({ $nullable: spec });
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
  const locator = { $validator: "locator" };
  const anyLocator = { $validator: "anyLocator" };
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
  const issue = { $validator: "issue" };
  const slotValue = { $validator: "slotValue" };
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

  return {
    TARGET_KINDS,
    bodies,
    pieces: {
      SCENE_LOCATOR,
      ASSET_LOCATOR,
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

export const createContractSchema = (values) =>
  createSchemaRuntime(values, createSchemaDefinitions(values));
