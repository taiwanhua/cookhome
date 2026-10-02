/**
 * 歷史快照的固定 loader(`docs/concepts/data-layer-and-isolation.md`「Migration 與設定順序」)。
 *
 * 快照就是 `export const seed … satisfies SeedSet` 的 `.seed.ts`(設計器匯出的檔即快照),可另
 * `export const requiresSeeds` 列出前置快照。路徑相對 `seeds/`,只收 `base/revisions/` 與
 * `project/revisions/` 底下的檔;逃逸、symlink、大小寫與實際檔名不同的路徑一律拒絕。
 * 目前 registry 沒登記的歷史檔只在 migration 明示依賴時才會被這裡載入。
 *
 * 這裡只管「讀得到、讀到的是合法的種子」;缺檔、重複與循環由 `buildUpdatePlan` 連同使用者一起報。
 */
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFINITION_SEED_KINDS,
  type SeedSet,
  definitionSeedShapeIssues,
  isPlainRecord,
} from "@repo/domain/seed";

import { sourceFileHashOf } from "./content-hash";
import { type SeedSnapshot, isValidSeedSnapshotPath } from "./plan";

/** 快照檔不可載入(symlink、逃逸、export 形狀不對)。此時還沒有任何寫入。 */
export class SeedSnapshotError extends Error {
  override name = "SeedSnapshotError";
}

const PLAIN_KINDS: ReadonlySet<string> = new Set([
  "documents",
  "relations",
  "root-admin",
]);

async function lstatOrNull(target: string) {
  try {
    return await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * 逐段確認路徑上沒有 symlink、最後是一般檔案,且實際位置就在 `seeds/` 底下的同一個相對路徑。
 * 檔案不存在回 null(由計畫指出是誰依賴它)。
 */
async function resolveSnapshotFile(
  seedsRoot: string,
  snapshotPath: string,
): Promise<string | null> {
  let current = seedsRoot;
  const segments = snapshotPath.split("/");
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const stats = await lstatOrNull(current);
    if (stats === null) {
      return null;
    }
    if (stats.isSymbolicLink()) {
      throw new SeedSnapshotError(
        `快照 ${snapshotPath} 的路徑經過 symlink(${current});快照不收 symlink`,
      );
    }
    const isLast = index === segments.length - 1;
    if (isLast ? !stats.isFile() : !stats.isDirectory()) {
      throw new SeedSnapshotError(
        `快照 ${snapshotPath} 不是 seeds/ 底下的一般檔案`,
      );
    }
  }
  const actual = path
    .relative(await realpath(seedsRoot), await realpath(current))
    .split(path.sep)
    .join("/");
  if (actual !== snapshotPath) {
    throw new SeedSnapshotError(
      `快照 ${snapshotPath} 的實際位置是 ${actual};路徑(含大小寫)必須與檔案一致,不得指到 seeds/ 之外`,
    );
  }
  return current;
}

function seedOf(exported: unknown, snapshotPath: string): SeedSet {
  if (!isPlainRecord(exported) || typeof exported.kind !== "string") {
    throw new SeedSnapshotError(
      `快照 ${snapshotPath} 必須具名匯出 seed(一份 SeedSet)`,
    );
  }
  if ((DEFINITION_SEED_KINDS as readonly string[]).includes(exported.kind)) {
    const [issue] = definitionSeedShapeIssues(exported);
    if (issue !== undefined) {
      throw new SeedSnapshotError(
        `快照 ${snapshotPath} 的定義宣告不合法:${issue.path === "" ? "(宣告)" : issue.path} ${issue.detail}`,
      );
    }
    return exported as unknown as SeedSet;
  }
  if (!PLAIN_KINDS.has(exported.kind)) {
    throw new SeedSnapshotError(
      `快照 ${snapshotPath} 的 seed.kind「${exported.kind}」不是認得的種子種類`,
    );
  }
  if (exported.kind !== "root-admin" && !Array.isArray(exported.entries)) {
    throw new SeedSnapshotError(
      `快照 ${snapshotPath} 的 seed.entries 必須是陣列`,
    );
  }
  return exported as unknown as SeedSet;
}

function requiresSeedsOf(exported: unknown, snapshotPath: string): string[] {
  if (exported === undefined) {
    return [];
  }
  if (
    !Array.isArray(exported) ||
    !exported.every((item) => typeof item === "string")
  ) {
    throw new SeedSnapshotError(
      `快照 ${snapshotPath} 的 requiresSeeds 必須是字串陣列(相對 seeds/ 的快照路徑)`,
    );
  }
  return exported;
}

async function loadSnapshot(
  seedsRoot: string,
  snapshotPath: string,
): Promise<SeedSnapshot | null> {
  const filePath = await resolveSnapshotFile(seedsRoot, snapshotPath);
  if (filePath === null) {
    return null;
  }
  const loaded = (await import(pathToFileURL(filePath).href)) as {
    seed?: unknown;
    requiresSeeds?: unknown;
  };
  return {
    path: snapshotPath,
    fileHash: sourceFileHashOf(await readFile(filePath)),
    seed: seedOf(loaded.seed, snapshotPath),
    requiresSeeds: requiresSeedsOf(loaded.requiresSeeds, snapshotPath),
  };
}

/**
 * 載入一組快照與它們遞迴的前置(每個路徑只載一次,循環不會讓它停不下來)。
 * 路徑格式不合或檔案不存在的不在回傳裡 —— `buildUpdatePlan` 會指出是誰依賴它。
 */
export async function loadSeedSnapshots(
  seedsRoot: string,
  entries: readonly string[],
): Promise<SeedSnapshot[]> {
  const snapshots: SeedSnapshot[] = [];
  const visited = new Set<string>();
  const queue = [...entries];
  for (
    let snapshotPath = queue.shift();
    snapshotPath !== undefined;
    snapshotPath = queue.shift()
  ) {
    if (visited.has(snapshotPath) || !isValidSeedSnapshotPath(snapshotPath)) {
      continue;
    }
    visited.add(snapshotPath);
    const snapshot = await loadSnapshot(seedsRoot, snapshotPath);
    if (snapshot !== null) {
      snapshots.push(snapshot);
      queue.push(...snapshot.requiresSeeds);
    }
  }
  return snapshots;
}
