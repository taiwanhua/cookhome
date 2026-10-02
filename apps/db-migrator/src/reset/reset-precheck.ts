/**
 * `data` 模式刪除之前的唯讀預檢(`docs/plans/seed-migration.md`「重置與操作者確認」):
 * 有任何做到一半的東西就**整次拒絕**,不替它續發、也不把半成品清掉。
 *
 * - 未完成的 update:migration 停在 preparing / started / verified、還原(down)做到一半、
 *   最近一次會套種子的執行沒有走完、受管定義的安裝紀錄還是 in-progress(`update/journal.ts`)
 * - 中斷的發布或退役:**所有**表單與流程(不只受管的;畫面上自建的發布不會有安裝紀錄)。
 *   判準與 api 的 `versioning/version-lifecycle.ts` `interruptedPublishOf` 相同 —— 有 `publishing` 的版本,
 *   或有 `published` 的版本但它不是身分的 `currentVersion`;另加退役只做了第一步
 *   (`currentVersion` 指到的版本已不是 `published`)
 *
 * 操作者先以同一個 revision 的來源執行 update、或在畫面上重試發布 / 退役把它做完,再明確執行 reset。
 * `full` 不經這一段:它已明確要清庫,中斷的發布會一起清掉再依所選版本重建。
 */
import type { Db } from "mongodb";

import { definitionSeedId } from "@repo/domain/seed";

import { findOpenMigrations, findUnfinishedUpdate } from "../update/journal";
import { DEFINITION_STORES, type DefinitionStore } from "./reset-retention";

/** 預檢沒過;`blockers` 逐項列出。此時還沒有刪除任何資料。 */
export class ResetPrecheckError extends Error {
  override name = "ResetPrecheckError";

  constructor(readonly blockers: readonly string[]) {
    super(
      `data reset 預檢未通過(尚未刪除任何資料):\n- ${blockers.join("\n- ")}\n請先以同一版來源執行 update 接續完成(中斷的發布 / 退役在畫面上重試),再明確執行 reset;預檢不會替它發布或清掉半成品`,
    );
  }
}

interface IdentityState {
  key: string;
  currentVersion?: number | null;
}

interface VersionState {
  version: number | null;
  status: string;
  [keyField: string]: unknown;
}

/** 一種定義(表單 / 流程)裡所有中斷的發布與退役。 */
async function interruptedLifecyclesOf(
  database: Db,
  label: string,
  store: DefinitionStore,
): Promise<string[]> {
  const identities = await database
    .collection(store.identities)
    .find<IdentityState>({}, { projection: { key: 1, currentVersion: 1 } })
    .sort({ key: 1 })
    .toArray();
  const versions = await database
    .collection(store.versions)
    .find<VersionState>(
      { status: { $in: ["publishing", "published"] } },
      { projection: { [store.keyField]: 1, version: 1, status: 1 } },
    )
    .sort({ [store.keyField]: 1, version: 1 })
    .toArray();
  const currentOf = new Map(
    identities.map(({ key, currentVersion }) => [key, currentVersion ?? null]),
  );
  const published = new Set<string>();
  const blockers: string[] = [];
  for (const record of versions) {
    const key = String(record[store.keyField]);
    const version = String(record.version);
    if (record.status === "publishing") {
      blockers.push(`${label} ${key} 的版本 ${version} 發布進行中(publishing)`);
      continue;
    }
    published.add(`${key}@${version}`);
    if (currentOf.get(key) !== record.version) {
      blockers.push(
        `${label} ${key} 的版本 ${version} 已是 published,但 currentVersion 尚未切換(目前 ${String(currentOf.get(key) ?? null)})`,
      );
    }
  }
  for (const [key, current] of currentOf) {
    if (current !== null && !published.has(`${key}@${String(current)}`)) {
      blockers.push(
        `${label} ${key} 的 currentVersion 指向版本 ${String(current)},但它不是 published(退役未完成)`,
      );
    }
  }
  return blockers;
}

/**
 * 目前擋住 `data` reset 的所有項目(唯讀;沒有就是空陣列)。`runId`:呼叫端自己這一次不列入。
 */
export async function findResetBlockers(
  database: Db,
  runId: string,
): Promise<string[]> {
  const unfinished = await findUnfinishedUpdate(database, runId);
  const open = await findOpenMigrations(database);
  const blockers = [
    ...unfinished.migrations.map(
      ({ fileName, status }) => `migration ${fileName} 未完成(${status})`,
    ),
    ...open
      .filter(({ status }) => status === "rollback-in-progress")
      .map(
        ({ fileName }) =>
          `migration ${fileName} 的還原(down)尚未完成(rollback-in-progress)`,
      ),
    ...unfinished.installations.map(
      (item) =>
        `受管定義 ${definitionSeedId(item)} 的安裝尚未完成(in-progress)`,
    ),
  ];
  if (unfinished.run !== null) {
    const { operation, runId: unfinishedRun, status, stage } = unfinished.run;
    blockers.push(
      `最近一次 ${operation}(run ${unfinishedRun})沒有走完:${status},停在 ${stage} 階段`,
    );
  }
  blockers.push(
    ...(await interruptedLifecyclesOf(
      database,
      "表單",
      DEFINITION_STORES["form-definition"],
    )),
    ...(await interruptedLifecyclesOf(
      database,
      "流程",
      DEFINITION_STORES["workflow-definition"],
    )),
  );
  return blockers;
}
