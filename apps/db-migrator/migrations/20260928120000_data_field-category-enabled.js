/**
 * data:`field_categories.enabled` 的既有資料回填。
 *
 * 類別可以停用之後(停用只影響表單設計器的類別清單與新選),既有類別一律補 `enabled: true`。
 * 系統類別之後由 seed 宣告的初值接手(`enabled` 是初始 seed 值的欄位,欄位存在就不覆寫),
 * 這支只保證「沒有這一欄的文件」有值 —— 包含 root 在畫面建、seed 沒宣告的類別。
 *
 * 冪等:只補欄位不存在的文件。
 */

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db
    .collection("field_categories")
    .updateMany({ enabled: { $exists: false } }, { $set: { enabled: true } });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db
    .collection("field_categories")
    .updateMany({}, { $unset: { enabled: "" } });
};
