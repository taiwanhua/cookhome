/**
 * reset 的清除動作(正本:ADR-0002「還原(reset)」、`docs/concepts/data-layer-and-isolation.md`「還原」)。
 *
 * `data`:掃過資料庫**現有的每一個 collection**(不是寫死的清單),各自依 `reset-plan.ts` 的處置
 * 先算出要刪哪些文件(`planDataReset`,唯讀 —— 也就是輸出給操作者的刪留計畫),再執行(`executeDataReset`)。
 * 新長出來的業務 collection 因此自動被清掉,不必回頭改這支。核心關聯**最先**處理:
 * 刪掉「任一端指向即將被刪文件」的關聯,再刪文件 —— 中途失敗時不會留下指向已刪文件的關聯。
 *
 * `full`:逐一 drop 整批鎖以外的每一個 collection(連同索引)。不用 `dropDatabase`:
 * 那會把持有中的整批鎖一起丟掉,清庫與重建之間就沒有互斥了。
 *
 * 不取得也不釋放鎖;每個 collection **清除之前**與之後各回呼一次,由指令層在動手前核對鎖還在自己手上
 * 並記進度(鎖被解除後不會再多清任何一個),清完後過檢查點。
 */
import type { Db, Document, Filter, ObjectId } from "mongodb";

import { SEED_LOCK_COLLECTION } from "@repo/domain/seed";

import type { SeedRegistry } from "../seed/seed-declaration";
import {
  CORE_RELATIONSHIPS_COLLECTION,
  type ResetAction,
  type RetainedDocuments,
  planFor,
  seedManagedKeys,
} from "./reset-plan";

/** 一次 `$in` 塞太多 id 會讓查詢文件超過 16MB 上限,分批刪。 */
const ID_CHUNK = 500;

export interface ResetDeletion {
  collection: string;
  deleted: number;
}

/** 一個 collection 的刪留計畫。 */
export interface PlannedCollectionReset {
  collection: string;
  /** 要刪的文件。 */
  ids: ObjectId[];
  /** 留下的筆數。 */
  kept: number;
}

/** `data` 模式的刪留計畫(核心關聯在執行時依要刪的文件算)。 */
export interface DataResetPlan {
  collections: PlannedCollectionReset[];
}

/** 清除一個 collection 前後的回呼。 */
export interface ClearCallbacks {
  /** 動手之前(collection 名、第幾個、共幾個);丟錯就不清這一個、也不再往下。 */
  before(collection: string, position: number, total: number): Promise<void>;
  /** 這一個清完之後。 */
  after(collection: string): Promise<void>;
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
      return {
        [action.keyField]: { $nin: action.keys },
        _id: { $nin: action.keepIds },
      };
    }
    case "keep-ids": {
      return { _id: { $nin: action.ids } };
    }
  }
}

async function collectionNames(database: Db): Promise<string[]> {
  const collections = await database
    .listCollections({}, { nameOnly: true })
    .toArray();
  return (
    collections
      .map(({ name }) => name)
      // MongoDB 自己的 system.* 不是應用資料
      .filter((name) => !name.startsWith("system."))
      .toSorted((left, right) => left.localeCompare(right, "zh-Hant"))
  );
}

function chunksOf(ids: readonly ObjectId[]): ObjectId[][] {
  const chunks: ObjectId[][] = [];
  for (let index = 0; index < ids.length; index += ID_CHUNK) {
    chunks.push(ids.slice(index, index + ID_CHUNK));
  }
  return chunks;
}

/**
 * 算出 `data` 模式的刪留計畫(唯讀):只刪「人建的資料」,seed 管的文件與其現值留著
 * (含人改過的 `enabled` / `icon`),受管定義的保留閉包由 `retained` 指名。
 */
export async function planDataReset(
  database: Db,
  registry: SeedRegistry,
  rootAccount: string,
  retained: RetainedDocuments,
): Promise<DataResetPlan> {
  const managed = seedManagedKeys(registry);
  const collections: PlannedCollectionReset[] = [];
  for (const name of await collectionNames(database)) {
    const filter = filterFor(planFor(name, managed, retained), rootAccount);
    if (filter === null) {
      continue;
    }
    const collection = database.collection(name);
    // 先取要刪的 id 再刪:關聯表要靠這批 id 判斷「任一端指向被刪文件」
    const ids: ObjectId[] = await collection.distinct("_id", filter);
    const total = await collection.countDocuments();
    collections.push({ collection: name, ids, kept: total - ids.length });
  }
  return { collections };
}

async function deleteRelationsOf(
  database: Db,
  deletedIds: readonly ObjectId[],
): Promise<number> {
  const relations = database.collection(CORE_RELATIONSHIPS_COLLECTION);
  let deleted = 0;
  for (const chunk of chunksOf(deletedIds)) {
    const { deletedCount } = await relations.deleteMany({
      $or: [{ firstId: { $in: chunk } }, { secondId: { $in: chunk } }],
    });
    deleted += deletedCount;
  }
  return deleted;
}

/**
 * 依計畫刪除;回傳每個 collection 的刪除筆數,呼叫端負責輸出與後續的 update。
 * 順序:核心關聯 → 各 collection(依名稱)。重跑同一份計畫是安全的(已刪的刪不到)。
 */
export async function executeDataReset(
  database: Db,
  plan: DataResetPlan,
  callbacks: ClearCallbacks,
): Promise<ResetDeletion[]> {
  const total = plan.collections.length + 1;
  await callbacks.before(CORE_RELATIONSHIPS_COLLECTION, 1, total);
  const deletions: ResetDeletion[] = [
    {
      collection: CORE_RELATIONSHIPS_COLLECTION,
      deleted: await deleteRelationsOf(
        database,
        plan.collections.flatMap(({ ids }) => ids),
      ),
    },
  ];
  await callbacks.after(CORE_RELATIONSHIPS_COLLECTION);
  for (const [index, { collection, ids }] of plan.collections.entries()) {
    await callbacks.before(collection, index + 2, total);
    let deleted = 0;
    for (const chunk of chunksOf(ids)) {
      const { deletedCount } = await database
        .collection(collection)
        .deleteMany({ _id: { $in: chunk } });
      deleted += deletedCount;
    }
    deletions.push({ collection, deleted });
    await callbacks.after(collection);
  }
  return deletions;
}

/** `full` 會清除的 collection:整批鎖以外的全部(含 changelog、執行紀錄與安裝紀錄)。 */
export async function listClearableCollections(
  database: Db,
): Promise<string[]> {
  const names = await collectionNames(database);
  return names.filter((name) => name !== SEED_LOCK_COLLECTION);
}

/**
 * `full`:逐一 drop(文件與索引一起),保留整批鎖。中途失敗後再次執行會從還在的 collection 接著清。
 */
export async function dropCollections(
  database: Db,
  names: readonly string[],
  callbacks: ClearCallbacks,
): Promise<void> {
  for (const [index, name] of names.entries()) {
    await callbacks.before(name, index + 1, names.length);
    await database.collection(name).drop();
    await callbacks.after(name);
  }
}
