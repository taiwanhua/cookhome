/**
 * figma-sync 的共同協定:組裝通用值與各組 schema,提供 `validateArtifact`(Node 端另有 `createIdentityReview`)。
 * parts={values,schema,sets} 由 assembleContract 依序建立後注入,factory 本身不取用 module closure。
 * sets 是 {bodies,checks} 的清單,依 operation 組裝:scan 只有 request / inventory;apply 另加 plan / attempt 與相依圖;
 * receipt、identity-review 與規劃用的值運算只在 Node 端。沒有組進來的 kind 一律被拒絕(ARTIFACT_INVALID)。
 * 無 Node / Figma import;會被序列化進 Figma 執行。協定欄位見 core-contract-schema.mjs,操作見 docs/agents/toolbox.md「Figma 品牌同步」。
 */
import {
  createAssetGraphRules,
  createPlanGraph,
} from "./core-contract-graph.mjs";
import {
  createGuardValues,
  createPlanningValues,
} from "./core-contract-guards.mjs";
import {
  createIdentityReviewer,
  createReviewSchema,
} from "./core-contract-review.mjs";
import { createReceiptSchema } from "./core-contract-schema-receipt.mjs";
import {
  createRecordChecks,
  createRecordSchema,
} from "./core-contract-schema-records.mjs";
import { createSchemaRuntime } from "./core-contract-schema-runtime.mjs";
import { createSchemaDefinitions } from "./core-contract-schema.mjs";
import { createContractValues } from "./core-contract-values.mjs";

export function createArtifactContract(parts) {
  const { values, schema } = parts;
  const { fail, isObject } = values;
  const bodies = {};
  const checks = {};
  for (const set of parts.sets) {
    Object.assign(bodies, set.bodies);
    Object.assign(checks, set.checks);
  }
  const HEADER = {
    schemaVersion: schema.oneOf([1]),
    kind: schema.oneOf(Object.keys(bodies)),
    runId: "string",
    generatedAt: "timestamp",
    project: {
      slug: "string",
      repository: "string",
      gitCommit: "sha",
      dirty: "boolean",
      brandInputDigest: "digest",
    },
    tool: { gitCommit: "sha", sourceDigest: "digest" },
  };
  const sameHeader = (a, b) =>
    a.runId === b.runId &&
    values.sameValue(a.project, b.project) &&
    values.sameValue(a.tool, b.tool);
  const tools = { fail, sameHeader };

  /** 驗一份協定 JSON;通過回傳原值。未知 kind、缺欄位、錯型別、來源不符都拒絕。 */
  function validateArtifact(value) {
    if (!isObject(value)) fail("ARTIFACT_INVALID", "artifact 須為物件");
    schema.shape(value.kind, HEADER.kind, "kind");
    schema.shape(
      value,
      Object.assign({}, HEADER, bodies[value.kind]),
      value.kind,
    );
    if (checks[value.kind]) checks[value.kind](value, tools);
    return value;
  }
  tools.validateArtifact = validateArtifact;

  return Object.assign({}, values, { sameHeader, validateArtifact });
}

/** scan / 唯讀分塊入口需要的 contract:基本值運算、request / inventory。 */
export const SCAN_CONTRACT_FACTORIES = {
  createContractValues,
  createSchemaDefinitions,
  createSchemaRuntime,
  createArtifactContract,
};
/** consumer 的 apply 另加 guards、plan / attempt 與相依圖(只接受場景 action)。 */
export const SCENE_APPLY_CONTRACT_FACTORIES = Object.assign(
  {},
  SCAN_CONTRACT_FACTORIES,
  {
    createGuardValues,
    createRecordSchema,
    createRecordChecks,
    createPlanGraph,
  },
);
/** 品牌庫的 apply 再加資產 action 的角色 / 集合規則。 */
export const APPLY_CONTRACT_FACTORIES = Object.assign(
  {},
  SCENE_APPLY_CONTRACT_FACTORIES,
  { createAssetGraphRules },
);
/** Node 端完整的 contract 家族(名稱即生成碼中的函式名)。 */
export const CONTRACT_FACTORIES = Object.assign({}, APPLY_CONTRACT_FACTORIES, {
  createPlanningValues,
  createReceiptSchema,
  createReviewSchema,
  createIdentityReviewer,
});

/**
 * 依固定順序組裝 contract;Node 端與生成碼共用這一支。清單內沒有的部分不組:
 * 對應的 kind 會被 validateArtifact 拒絕,對應的 helpers 不存在。
 */
export function assembleContract(factories, definitions) {
  const base = factories.createContractValues();
  const guards = factories.createGuardValues
    ? factories.createGuardValues(base)
    : null;
  const planning = factories.createPlanningValues
    ? factories.createPlanningValues(base, guards)
    : null;
  const values = Object.assign({}, base, guards, planning);
  const schema = definitions
    ? factories.createSchemaRuntime(values, definitions.schema)
    : factories.createSchemaRuntime(
        values,
        factories.createSchemaDefinitions(values),
      );
  const sets = [schema];
  let records = null;
  if (factories.createPlanGraph) {
    records = definitions
      ? { bodies: definitions.records, checks: factories.createRecordChecks() }
      : factories.createRecordSchema(schema, factories.createRecordChecks());
    const assetRules = factories.createAssetGraphRules
      ? factories.createAssetGraphRules(values)
      : null;
    records.checks.plan = factories.createPlanGraph(
      values,
      assetRules,
    ).validatePlanGraph;
    sets.push(records);
  }
  if (factories.createReceiptSchema) {
    sets.push(factories.createReceiptSchema(schema, records));
  }
  const review = factories.createReviewSchema
    ? factories.createReviewSchema(schema)
    : null;
  if (review) sets.push(review);
  const contract = factories.createArtifactContract({ values, schema, sets });
  if (factories.createIdentityReviewer) {
    contract.createIdentityReview = factories.createIdentityReviewer(
      values,
      schema,
      review,
      contract.validateArtifact,
    ).createIdentityReview;
  }
  return contract;
}

export const createContract = () => assembleContract(CONTRACT_FACTORIES);
