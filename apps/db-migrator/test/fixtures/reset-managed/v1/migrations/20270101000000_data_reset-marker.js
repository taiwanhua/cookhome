/* eslint-disable unicorn/filename-case -- migration 的檔名規約是 <時間戳>_<類別>_<描述>.js(src/migration-filename.ts);到期條件:規約改變時移除 */
/**
 * 夾具:沒有 seed 依賴的 migration。每執行一次 up 就把計數加一,
 * 測試用它確認 data reset 不重跑已記在 changelog 的檔、full reset 清庫後重新執行。
 */

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db
    .collection("reset_fixture_marks")
    .updateOne(
      { _id: "reset-marker" },
      { $inc: { runs: 1 } },
      { upsert: true },
    );
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("reset_fixture_marks").deleteOne({ _id: "reset-marker" });
};
