/**
 * Figma runtime 組裝:parts 由 assembleRuntime 依 assets / source → scanner → executor 的順序建立後注入。
 * Plugin API 只在 runtime 系列檔使用;這裡只做入口的協定檢查,factory 本身不取用 module closure。
 * 會被序列化進 Figma 執行。
 */
import { createCore } from "./core.mjs";
import { createAssetWriter } from "./runtime-apply-assets.mjs";
import { createSceneWriter } from "./runtime-apply-scene.mjs";
import { createPlanExecutor } from "./runtime-apply.mjs";
import { createAssetRuntime } from "./runtime-assets.mjs";
import { createNodeSnapshots } from "./runtime-scan-snapshot.mjs";
import { createSourceSlots } from "./runtime-scan-source.mjs";
import { createScopeScanner } from "./runtime-scan.mjs";
import { createSourceRuntime } from "./runtime-source.mjs";

export function createFigmaRuntime(figma, core, parts) {
  const fail = (code) => {
    const error = new Error(code);
    error.name = "FigmaSyncError";
    error.code = code;
    throw error;
  };

  /** 回傳 inventory;fileKey 缺或不符時回傳帶 issue 的空 inventory,由 record 拒絕。 */
  async function scanScope(request) {
    if (typeof figma !== "object" || figma === null) fail("FIGMA_UNAVAILABLE");
    if (core.validateArtifact(request).kind !== "request") {
      fail("ARTIFACT_KIND_MISMATCH");
    }
    return parts.scanScope(request);
  }

  /** 回傳 attempt(內嵌實際 afterInventory);afterInventoryDigest 留 null,由 record 封存後計算。 */
  async function applyPlan(request, plan) {
    if (typeof figma !== "object" || figma === null) fail("FIGMA_UNAVAILABLE");
    if (core.validateArtifact(request).kind !== "request") {
      fail("ARTIFACT_KIND_MISMATCH");
    }
    if (request.operation !== "apply" || !plan) {
      fail("REQUEST_OPERATION_INVALID");
    }
    if (!parts.applyPlan) fail("EXECUTOR_UNAVAILABLE");
    return parts.applyPlan(request, plan);
  }

  return { scanScope, applyPlan };
}

/** scan 需要的 runtime factories;唯讀的傳輸分塊入口只含這些,不含 executor。 */
export const SCAN_FACTORIES = {
  createAssetRuntime,
  createSourceRuntime,
  createNodeSnapshots,
  createSourceSlots,
  createScopeScanner,
  createFigmaRuntime,
};
/** consumer 的 apply:executor 與場景 writer。 */
export const SCENE_APPLY_FACTORIES = Object.assign({}, SCAN_FACTORIES, {
  createPlanExecutor,
  createSceneWriter,
});
/** 品牌庫的 apply:executor 與資產 writer。 */
export const ASSET_APPLY_FACTORIES = Object.assign({}, SCAN_FACTORIES, {
  createPlanExecutor,
  createAssetWriter,
});
export const APPLY_FACTORIES = Object.assign(
  {},
  SCENE_APPLY_FACTORIES,
  ASSET_APPLY_FACTORIES,
);

/**
 * 依固定順序組裝 runtime;Node 端與生成碼共用這一支。
 * factories 沒有 createPlanExecutor 時組出的 runtime 只能掃描(applyPlan 會拒絕);
 * 沒有列入的 writer 不組,plan 需要它時 executor 在任何 mutation 前失敗。
 */
export function assembleRuntime(figma, factories, core) {
  const assets = factories.createAssetRuntime(figma, core);
  const source = factories.createSourceRuntime(figma, core);
  const scanScope = factories.createScopeScanner(figma, core, assets, source, {
    snapshots: factories.createNodeSnapshots(figma, assets),
    slots: factories.createSourceSlots(figma, assets, source),
  }).scanScope;
  const applyPlan = factories.createPlanExecutor
    ? factories.createPlanExecutor(figma, core, assets, scanScope, {
        scene: factories.createSceneWriter
          ? factories.createSceneWriter(figma, core, assets, scanScope)
          : null,
        asset: factories.createAssetWriter
          ? factories.createAssetWriter(figma, assets)
          : null,
      }).applyPlan
    : null;
  return factories.createFigmaRuntime(figma, core, { scanScope, applyPlan });
}

/** 以直接 factories 與完整 core 組出 runtime;測試拿它與生成碼的執行結果比對。 */
export const createRuntime = (figma) =>
  assembleRuntime(figma, APPLY_FACTORIES, createCore().core);
