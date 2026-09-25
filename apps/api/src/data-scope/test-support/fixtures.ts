import type { Connection } from "mongoose";

/**
 * 某模組的資料範圍目標 id(`saveDataScopeRule` / `dataScopeRule` 以它指定目標)。
 * 目標由 seed 依模組宣告登記(一個模組一個,`(collection, moduleKey)` 唯一);
 * 測試直接讀 seed 寫進去的那一筆,不必先打 `dataScopeTargets`。
 */
export async function dataScopeTargetIdOf(
  connection: Connection,
  moduleKey: string,
): Promise<string> {
  const target = await connection
    .collection("data_scope_targets")
    .findOne({ moduleKey }, { projection: { _id: 1 } });
  if (!target) {
    throw new Error(`seed 沒有登記 ${moduleKey} 的資料範圍目標`);
  }
  return String(target._id);
}

/** 示範模組1 的模組 key(它宣告了 `demo_items_one` 這個目標)。 */
export const SAMPLE_ONE_MODULE_KEY = "demo.sub.sample-one";
