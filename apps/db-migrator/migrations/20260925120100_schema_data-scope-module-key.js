/**
 * schema:資料範圍目標 / 規則的識別鍵由 `collection` 改為 `(collection, moduleKey)`。
 *
 * 1. `data_scope_targets` 回填 `moduleKey`:既有目標只有示範模組1 宣告的 `demo_items_one`
 *    → `demo.sub.sample-one`(`KNOWN_TARGETS`);不認得的 collection 不猜,留給 seed 重建
 * 2. `data_scope_rules` 回填 `moduleKey`:同一 collection 恰有一個已回填的目標時取它的 moduleKey
 * 3. 兩張表拿掉舊的 `collection` 唯一索引、建 `(collection, moduleKey)` 唯一索引
 *    (不拿掉舊的,同一張表的第二個模組目標會被舊索引擋下)
 *
 * 冪等:回填只動「還沒有 moduleKey」的文件;索引先查再刪 / 建。
 */

const KNOWN_TARGETS = { demo_items_one: "demo.sub.sample-one" };

const TABLES = ["data_scope_targets", "data_scope_rules"];

/** 舊索引:鍵剛好是 `{ collection: 1 }` 的唯一索引(名稱由 mongoose 產,不寫死)。 */
async function dropIndexByKey(collection, key) {
  const indexes = await collection.indexes().catch(() => []);
  const target = JSON.stringify(key);
  for (const index of indexes) {
    if (JSON.stringify(index.key) === target && index.name) {
      await collection.dropIndex(index.name);
    }
  }
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const targets = db.collection("data_scope_targets");
  const rules = db.collection("data_scope_rules");

  for (const [collection, moduleKey] of Object.entries(KNOWN_TARGETS)) {
    await targets.updateMany(
      { collection, moduleKey: { $exists: false } },
      { $set: { moduleKey } },
    );
  }

  const pending = await rules
    .find({ moduleKey: { $exists: false } }, { projection: { collection: 1 } })
    .toArray();
  for (const rule of pending) {
    const owners = await targets
      .find(
        { collection: rule.collection, moduleKey: { $exists: true } },
        { projection: { moduleKey: 1 } },
      )
      .toArray();
    if (owners.length === 1) {
      await rules.updateOne(
        { _id: rule._id },
        { $set: { moduleKey: owners[0].moduleKey } },
      );
    }
  }

  for (const name of TABLES) {
    const collection = db.collection(name);
    await dropIndexByKey(collection, { collection: 1 });
    await collection.createIndex(
      { collection: 1, moduleKey: 1 },
      { unique: true },
    );
  }
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  // 退回「collection 唯一」之前先確認不會撞:同一張表已有兩個以上模組的目標 / 規則
  // (如 form_submissions 被多個表單模組宣告)時,重建舊索引一定失敗,而且沒有正確的合併方式
  // (該留哪個模組的規則?)—— 明確拒絕,由人先處理掉多出來的目標與規則再退
  for (const name of TABLES) {
    const duplicated = await db
      .collection(name)
      .aggregate([
        { $group: { _id: "$collection", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    if (duplicated.length > 0) {
      throw new Error(
        `${name} 有 collection 對應多個模組(${duplicated.map((entry) => String(entry._id)).join(", ")}),無法退回以 collection 為唯一鍵;請先刪掉多出來的目標與規則`,
      );
    }
  }
  for (const name of TABLES) {
    const collection = db.collection(name);
    await dropIndexByKey(collection, { collection: 1, moduleKey: 1 });
    await collection.updateMany({}, { $unset: { moduleKey: "" } });
    await collection.createIndex({ collection: 1 }, { unique: true });
  }
};
