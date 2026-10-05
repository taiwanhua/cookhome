/**
 * figma-sync 的 core 組裝:parts 由 assembleCore 依 contract → planners / verifier / recovery 的順序建立後注入,
 * factory 本身不取用 module closure。無 Node / Figma import;會被序列化進 Figma 執行。
 */
import { CONTRACT_FACTORIES, assembleContract } from "./core-contract.mjs";
import { createBrandPlanner } from "./core-plan-brand.mjs";
import { createConsumerGuards } from "./core-plan-consumer-guards.mjs";
import { createOwnershipRules } from "./core-plan-consumer-ownership.mjs";
import { createConsumerPlanner } from "./core-plan-consumer.mjs";
import {
  createAssetClassifier,
  createSceneClassifier,
} from "./core-recovery-classify.mjs";
import { assembleRecovery, createRecoveryCore } from "./core-recovery.mjs";
import { createSyncVerifier } from "./core-verification.mjs";

export function createSyncCore(parts) {
  const { contract, consumerPlanner, brandPlanner, verifier, recovery } = parts;
  const { fail, validateArtifact } = contract;
  const check = (artifact, kind) => {
    if (validateArtifact(artifact).kind !== kind) {
      fail("ARTIFACT_KIND_MISMATCH", kind);
    }
    return artifact;
  };

  /**
   * 依 targetKind 分派 planner。resumePlan 存在時先以 recovery 對新掃描逐筆分類,
   * planner 再據此認回已套用項目;resumeAttempt 只提供原 run 已封存的 readBack,須與原 plan 同一輪。
   */
  function planSync(input) {
    const request = check(input.request, "request");
    if (request.operation !== "apply") fail("REQUEST_OPERATION_INVALID");
    const inventories = input.inventories;
    const brand = request.targetKind === "brand-library";
    if (!brand && request.targetKind !== "consumer") {
      fail("TARGET_NOT_PLANNABLE");
    }
    const names = brand ? ["brand"] : ["base", "brand", "consumer"];
    const digests = names.map((name) =>
      contract.digest(check(inventories[name], "inventory")),
    );
    const previous = input.previousReceipt || null;
    const review = brand
      ? null
      : check(input.identityReview, "identity-review");
    if (previous) check(previous, "receipt");
    const recorded = request.inputDigests;
    const resumePlan = input.resumePlan || null;
    const consistent =
      contract.sameValue(recorded.inventories, digests) &&
      recorded.identityReview === (review ? contract.digest(review) : null) &&
      recorded.previousReceipt ===
        (previous ? contract.digest(previous) : null) &&
      recorded.plan === (resumePlan ? contract.digest(resumePlan) : null);
    if (!consistent) fail("INPUT_DIGEST_MISMATCH");
    for (const artifact of [previous, review].concat(
      names.map((name) => inventories[name]),
    )) {
      const foreign =
        artifact &&
        (artifact.project.repository !== request.project.repository ||
          artifact.project.slug !== request.project.slug);
      if (foreign) fail("PROJECT_MISMATCH");
    }
    const target = inventories[brand ? "brand" : "consumer"];
    let reconciliation = null;
    if (resumePlan) {
      if (check(resumePlan, "plan").targetKind !== request.targetKind) {
        fail("RESUME_PLAN_MISMATCH");
      }
      reconciliation = recovery.reconcileInterruptedPlan({
        plan: resumePlan,
        inventory: target,
        attempt: input.resumeAttempt
          ? check(input.resumeAttempt, "attempt")
          : null,
      });
    } else if (input.resumeAttempt) {
      fail("RESUME_PLAN_MISMATCH");
    }
    const planner = brand
      ? brandPlanner.planBrand
      : consumerPlanner.planConsumer;
    return planner(
      Object.assign({}, input, { previousReceipt: previous, reconciliation }),
    );
  }

  function verifySync(input) {
    check(input.plan, "plan");
    check(input.beforeInventory, "inventory");
    check(input.afterInventory, "inventory");
    check(input.attempt, "attempt");
    if (input.previousReceipt) check(input.previousReceipt, "receipt");
    return verifier.verifySync(input);
  }

  function reconcileInterruptedPlan(input) {
    check(input.plan, "plan");
    check(input.inventory, "inventory");
    if (input.attempt) check(input.attempt, "attempt");
    return recovery.reconcileInterruptedPlan(input);
  }

  return {
    validateArtifact,
    createIdentityReview: contract.createIdentityReview,
    planSync,
    verifySync,
    reconcileInterruptedPlan,
  };
}

/** core 的固定 factory 清單(名稱即生成碼中的函式名)。 */
export const CORE_FACTORIES = Object.assign({}, CONTRACT_FACTORIES, {
  createConsumerGuards,
  createOwnershipRules,
  createConsumerPlanner,
  createBrandPlanner,
  createSyncVerifier,
  createRecoveryCore,
  createSceneClassifier,
  createAssetClassifier,
  createSyncCore,
});

/** 依固定順序組裝完整 core;Node 端(CLI、測試)使用。 */
export function assembleCore(factories) {
  const contract = assembleContract(factories);
  const guards = factories.createConsumerGuards(contract);
  const ownership = factories.createOwnershipRules(contract, guards);
  const core = factories.createSyncCore({
    contract,
    consumerPlanner: factories.createConsumerPlanner(contract, {
      guards,
      ownership,
    }),
    brandPlanner: factories.createBrandPlanner(contract),
    verifier: factories.createSyncVerifier(contract),
    recovery: assembleRecovery(factories, contract),
  });
  return { contract, core };
}

export const createCore = () => assembleCore(CORE_FACTORIES);
