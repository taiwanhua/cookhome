/**
 * data:表單提交的每筆修訂補上自己的版本(`form_submissions.revisions[].version`)。
 *
 * 舊版資料升級到新版會改綁提交的 `version`,歷史修訂要用**填寫當時**的版本渲染,所以每筆修訂記自己的版本。
 * 升級功能上線前沒有改綁過,既有修訂的版本一律 = 整筆的 `version`。
 *
 * 冪等:只補沒有 `version` 的修訂,已有的不動;重跑找不到要補的就什麼都不做。
 * 讀取端本來就以 `revisions[r].version ?? submission.version` 讀,`down` 不必移除,不做事。
 */

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db
    .collection("form_submissions")
    .updateMany(
      { revisions: { $elemMatch: { version: { $exists: false } } } },
      [
        {
          $set: {
            revisions: {
              $map: {
                input: "$revisions",
                as: "entry",
                in: {
                  $cond: [
                    { $eq: [{ $type: "$$entry.version" }, "missing"] },
                    { $mergeObjects: ["$$entry", { version: "$version" }] },
                    "$$entry",
                  ],
                },
              },
            },
          },
        },
      ],
    );
};

export const down = async () => {};
