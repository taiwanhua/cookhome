/**
 * `data` 模式的刪除動作(正本:ADR-0002「還原(reset)」)。
 *
 * 掃過資料庫**現有的每一個 collection**(不是寫死的清單),各自依 `reset-plan.ts` 的處置刪除;
 * 新長出來的業務 collection 因此自動被清掉,不必回頭改這支。核心關聯最後處理:
 * 先收齊這一輪被刪掉的所有文件 id,再刪「任一端指向被刪文件」的關聯。
 */
import type { Db, Document, Filter, ObjectId } from "mongodb";

import type { SeedRegistry } from "../seed/seed-declaration";
import {
  CORE_RELATIONSHIPS_COLLECTION,
  type ResetAction,
  planFor,
  seedManagedKeys,
} from "./reset-plan";

/** 一次 `$in` 塞太多 id 會讓查詢文件超過 16MB 上限,分批刪。 */
const RELATION_ID_CHUNK = 500;

export interface ResetDeletion {
  collection: string;
  deleted: number;
}

/** 處置 → 刪除條件;`null` = 這個 collection 不在這一輪直接刪(保留或另外算)。 */
function filterFor(
  action: ResetAction,
  rootAccount: string,
): Filter<Document> | null {
  switch (action.kind) {
    case "preserve":
    case "relations": {
      return null;
    }
    case "wipe": {
      return {};
    }
    case "keep-root-admin": {
      // root 初始超級管理員以 account 識別(seed 也是,`src/seed/root-admin.ts`)
      return { account: { $ne: rootAccount } };
    }
    case "keep-seed-keys": {
      // 識別鍵不在宣告清單裡 = 人建的;欄位根本不存在的文件也會被 $nin 選中(正是租戶自建的那些)
      return { [action.keyField]: { $nin: action.keys } };
    }
  }
}

async function deleteDanglingRelations(
  database: Db,
  deletedIds: ObjectId[],
): Promise<number> {
  const relations = database.collection(CORE_RELATIONSHIPS_COLLECTION);
  let deleted = 0;
  for (let index = 0; index < deletedIds.length; index += RELATION_ID_CHUNK) {
    const chunk = deletedIds.slice(index, index + RELATION_ID_CHUNK);
    const { deletedCount } = await relations.deleteMany({
      $or: [{ firstId: { $in: chunk } }, { secondId: { $in: chunk } }],
    });
    deleted += deletedCount;
  }
  return deleted;
}

/**
 * 只刪「人建的資料」,seed 管的文件與其現值留著(含人改過的 `enabled` / `icon`)。
 * 回傳每個 collection 的刪除筆數,呼叫端負責輸出與後續的 seed。
 */
export async function resetData(
  database: Db,
  registry: SeedRegistry,
  rootAccount: string,
): Promise<ResetDeletion[]> {
  const managed = seedManagedKeys(registry);
  const collections = await database
    .listCollections({}, { nameOnly: true })
    .toArray();
  const names = collections
    .map(({ name }) => name)
    .toSorted((left, right) => left.localeCompare(right));

  const deletions: ResetDeletion[] = [];
  const deletedIds: ObjectId[] = [];

  for (const name of names) {
    const filter = filterFor(planFor(name, managed), rootAccount);
    if (filter === null) {
      continue;
    }
    const collection = database.collection(name);
    // 先取要刪的 id 再刪:關聯表要靠這批 id 判斷「任一端指向被刪文件」
    const ids: ObjectId[] = await collection.distinct("_id", filter);
    if (ids.length === 0) {
      deletions.push({ collection: name, deleted: 0 });
      continue;
    }
    deletedIds.push(...ids);
    const { deletedCount } = await collection.deleteMany({ _id: { $in: ids } });
    deletions.push({ collection: name, deleted: deletedCount });
  }

  deletions.push({
    collection: CORE_RELATIONSHIPS_COLLECTION,
    deleted: await deleteDanglingRelations(database, deletedIds),
  });
  return deletions;
}
