/**
 * data:三個新欄位的既有資料回填。
 *
 * - `orgs.slug`:既有租戶頂層(`ancestors` 只有根組織一層)補 `tenant_<id 後 6 碼>`;
 *   撞到已有的短碼時改用後 12 碼(仍在 `^[a-z][a-z0-9_]{1,19}$` 內)。並建 `slug` 唯一稀疏索引
 *   (與 api 的 org.schema.ts 同一組;api 啟動時的 autoIndex 也會建,這裡先建好,重複值在此就會爆)
 * - `permissions.source`:既有權限都是 seed 宣告的 → `seed`;`retiredAt` 補 null
 * - `modules.engine`:既有模組都是固定欄位模組 → `fixed`(seed 之後依宣告同步,表單模組會被改成 `form`)
 *
 * 冪等:只補欄位不存在的文件。
 */

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const orgs = db.collection("orgs");
  const tenantTops = await orgs
    .find(
      { ancestors: { $size: 1 }, slug: { $exists: false } },
      { projection: { _id: 1 } },
    )
    .toArray();
  for (const org of tenantTops) {
    const hex = org._id.toHexString();
    let slug = `tenant_${hex.slice(-6)}`;
    if (await orgs.findOne({ slug }, { projection: { _id: 1 } })) {
      slug = `tenant_${hex.slice(-12)}`;
    }
    await orgs.updateOne({ _id: org._id }, { $set: { slug } });
  }
  await orgs.createIndex({ slug: 1 }, { unique: true, sparse: true });

  await db
    .collection("permissions")
    .updateMany({ source: { $exists: false } }, { $set: { source: "seed" } });
  await db
    .collection("permissions")
    .updateMany(
      { retiredAt: { $exists: false } },
      { $set: { retiredAt: null } },
    );

  await db
    .collection("modules")
    .updateMany({ engine: { $exists: false } }, { $set: { engine: "fixed" } });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  const orgs = db.collection("orgs");
  const indexes = await orgs.indexes().catch(() => []);
  if (indexes.some((index) => index.name === "slug_1")) {
    await orgs.dropIndex("slug_1");
  }
  await orgs.updateMany(
    { slug: { $regex: "^tenant_[0-9a-f]+$" } },
    { $unset: { slug: "" } },
  );
  await db
    .collection("permissions")
    .updateMany({ source: "seed" }, { $unset: { source: "", retiredAt: "" } });
  await db
    .collection("modules")
    .updateMany({ engine: "fixed" }, { $unset: { engine: "" } });
};
