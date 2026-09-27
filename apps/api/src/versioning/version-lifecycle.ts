import type { Types } from "mongoose";

import type {
  BaseRepository,
  Persisted,
  RepositoryDocument,
} from "../database/base.repository";
import type { OperatorContext } from "../database/operator-context";
import { isDuplicateKeyError } from "../forms/forms-error";

/**
 * 版本生命週期(Spec 6a §6「發布」;6b 的流程版本複用同一份,少了欄位級權限那一步):
 * 表單版本(`form_versions`)與流程版本(`workflow_versions`)共用的四步發布骨架、冪等重試與退役。
 * **不用 Mongo 交易**(ADR-0007 / ADR-0009:本機與 CI 單節點),只靠條件更新防重複、靠冪等步驟防中斷:
 *
 * 1. 檢查器(呼叫端各自跑,有錯就停)
 * 2. `lockDraft`:條件更新 `{ status: "draft", draftRevision: 預期 } → publishing`,同時配正式版號(最大 + 1)、
 *    記 changelog;沒更新到 → `DRAFT_REVISION_MISMATCH`(兩個發布同時來只有一個搶得到)
 * 3. (表單才有)欄位級權限
 * 4. `switchToPublished`:這一版 `publishing → published` → 其餘 `published → retired` →
 *    擁有者的 `currentVersion` 指向新版(填寫 / 送出只看 `currentVersion`,最後一筆寫完前看到的仍是舊版)
 *
 * 任何一步失敗,資料就停在那一步做到一半的樣子;重試從步驟 3 起重跑,每個寫入「已是目標狀態就跳過」。
 */

/** 步驟 4 每一筆寫入前的檢查點(測試在這裡注入失敗;正式環境只記下來)。 */
export type VersionSwitchCheckpoint =
  "publish-version" | "retire-previous" | "current-version";

/** 生命週期會回的 `CONFLICT` 原因(表單與流程共用同一組語彙)。 */
export type VersionConflictReason =
  | "PUBLISH_IN_PROGRESS"
  | "DRAFT_REVISION_MISMATCH"
  | "CURRENT_VERSION_CHANGED"
  | "NO_CURRENT_VERSION";

/** 版本文件要有的欄位。 */
export interface LifecycleVersion {
  _id: Types.ObjectId;
  version: number | null;
  status: string;
}

/** 擁有者(表單 / 流程)要有的欄位。 */
export interface LifecycleOwner {
  key: string;
  currentVersion: number | null;
}

/** 版本表的最小存取(條件查詢與條件更新)。 */
export interface LifecycleVersionStore<TVersion extends LifecycleVersion> {
  findMany(
    filter: Record<string, unknown>,
    options?: { sort?: Record<string, 1 | -1>; limit?: number },
  ): Promise<TVersion[]>;
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<TVersion | null>;
}

export interface VersionLifecycleConfig<TVersion extends LifecycleVersion> {
  /** 版本表指回擁有者的欄位名(`formKey` / `workflowKey`)。 */
  keyField: string;
  versions: LifecycleVersionStore<TVersion>;
  /** 條件切換擁有者的 `currentVersion`(還是 `expected` 才寫成 `next`);沒命中回 false。 */
  switchCurrent: (
    owner: LifecycleOwner,
    expected: number | null,
    next: number | null,
  ) => Promise<boolean>;
  /** 該模組的 `CONFLICT` 錯誤(reason 是上面那一組)。 */
  conflict: (reason: VersionConflictReason, message: string) => Error;
  /** 步驟 4 的檢查點(測試注入失敗用)。 */
  reached: (checkpoint: VersionSwitchCheckpoint) => Promise<void>;
}

/** BaseRepository 型的版本表 → 生命週期要的最小存取(操作者固定在這次請求)。 */
export function repositoryVersionStore<
  TSchema,
  TDocument extends RepositoryDocument & LifecycleVersion,
>(
  repository: BaseRepository<TSchema, TDocument>,
  operator: OperatorContext,
): LifecycleVersionStore<Persisted<TDocument>> {
  return {
    findMany: (filter, options = {}) =>
      repository.findMany(operator, filter, options),
    findOneAndUpdate: (filter, update) =>
      repository.findOneAndUpdate(operator, filter, update),
  };
}

/**
 * 發布中斷 = 有 `publishing` 版本,或有 `published` 版本但它不是 `currentVersion`
 * (步驟 4 的第一筆寫了、最後一筆沒寫)。有中斷時禁止開草稿 / 退役 / 再發布。回要接續完成的那一版。
 */
export async function interruptedPublishOf<TVersion extends LifecycleVersion>(
  config: VersionLifecycleConfig<TVersion>,
  owner: LifecycleOwner,
): Promise<TVersion | null> {
  const candidates = await config.versions.findMany(
    {
      [config.keyField]: owner.key,
      status: { $in: ["publishing", "published"] },
    },
    { sort: { version: -1 } },
  );
  const publishing = candidates.find(
    (candidate) => candidate.status === "publishing",
  );
  if (publishing) {
    return publishing;
  }
  return (
    candidates.find(
      (candidate) => candidate.version !== owner.currentVersion,
    ) ?? null
  );
}

