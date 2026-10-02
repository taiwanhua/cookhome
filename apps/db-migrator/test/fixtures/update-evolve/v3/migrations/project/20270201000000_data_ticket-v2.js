/* eslint-disable unicorn/filename-case -- migration 的檔名規約是 <時間戳>_<類別>_<描述>.js(src/migration-filename.ts);到期條件:規約改變時移除 */
/**
 * 夾具:把工單第一版的提交轉成第二版(補上優先度),依賴第二版的不可變快照。
 *
 * - 來源條件:沒有走流程(`currentInstanceId` 為 null)、還沒有 `values.priority` 的工單提交
 * - 欄位映射:`values.priority` 補 `normal`,`version` 改成第二版在該環境的版號
 * - 不動:走流程中的提交、既有的修訂(`revisions`)、流程實例
 * - 重跑:已有 `values.priority` 的不再處理
 *
 * 測試可在 `update_fixture_controls` 放控制文件,讓 up 做到一半失敗或讓 verify 失敗。
 */
const FILE = "20270201000000_data_ticket-v2.js";
const FORM_KEY = "update_ticket";
const REVISION = "r2";
/** 允許的來源:工單目前的發布內容必須是第一版(`update_ticket.r1.seed.ts` 的 contentHash)。 */
const R1_CONTENT_HASH =
  "sha256:5307732db8129b8436b319aaf4b89306601f12afc3ccb3c1b5268b85a02a8fea";

export const seedDependencies = ["project/revisions/update_ticket.r2.seed.ts"];

const CONVERTIBLE = {
  formKey: FORM_KEY,
  currentInstanceId: null,
  "values.priority": { $exists: false },
};

const isControlled = async (db, name) =>
  (await db
    .collection("update_fixture_controls")
    .countDocuments({ _id: `${name}:${FILE}` })) > 0;

const targetOf = (items) =>
  items.find((item) => item.key === FORM_KEY && item.revision === REVISION);

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<boolean>}
 */
export const appliesTo = async (db) =>
  (await db.collection("form_submissions").countDocuments(CONVERTIBLE)) > 0;

/**
 * @param db {import('mongodb').Db}
 * @param inspection {{ snapshots: Array<Record<string, unknown>>, pending: string[] }}
 * @returns {Promise<void>}
 */
export const assertSeedInstallable = async (db, inspection) => {
  await db
    .collection("update_fixture_marks")
    .updateOne(
      { _id: `assert:${FILE}` },
      { $inc: { runs: 1 } },
      { upsert: true },
    );
  const target = targetOf(inspection.snapshots);
  if (target === undefined) {
    throw new Error(`${FILE}:檢視結果裡沒有 ${FORM_KEY}@${REVISION}`);
  }
  if (target.installed) {
    return;
  }
  if (target.currentContentHash !== R1_CONTENT_HASH) {
    throw new Error(
      `${FILE}:工單目前的發布內容不是第一版(${String(target.currentContentHash)}),不能安裝第二版`,
    );
  }
};

/**
 * @param db {import('mongodb').Db}
 * @param client {import('mongodb').MongoClient}
 * @param context {{ definitions: Array<Record<string, unknown>>, releaseCommit: string, runId: string }}
 * @returns {Promise<{ processed: number, skipped: number, conflicts: number }>}
 */
export const up = async (db, client, context) => {
  const target = targetOf(context.definitions);
  if (target === undefined) {
    throw new Error(`${FILE}:context 沒有 ${FORM_KEY}@${REVISION}`);
  }
  // 測試用:記下每次 up 收到的 context
  await db
    .collection("update_fixture_marks")
    .updateOne(
      { _id: `up:${FILE}` },
      { $inc: { runs: 1 }, $push: { contexts: context } },
      { upsert: true },
    );
  const failsMidway = await isControlled(db, "fail-up");
  const submissions = db.collection("form_submissions");
  let processed = 0;
  // eslint-disable-next-line unicorn/no-array-callback-reference -- mongodb driver 的 `find` 收的是 filter 不是 callback
  for await (const submission of submissions.find(CONVERTIBLE)) {
    await submissions.updateOne(
      { _id: submission._id },
      { $set: { "values.priority": "normal", version: target.localVersion } },
    );
    processed += 1;
    if (failsMidway) {
      throw new Error(`模擬中斷:${FILE} 的 up 只處理了一筆`);
    }
  }
  const skipped = await submissions.countDocuments({
    formKey: FORM_KEY,
    currentInstanceId: { $ne: null },
    "values.priority": { $exists: false },
  });
  return { processed, skipped, conflicts: 0 };
};

/**
 * @param db {import('mongodb').Db}
 * @param context {{ definitions: Array<Record<string, unknown>> }}
 * @returns {Promise<void>}
 */
export const verify = async (db, context) => {
  if (await isControlled(db, "fail-verify")) {
    throw new Error(`模擬 verify 失敗:${FILE}`);
  }
  const remaining = await db
    .collection("form_submissions")
    .countDocuments(CONVERTIBLE);
  if (remaining > 0) {
    throw new Error(`${FILE}:還有 ${String(remaining)} 筆提交沒有轉換`);
  }
  const target = targetOf(context.definitions);
  if (target === undefined) {
    return;
  }
  const versions = await db
    .collection("form_versions")
    .countDocuments({ formKey: FORM_KEY, version: target.localVersion });
  if (versions !== 1) {
    throw new Error(
      `${FILE}:第二版在這個環境的版號 ${String(target.localVersion)} 不存在`,
    );
  }
};
