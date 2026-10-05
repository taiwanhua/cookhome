/**
 * receipt 的欄位與跨欄檢查:只有 Node 端(verify / record)使用,不進任何 Figma 生成碼。
 * 共用片段取自 core-contract-schema.mjs 與 core-contract-schema-records.mjs 的 pieces。
 * 無 Node / Figma import。
 */
export function createReceiptSchema(schema, records) {
  const { oneOf, pieces } = schema;
  const own = records.pieces;

  const bodies = {
    receipt: {
      status: oneOf(["verified"]),
      verifiedFor: own.TARGETS,
      targetFileKey: "string",
      lastRunScope: pieces.SCOPE,
      planDigest: "digest",
      beforeDigest: "digest",
      afterDigest: "digest",
      previousReceiptDigest: "digest?",
      publicationEvidence: pieces.PUBLICATION,
      acceptanceEvidence: pieces.ACCEPTANCE,
      identityMap: [own.IDENTITY],
      identityReviewDigest: "digest?",
      brand: {
        inputDigest: "digest",
        projectionDigest: "digest",
        sourceGitCommit: "sha",
      },
      releasedSlots: [own.RELEASED_SLOT],
      managedSlots: [own.MANAGED_SLOT],
      managedAssets: [own.MANAGED_ASSET],
      changes: {
        planned: "count",
        applied: "count",
        recoveredAlreadyApplied: "count",
        createdAssets: "count",
        importedAssets: "count",
      },
      verification: {
        exactColors: "count",
        exactPrimaryEffects: "count",
        remainingBaseBrandSlots: "count",
        sourceKeysPreserved: "boolean",
        brokenInstances: "count",
        protectedChanges: "count",
        outsideScopeChanges: "count",
        unresolved: "count",
        unsupported: "count",
        coverage: pieces.COVERAGE,
        sourceSemanticCoverage: {
          managed: "count",
          withSourceSlot: "count",
          directBinding: "count",
        },
        errors: "array",
      },
    },
  };

  const checks = {
    receipt(value, tools) {
      const owned = value.managedSlots
        .map((slot) => slot.locator.fileKey)
        .concat(value.releasedSlots.map((slot) => slot.locator.fileKey))
        .concat(value.managedAssets.map((asset) => asset.fileKey))
        .concat([value.lastRunScope.fileKey]);
      if (owned.some((fileKey) => fileKey !== value.targetFileKey)) {
        tools.fail("ARTIFACT_INVALID", "receipt 內含其他檔案的項目");
      }
      const pending = value.managedSlots
        .concat(value.managedAssets)
        .some(
          (item) =>
            !item.lastVerifiedRunId ||
            !item.verifiedValue ||
            !item.lastWrittenValue,
        );
      if (pending) tools.fail("ARTIFACT_INVALID", "receipt 含未驗證的受管項目");
    },
  };

  return { bodies, checks };
}
