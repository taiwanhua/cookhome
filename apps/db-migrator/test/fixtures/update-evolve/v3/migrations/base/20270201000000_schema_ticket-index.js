/* eslint-disable unicorn/filename-case -- migration 的檔名規約是 <時間戳>_<類別>_<描述>.js(src/migration-filename.ts);到期條件:規約改變時移除 */
/**
 * 夾具:底座來源的新 migration(沒有 seed 依賴,有 verify)。時間戳與專案的 `…_data_ticket-v2.js` 相同、
 * basename 不同 —— 合法,依完整檔名排序。
 */
const INDEX_NAME = "update_fixture_ticket_status";

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db
    .collection("form_submissions")
    .createIndex({ formKey: 1, status: 1 }, { name: INDEX_NAME });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const verify = async (db) => {
  const indexes = await db.collection("form_submissions").indexes();
  if (!indexes.some((index) => index.name === INDEX_NAME)) {
    throw new Error(`索引 ${INDEX_NAME} 沒有建立`);
  }
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("form_submissions").dropIndex(INDEX_NAME);
};