/** 發布進行中(或中斷)→ `CONFLICT`(`PUBLISH_IN_PROGRESS`)。 */
export async function assertNotPublishing<TVersion extends LifecycleVersion>(
  config: VersionLifecycleConfig<TVersion>,
  owner: LifecycleOwner,
): Promise<void> {
  const interrupted = await interruptedPublishOf(config, owner);
  if (interrupted) {
    throw config.conflict(
      "PUBLISH_IN_PROGRESS",
      `${owner.key} has an unfinished publish (version ${String(interrupted.version)})`,
    );
  }
}

/**
 * 步驟 2:搶鎖並配版號(草稿還是讀到的那一份才改;兩個發布同時來只有一個命中)。
 * 同版號被另一個發布配走(唯一索引)視同沒搶到。
 */
export async function lockDraftForPublish<TVersion extends LifecycleVersion>(
  config: VersionLifecycleConfig<TVersion>,
  owner: LifecycleOwner,
  draftId: Types.ObjectId,
  expectedDraftRevision: number,
  changelog: string,
): Promise<TVersion> {
  const [latest] = await config.versions.findMany(
    { [config.keyField]: owner.key, version: { $ne: null } },
    { sort: { version: -1 }, limit: 1 },
  );
  const nextVersion = (latest?.version ?? 0) + 1;
  let locked: TVersion | null;
  try {
    locked = await config.versions.findOneAndUpdate(
      { _id: draftId, status: "draft", draftRevision: expectedDraftRevision },
      { $set: { status: "publishing", version: nextVersion, changelog } },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    locked = null;
  }
  if (!locked) {
    throw config.conflict(
      "DRAFT_REVISION_MISMATCH",
      `${owner.key} draft was changed or is being published`,
    );
  }
  return locked;
}

/** 步驟 4:三筆切換,每一筆寫入都「已是目標狀態就跳過」。 */
export async function switchToPublished<TVersion extends LifecycleVersion>(
  config: VersionLifecycleConfig<TVersion>,
  owner: LifecycleOwner,
  target: TVersion,
  actorId: Types.ObjectId | null,
): Promise<TVersion> {
  const version = target.version;
  if (version === null) {
    throw new Error(`發布中的版本沒有版號(${owner.key})`);
  }
  // 4a:這一版 publishing → published
  let published = target;
  if (target.status === "publishing") {
    await config.reached("publish-version");
    published =
      (await config.versions.findOneAndUpdate(
        { _id: target._id, status: "publishing" },
        {
          $set: {
            status: "published",
            publishedAt: new Date(),
            publishedBy: actorId,
          },
        },
      )) ?? target;
  }
  // 4b:前一個(或殘留的)published → retired
  const previous = await config.versions.findMany({
    [config.keyField]: owner.key,
    status: "published",
    _id: { $ne: target._id },
  });
  for (const record of previous) {
    await config.reached("retire-previous");
    await config.versions.findOneAndUpdate(
      { _id: record._id, status: "published" },
      { $set: { status: "retired" } },
    );
  }
  // 4c:currentVersion 指向新版(最後一筆;條件更新,避免蓋掉同時進行的退役 / 發布)
  if (owner.currentVersion !== version) {
    await config.reached("current-version");
    const switched = await config.switchCurrent(
      owner,
      owner.currentVersion,
      version,
    );
    if (!switched) {
      throw config.conflict(
        "CURRENT_VERSION_CHANGED",
        `${owner.key} current version changed while publishing`,
      );
    }
  }
  return published;
}

/**
 * 退役目前版本:`published → retired`,再 `currentVersion → null`;中斷後再呼叫一次會接著做完
 * (版本已退役就只補後一筆)。回被退役的那一版(已退役過則為 null)。
 */
export async function retireCurrentVersion<TVersion extends LifecycleVersion>(
  config: VersionLifecycleConfig<TVersion>,
  owner: LifecycleOwner,
): Promise<TVersion | null> {
  await assertNotPublishing(config, owner);
  if (owner.currentVersion === null) {
    throw config.conflict(
      "NO_CURRENT_VERSION",
      `${owner.key} has no current version`,
    );
  }
  const retired = await config.versions.findOneAndUpdate(
    {
      [config.keyField]: owner.key,
      version: owner.currentVersion,
      status: "published",
    },
    { $set: { status: "retired" } },
  );
  const switched = await config.switchCurrent(
    owner,
    owner.currentVersion,
    null,
  );
  if (!switched) {
    throw config.conflict(
      "CURRENT_VERSION_CHANGED",
      `${owner.key} current version changed while retiring`,
    );
  }
  return retired;
}
