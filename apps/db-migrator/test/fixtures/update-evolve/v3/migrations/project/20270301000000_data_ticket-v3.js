/* eslint-disable unicorn/filename-case -- migration 的檔名規約是 <時間戳>_<類別>_<描述>.js(src/migration-filename.ts);到期條件:規約改變時移除 */
/**
 * 夾具:把工單第二版的提交轉成第三版(補上備註),依賴第三版的快照(也是目前 registry 登記的那一份)。
 *
 * - 來源條件:沒有走流程、已有 `values.priority`、還沒有 `values.note` 的工單提交
 * - 欄位映射:`values.note` 補空字串,`version` 改成第三版在該環境的版號
 * - 不動:走流程中的提交、既有的修訂、流程實例
 *
 * 沒有 `down`:這一支不能還原。
 */
const FILE = "20270301000000_data_ticket-v3.js";
const FORM_KEY = "update_ticket";
const REVISION = "r3";
/** 允許的來源:工單目前的發布內容必須是第二版(`update_ticket.r2.seed.ts` 的 contentHash)。 */
const R2_CONTENT_HASH =
  "sha256:acf24f99a2ee0ad793bb23024047571c5fd22356692de4bce86f57e338044856";

export const seedDependencies = ["project/revisions/update_ticket.r3.seed.ts"];

const CONVERTIBLE = {
  formKey: FORM_KEY,
  currentInstanceId: null,
  "values.priority": { $exists: true },
  "values.note": { $exists: false },
};

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
  const target = targetOf(inspection.snapshots);
  if (target === undefined) {
    throw new Error(`${FILE}:檢視結果裡沒有 ${FORM_KEY}@${REVISION}`);
  }
  if (target.installed) {
    return;
  }
  if (target.currentContentHash !== R2_CONTENT_HASH) {
    throw new Error(
      `${FILE}:工單目前的發布內容不是第二版(${String(target.currentContentHash)}),不能安裝第三版`,
    );
  }
};

/**
 * @param db {import('mongodb').Db}
 * @param client {import('mongodb').MongoClient}
 * @param context {{ definitions: Array<Record<string, unknown>> }}
 * @returns {Promise<{ processed: number, skipped: number, conflicts: number }>}
 */
export const up = async (db, client, context) => {
  const target = targetOf(context.definitions);
  if (target === undefined) {
    throw new Error(`${FILE}:context 沒有 ${FORM_KEY}@${REVISION}`);
  }
  const { modifiedCount } = await db
    .collection("form_submissions")
    .updateMany(CONVERTIBLE, {
      $set: { "values.note": "", version: target.localVersion },
    });
  return { processed: modifiedCount, skipped: 0, conflicts: 0 };
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const verify = async (db) => {
  const remaining = await db
    .collection("form_submissions")
    .countDocuments(CONVERTIBLE);
  if (remaining > 0) {
    throw new Error(`${FILE}:還有 ${String(remaining)} 筆提交沒有轉換`);
  }
};
