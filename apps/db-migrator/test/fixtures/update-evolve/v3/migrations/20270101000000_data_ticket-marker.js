/* eslint-disable unicorn/filename-case -- migration 的檔名規約是 <時間戳>_<類別>_<描述>.js(src/migration-filename.ts);到期條件:規約改變時移除 */
/**
 * 夾具:改版前就存在的根目錄 migration(沒有 seed 依賴)。每執行一次 up 就把計數加一,
 * 測試用它確認已記在 changelog 的檔不會被重跑。
 */

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db
    .collection("update_fixture_marks")
    .updateOne(
      { _id: "ticket-marker" },
      { $inc: { runs: 1 } },
      { upsert: true },
    );
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db
    .collection("update_fixture_marks")
    .deleteOne({ _id: "ticket-marker" });
};
