/**
 * 測試用的協定夾具與流程:假專案 header / request、以真 runtime 掃描、plan → apply → verify 的一輪,
 * 以及三側齊備的情境。全部走直接 factories,不手編 artifact。
 */
import { createFigmaBrandProjection } from "./brand.mjs";
import { createCore } from "./core.mjs";
import { createRuntime } from "./runtime.mjs";
import { createFakeFigma, createWorld } from "./test-support-figma.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  CONSUMER_FILE,
  ROLES,
  brandFixture,
  buildBaseLibrary,
  buildConsumer,
} from "./test-support-scenes.mjs";

export const { contract, core } = createCore();

const HEX40 = "a".repeat(40);

/** 與 CLI 同形狀的來源身分(假專案)。 */
export function makeHeader(runId, generatedAt = "2026-01-02T03:04:05.000Z") {
  const fixture = brandFixture();
  return {
    schemaVersion: 1,
    runId,
    generatedAt,
    project: {
      slug: fixture.slug,
      repository: "acme/widgets",
      gitCommit: HEX40,
      dirty: false,
      brandInputDigest: contract.digest(fixture.brand),
    },
    tool: { gitCommit: HEX40, sourceDigest: contract.digest("tool") },
  };
}

export function makeRequest({
  operation = "scan",
  targetKind,
  fileKey,
  roots,
  runId,
  projection = createFigmaBrandProjection(brandFixture()),
  inputDigests = {},
  publicationEvidence = null,
  acceptanceEvidence = null,
}) {
  return {
    ...makeHeader(runId),
    kind: "request",
    operation,
    targetKind,
    target: { fileKey, rootNodeIds: roots },
    includeHidden: true,
    brandProjection: projection,
    inputDigests: {
      inventories: [],
      identityReview: null,
      previousReceipt: null,
      plan: null,
      ...inputDigests,
    },
    publicationEvidence,
    acceptanceEvidence,
  };
}

/** 以真 runtime(直接 factories)在 fake Figma 掃描。 */
export function scan(world, targetKind, fileKey, roots, runId) {
  const request = makeRequest({ targetKind, fileKey, roots, runId });
  return createRuntime(createFakeFigma(world, fileKey)).scanScope(request);
}

/** plan → apply → verify 的一輪(直接 factories);回傳各階段產物。 */
export async function runPlan(world, { request, ...input }) {
  const plan = core.planSync({ request, ...input });
  if (plan.status === "blocked") return { plan, attempt: null, verdict: null };
  const applyRequest = {
    ...request,
    inputDigests: { ...request.inputDigests, plan: contract.digest(plan) },
  };
  const figma = createFakeFigma(world, plan.scope.fileKey);
  const attempt = await createRuntime(figma).applyPlan(applyRequest, plan);
  const before =
    input.inventories[plan.targetKind === "consumer" ? "consumer" : "brand"];
  const verdict = attempt.afterInventory
    ? core.verifySync({
        plan,
        beforeInventory: before,
        afterInventory: attempt.afterInventory,
        previousReceipt: input.previousReceipt ?? null,
        attempt,
      })
    : null;
  return { plan, attempt, verdict, applyRequest };
}

export async function planBrandRun(
  world,
  { runId, previousReceipt = null, projection, ...rest },
) {
  const brand = await scan(
    world,
    "brand-library",
    BRAND_FILE,
    [`P${BRAND_FILE}:0`],
    `${runId}-scan`,
  );
  const request = makeRequest({
    operation: "apply",
    targetKind: "brand-library",
    fileKey: BRAND_FILE,
    roots: brand.scope.rootNodeIds,
    runId,
    projection,
    inputDigests: {
      inventories: [contract.digest(brand)],
      previousReceipt: previousReceipt
        ? contract.digest(previousReceipt)
        : null,
      plan: rest.resumePlan ? contract.digest(rest.resumePlan) : null,
    },
  });
  return runPlan(world, {
    request,
    inventories: { brand },
    previousReceipt,
    ...rest,
  });
}

