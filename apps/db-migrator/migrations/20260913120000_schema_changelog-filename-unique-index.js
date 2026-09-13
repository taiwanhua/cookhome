/**
 * schema:為 changelog.fileName 建立唯一索引。
 *
 * changelog 是 migrate-mongo 記錄「哪些遷移跑過」的 collection;
 * fileName 唯一索引保證同一支遷移不會被重複記錄(防重跑的最後防線)。
 */

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db
    .collection("changelog")
    .createIndex({ fileName: 1 }, { name: "fileName_unique", unique: true });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("changelog").dropIndex("fileName_unique");
};
