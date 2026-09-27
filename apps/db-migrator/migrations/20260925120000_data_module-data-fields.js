/**
 * data:兩張示範表回填模組資料的兩個欄位(api `tenantScopePlugin({ moduleData: true })`)。
 *
 * - `moduleKey`:固定欄位模組寫死自己的 key(`demo_items_one` → `demo.sub.sample-one`、
 *   `demo_items_two` → `demo.sample-two`)
 * - `tenantId`:依 `orgId` 的祖先推導租戶頂層(`ancestors` = [根, 租戶頂層, …]);根組織的資料為 null
 *
 * **所屬組織已不存在的孤兒資料不回填**(兩欄都不寫):寫 `tenantId: null` 等於把它標成根組織的資料。
 * 與 api 的 `BaseRepository.create` 同一個 fail-closed 判準(找不到組織就不寫);
 * 略過的筆數與 id 印在 migration 的輸出上,由人處理。沒有 `moduleKey` 的文件在資料範圍規則命中時看不到。
 *
 * 冪等:只補「還沒有 `moduleKey`」的文件,重跑不動已補過的;孤兒每次重跑都會再列一次。
 */

const MODULE_DATA_TABLES = [
  { collection: "demo_items_one", moduleKey: "demo.sub.sample-one" },
  { collection: "demo_items_two", moduleKey: "demo.sample-two" },
];

/**
 * @param org {{ _id: import('mongodb').ObjectId, ancestors?: import('mongodb').ObjectId[] }}
 * @returns {import('mongodb').ObjectId | null}
 */
function tenantIdOf(org) {
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
      if (!org) {
        await reportOrphans(table, orgId);
        continue;
      }
      await table.updateMany(
        { orgId, moduleKey: { $exists: false } },
        { $set: { moduleKey, tenantId: tenantIdOf(org) } },
      );
    }
  }
};

/**
 * 印出某個不存在組織底下、沒回填的文件(STRUCT-06:CLI 的輸出走 stdout)。
 *
 * @param table {import('mongodb').Collection}
 * @param orgId {unknown}
 * @returns {Promise<void>}
 */
async function reportOrphans(table, orgId) {
  const orphans = await table
    .find({ orgId, moduleKey: { $exists: false } }, { projection: { _id: 1 } })
    .toArray();
  const ids = orphans.map((document) => String(document._id));
  process.stdout.write(
    `[module-data-fields] ${table.collectionName}:所屬組織 ${String(orgId)} 不存在,略過 ${String(ids.length)} 筆:${ids.join(", ")}\n`,
  );
}

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
