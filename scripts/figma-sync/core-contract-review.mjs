/**
 * 精確身分審查:把 CLI 明示的 selections / resolutions 核對進指定 inventories,生成 identity-review。
 * 名稱只作畫面提示;每項必須以 exact file / key / type / role 存在,工具不在 selections 之外補 key。
 * 同檔的 createReviewSchema 是 identity-review 的欄位。只有 Node 端使用,不進任何 Figma 生成碼。無 Node / Figma import。
 */
export function createReviewSchema(schema) {
  const { oneOf, pieces } = schema;
  const SELECTION = {
    role: pieces.ROLE,
    assetKind: oneOf(["variable", "effect-style"]),
    source: pieces.ASSET_REF,
    project: pieces.ASSET_REF,
  };
  const RESOLUTION = {
    locator: pieces.locator,
    consumerInventoryDigest: "digest",
    before: "object",
    sourceMatchDigest: "digest?",
    decision: oneOf(["adopt-source", "preserve-project"]),
    expectedRole: pieces.ROLE_OR_NULL,
  };
  const bodies = {
    "identity-review": {
      inventoryDigests: {
        base: "digest",
        brand: "digest",
        consumer: "digest?",
      },
      reviewEvidenceURL: "string",
      resolutions: [RESOLUTION],
      selections: [SELECTION],
    },
  };

  return { bodies, checks: {}, pieces: { SELECTION, RESOLUTION } };
}

export function createIdentityReviewer(
  values,
  schema,
  review,
  validateArtifact,
) {
  const { SHADOW_ROLE, fail, digest, sameValue, slotKey } = values;
  const { SELECTION, RESOLUTION } = review.pieces;

  function createIdentityReview(input) {
    const base = validateArtifact(input.inventories.base);
    const brand = validateArtifact(input.inventories.brand);
    const consumer = input.inventories.consumer || null;
    if (consumer) validateArtifact(consumer);
    const inventories = [base, brand, consumer];
    if (inventories.some((item) => item && item.kind !== "inventory")) {
      fail("ARTIFACT_INVALID", "review 的輸入須為 inventory");
    }
    if (!/^https:\/\/\S+$/.test(String(input.reviewEvidenceURL))) {
      fail("REVIEW_EVIDENCE_INVALID");
    }
    schema.shape(input.selections, [SELECTION], "selections");
    schema.shape(input.resolutions, [RESOLUTION], "resolutions");
    if (input.selections.length === 0) fail("SELECTIONS_EMPTY");
    const sides = [
      ["source", base, values.indexAssets(base)],
      ["project", brand, values.indexAssets(brand)],
    ];
    const roleOf = { source: new Map(), project: new Map() };
    const terminalOf = new Map();
    input.selections.forEach((selection, i) => {
      const where = `selections[${i}]`;
      const isShadow = selection.role === SHADOW_ROLE;
      if ((selection.assetKind === "effect-style") !== isShadow) {
        fail("SELECTION_KIND_MISMATCH", where);
      }
      if (selection.source.resolvedType !== selection.project.resolvedType) {
        fail("SELECTION_TYPE_MISMATCH", where);
      }
      for (const [side, inventory, assets] of sides) {
        const ref = selection[side];
        const asset = assets.get(`${selection.assetKind}:${ref.key}`);
        // asset.fileKey=null(遠端、來源檔未知)不算 exact:selection 必須落在該 Library 自己的掃描
        const exact =
          asset &&
          asset.fileKey === ref.fileKey &&
          inventory.observedFileKey === ref.fileKey &&
          asset.resolvedType === ref.resolvedType;
        if (!exact) fail("SELECTION_NOT_EXACT", `${where}.${side}`);
      }
      if (roleOf.source.has(selection.source.key)) {
        fail("SELECTION_DUPLICATE_SOURCE", where);
      }
      const known = roleOf.project.get(selection.project.key);
      if (known && known !== selection.role) {
        fail("SELECTION_ROLE_CONFLICT", where);
      }
      roleOf.source.set(selection.source.key, selection.role);
      roleOf.project.set(selection.project.key, selection.role);
    });
    // alias 終點:同角色的 project 終點必須同一把 key;終點若也被選擇,角色必須一致
    input.selections.forEach((selection, i) => {
      if (selection.assetKind !== "variable") return;
      for (const [side, , assets] of sides) {
        const terminal = values.resolveAssetChain(
          assets,
          selection[side].key,
        ).terminalKey;
        const role = roleOf[side].get(terminal);
        if (role && role !== selection.role) {
          fail("SELECTION_ALIAS_ROLE_MISMATCH", `selections[${i}].${side}`);
        }
        if (side !== "project") continue;
        const shared = terminalOf.get(selection.role);
        if (shared && shared !== terminal) {
          fail("SELECTION_ALIAS_ROLE_MISMATCH", `selections[${i}].project`);
        }
        terminalOf.set(selection.role, terminal);
      }
    });
    if (input.resolutions.length > 0 && !consumer) {
      fail("RESOLUTION_NEEDS_CONSUMER");
    }
    const consumerDigest = consumer ? digest(consumer) : null;
    const slots = consumer ? values.indexSlots(consumer) : new Map();
    const resolved = new Set();
    input.resolutions.forEach((resolution, i) => {
      const where = `resolutions[${i}]`;
      const key = slotKey(resolution.locator);
      const slot = slots.get(key);
      // 每個決定綁定本次掃描的實際 before 與來源對照;已消失的 slot 以 before.kind=missing 明示
      const fresh = slot
        ? sameValue(resolution.before, slot.value) &&
          resolution.sourceMatchDigest === digest(slot.sourceMatch)
        : resolution.before.kind === "missing" &&
          resolution.sourceMatchDigest === null;
      if (resolution.consumerInventoryDigest !== consumerDigest || !fresh) {
        fail("RESOLUTION_STALE", where);
      }
      const adopting = resolution.decision === "adopt-source";
      if (adopting !== (resolution.expectedRole !== null)) {
        fail("RESOLUTION_ROLE_INVALID", where);
      }
      if (resolved.has(key)) fail("RESOLUTION_DUPLICATE", where);
      resolved.add(key);
    });
    return validateArtifact(
      Object.assign(values.stamp("identity-review", input), {
        inventoryDigests: {
          base: digest(base),
          brand: digest(brand),
          consumer: consumerDigest,
        },
        reviewEvidenceURL: input.reviewEvidenceURL,
        resolutions: input.resolutions,
        selections: input.selections,
      }),
    );
  }

  return { createIdentityReview };
}
