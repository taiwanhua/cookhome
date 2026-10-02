/**
 * `migrate:down`:還原最後一支已執行的 migration(`docs/plans/seed-migration.md`「唯一執行入口與歷史快照」)。
 *
 * 與 update 同一把鎖、同一個來源收集器,經 migrate-mongo 呼叫原檔的 `down`。**只還原這一支的資料變更**:
 * 種子、定義與安裝紀錄不會回復。有未完成的 update、或該檔沒有 `down` 就拒絕。
 * 執行前先記 `rollback-in-progress`,原套件成功(changelog 紀錄已刪)後才記 `rolled-back`;
 * 之後這一支恢復為未執行,下次 update 照原資料前置重新判斷。
 */
import type { Document } from "mongodb";

import { definitionSeedId } from "@repo/domain/seed";

import {
  type MigrationJournalRecord,
  UpdateJournal,
  UpdateJournalError,
  findUnfinishedUpdate,
} from "./journal";
import { assertSeedLockOwner } from "./lock";
import { rollbackMigration } from "./migrate-adapter";
import type { MigrationSource, UpdatePlan } from "./plan";
import type { UpdateContext } from "./runner";

type RollbackContext = Pick<
  UpdateContext,
  "database" | "client" | "lock" | "hooks" | "print"
>;

interface RollbackTarget {
  source: MigrationSource;
  /** 接續中的還原紀錄(第一次還原為 null)。 */
  record: MigrationJournalRecord | null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** journal 記過這支 migration 的來源 hash:現在的檔案內容必須相同,否則執行的會是另一份 down。 */
function assertSameSource(
  source: MigrationSource,
  record: MigrationJournalRecord,
): void {
  if (source.sourceHash !== record.sourceHash) {
    throw new UpdateJournalError(
      `${source.fileName} 的來源檔內容與執行時記下的不同;已發布的 migration 不可改寫,不會以另一份內容的 down 還原`,
    );
  }
}

/**
 * 要還原哪一支:有未完成的還原就接續它,否則是已執行者中 filename 最後的那一支。
 * 還沒走完的 update(migration 未完成、普通種子 / 定義 / 最後核對沒走完,或有中斷的定義安裝)先擋下;
 * 接續自己中斷的還原不受這一條限制(它本來就要先做完,update 才會繼續)。
 */
async function selectTarget(
  context: RollbackContext,
  journal: UpdateJournal,
  plan: UpdatePlan,
): Promise<RollbackTarget | null> {
  const unfinished = await findUnfinishedUpdate(
    context.database,
    context.lock.runId,
  );
  if (unfinished.migrations.length > 0) {
    throw new UpdateJournalError(
      `有未完成的 update(${unfinished.migrations
        .map(({ fileName, status }) => `${fileName}:${status}`)
        .join("、")}):請先以 update 接續完成,down 不會繞過它`,
    );
  }
  const open = await journal.openMigrations();
  const [resuming, ...others] = open;
  if (others.length > 0) {
    throw new UpdateJournalError(
      `有多筆未完成的還原紀錄(${open.map(({ fileName }) => fileName).join("、")}),請先查明`,
    );
  }
  if (resuming !== undefined) {
    const source = plan.sources.find(
      ({ fileName }) => fileName === resuming.fileName,
    );
    if (source === undefined) {
      throw new UpdateJournalError(
        `${resuming.fileName} 的還原尚未完成,但來源檔已不存在,無法接續`,
      );
    }
    assertSameSource(source, resuming);
    return { source, record: resuming };
  }
  const { run, installations } = unfinished;
  if (installations.length > 0) {
    throw new UpdateJournalError(
      `有未完成的受管定義安裝(${installations
        .map((item) => definitionSeedId(item))
        .join(
          "、",
        )}):請以同一個 revision 的來源執行 update 接續完成;down 不會越過它,也不會替它發布或清理`,
    );
  }
  if (run !== null) {
    throw new UpdateJournalError(
      `有未完成的 update(run ${run.runId}:${run.status},停在 ${run.stage} 階段):migration 之後的種子、定義或核對還沒走完,請先以 update 接續完成,down 不會繞過它`,
    );
  }
  const applied = new Set(plan.applied.map(({ fileName }) => fileName));
  const source = plan.sources.findLast(({ fileName }) => applied.has(fileName));
  return source === undefined ? null : { source, record: null };
}

/**
 * 還原一支 migration;回傳被還原的檔名(沒有可還原的回 null)。
 * 不取得也不釋放鎖(由最外層命令持有)。
 */
export async function rollbackLastMigration(
  context: RollbackContext,
  plan: UpdatePlan,
): Promise<string | null> {
  const { database, client, lock, hooks, print } = context;
  const journal = new UpdateJournal(database, lock);
  await journal.beginRun(plan.planHash, "rollback");
  try {
    const target = await selectTarget(context, journal, plan);
    if (target === null) {
      print("migrate:down:沒有可還原的 migration");
      await journal.finishRun("succeeded", { report: { rolledBack: null } });
      return null;
    }
    const { source } = target;
    const { fileName } = source;
    if (!source.exports.down) {
      throw new UpdateJournalError(
        `${fileName} 沒有 export down,無法還原(不會只刪 changelog 紀錄假裝已還原)`,
      );
    }
    let { record } = target;
    if (record === null) {
      // update 記過這一支的來源就核對;改版前由 migrate-mongo 直接記的 changelog 沒有可比的 hash,照歷史相容執行
      const previous = await journal.latestApplied(fileName);
      if (previous !== null) {
        assertSameSource(source, previous);
      }
      record =
        previous === null
          ? await journal.createMigration({
              fileName,
              sourceHash: source.sourceHash,
              status: "rollback-in-progress",
              mode: "plain",
              inspection: null,
              context: null,
            })
          : await journal.transition(
              previous,
              ["applied"],
              "rollback-in-progress",
            );
    }
    await hooks.reached("rollback-started", fileName);
    // 接續時 changelog 紀錄可能已經刪了(down 做完、只差最後一筆 journal)
    if (plan.applied.some((entry) => entry.fileName === fileName)) {
      await assertSeedLockOwner(database, lock);
      await rollbackMigration(database, client, source);
    }
    await hooks.reached("rollback-done", fileName);
    await journal.transition(record, ["rollback-in-progress"], "rolled-back");
    const report: Document = { rolledBack: fileName };
    await journal.finishRun("succeeded", { report });
    print(
      `migrate:down:已還原 ${fileName}(只還原這支 migration 的資料變更;種子、定義與安裝紀錄不會回復)`,
    );
    return fileName;
  } catch (error) {
    await journal.finishRun("failed", { error: messageOf(error) }).catch(() => {
      /* 記不進去不蓋掉原本的錯 */
    });
    throw error;
  }
}
