/**
 * data:兩張示範表回填模組資料的兩個欄位(api `tenantScopePlugin({ moduleData: true })`)。
 *
 * - `moduleKey`:固定欄位模組寫死自己的 key(`demo_items_one` → `demo.sub.sample-one`、
 *   `demo_items_two` → `demo.sample-two`)
 * - `tenantId`:依 `orgId` 的祖先推導租戶頂層(`ancestors` = [根, 租戶頂層, …]);
 *   根組織的資料為 null;所屬組織已不存在的資料也寫 null(找不到祖先,不猜)
 *
 * 冪等:只補「還沒有 `moduleKey`」的文件,重跑不動已補過的。
 */

const MODULE_DATA_TABLES = [
  { collection: "demo_items_one", moduleKey: "demo.sub.sample-one" },
  { collection: "demo_items_two", moduleKey: "demo.sample-two" },
];

/**
 * @param org {{ _id: import('mongodb').ObjectId, ancestors?: import('mongodb').ObjectId[] } | null}
 * @returns {import('mongodb').ObjectId | null}
 */
function tenantIdOf(org) {
  if (!org) {
    return null;
  }
  const ancestors = org.ancestors ?? [];
  if (ancestors.length === 0) {
    return null;
  }
  return ancestors[1] ?? org._id;
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const orgs = db.collection("orgs");
  for (const { collection, moduleKey } of MODULE_DATA_TABLES) {
    const table = db.collection(collection);
    const orgIds = await table.distinct("orgId", {
      moduleKey: { $exists: false },
    });
    for (const orgId of orgIds) {
      const org = await orgs.findOne(
        { _id: orgId },
        { projection: { ancestors: 1 } },
      );
      await table.updateMany(
        { orgId, moduleKey: { $exists: false } },
        { $set: { moduleKey, tenantId: tenantIdOf(org) } },
      );
    }
  }
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  for (const { collection } of MODULE_DATA_TABLES) {
    await db
      .collection(collection)
      .updateMany({}, { $unset: { moduleKey: "", tenantId: "" } });
  }
};