/** 審查者的精確選擇:從兩側 inventory 取 exact file / key / type(名稱只在測試裡當畫面提示)。 */
export function selectionsFor(base, brand) {
  const collectionKey = (inventory, name) =>
    inventory.assets.find(
      (asset) =>
        asset.kind === "collection" &&
        asset.name === name &&
        asset.fileKey === inventory.observedFileKey,
    ).key;
  const ref = (inventory, kind, name, collection) => {
    const asset = inventory.assets.find(
      (item) =>
        item.kind === kind &&
        item.name === name &&
        item.fileKey === inventory.observedFileKey &&
        (!collection ||
          item.collectionKey === collectionKey(inventory, collection)),
    );
    return {
      fileKey: asset.fileKey,
      key: asset.key,
      resolvedType: asset.resolvedType,
    };
  };
  const selections = [];
  for (const side of ["Brand", "Color"]) {
    for (const role of ROLES) {
      selections.push({
        role,
        assetKind: "variable",
        source: ref(base, "variable", `primary/${role}`, side),
        project: ref(brand, "variable", `primary/${role}`, side),
      });
    }
  }
  selections.push({
    role: "primary-shadow",
    assetKind: "effect-style",
    source: ref(base, "effect-style", "Shadow/Primary"),
    project: ref(brand, "effect-style", "Shadow/Primary"),
  });
  return selections;
}

/**
 * 三側齊備的情境:底座 Library、已由工具初建的品牌庫(含 receipt)、尚未補套的 consumer。
 */
export async function createScenario() {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  world.addFile(BRAND_FILE, ["Brand"]);
  const consumer = buildConsumer(world, base);
  const brandRun = await planBrandRun(world, { runId: "brand-1" });
  world.resetLog();
  const inventories = {
    base: await scan(
      world,
      "base-library",
      BASE_FILE,
      [base.page.id],
      "scan-base",
    ),
    brand: brandRun.attempt.afterInventory,
  };
  const scanConsumer = (runId, roots = ["10:1"]) =>
    scan(world, "consumer", CONSUMER_FILE, roots, runId);
  const review = (consumerInventory = null, resolutions = [], extra = {}) =>
    core.createIdentityReview({
      ...makeHeader(extra.runId ?? "review-1"),
      inventories: { ...inventories, consumer: consumerInventory },
      selections:
        extra.selections ?? selectionsFor(inventories.base, inventories.brand),
      resolutions,
      reviewEvidenceURL: "https://github.com/acme/widgets/issues/1",
    });
  /** consumer 的 plan(→ apply → verify)一輪。 */
  const sync = async (runId, options = {}) => {
    const inventory =
      options.inventory ?? (await scanConsumer(`${runId}-scan`, options.roots));
    const identityReview = options.identityReview ?? review();
    const previousReceipt = options.previousReceipt ?? null;
    const request = makeRequest({
      operation: "apply",
      targetKind: "consumer",
      fileKey: CONSUMER_FILE,
      roots: inventory.scope.rootNodeIds,
      runId,
      inputDigests: {
        inventories: [inventories.base, inventories.brand, inventory].map(
          (item) => contract.digest(item),
        ),
        identityReview: contract.digest(identityReview),
        previousReceipt: previousReceipt
          ? contract.digest(previousReceipt)
          : null,
        plan: options.resumePlan ? contract.digest(options.resumePlan) : null,
      },
      publicationEvidence: options.publicationEvidence ?? null,
      acceptanceEvidence: options.acceptanceEvidence ?? null,
    });
    const input = {
      request,
      inventories: { ...inventories, consumer: inventory },
      identityReview,
      previousReceipt,
      resumePlan: options.resumePlan ?? null,
      resumeAttempt: options.resumeAttempt ?? null,
      verificationTarget: options.verificationTarget ?? "brand-bindings",
    };
    if (options.planOnly)
      return { plan: core.planSync(input), inventory, input };
    return { ...(await runPlan(world, input)), inventory, input };
  };
  return {
    world,
    base,
    consumer,
    brandReceipt: brandRun.verdict.receipt,
    inventories,
    scanConsumer,
    review,
    sync,
  };
}
