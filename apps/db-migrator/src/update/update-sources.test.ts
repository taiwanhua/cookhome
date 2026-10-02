import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  TestMongo,
  changelogOf,
  collectionNames,
  documentsOf,
  journalOf,
  runUpdate,
  runUpdateWithFault,
  withDatabase,
} from "../../test/support/update-harness";

/**
 * 來源預檢(`docs/plans/seed-migration.md` 驗收矩陣「漂移與錯誤」):migration 與快照的來源不合法時,
 * 在任何寫入之前就失敗 —— 沒有輸出、資料庫沒有任何 collection。每一案在暫存目錄建一個最小的來源目錄。
 */

const mongo = new TestMongo("db-migrator-sources");

const MIGRATION_A = "20270101000000_data_alpha.js";
const MIGRATION_B = "20270102000000_data_beta.js";
const NOTE_SNAPSHOT = "project/revisions/note-a.n1.seed.ts";
const NOTE_PARENT_SNAPSHOT = "project/revisions/note-parent.n1.seed.ts";

/** 沒有 seed 依賴的 migration。 */
const PLAIN_MIGRATION = `export const up = async (db) => {
  await db.collection("update_fixture_marks").insertOne({ at: new Date() });
};
`;

/** 有 seed 依賴的 migration:`update_fixture_sources` 有文件才算有待轉換的資料。 */
function dependentMigration(
  seedDependencies: readonly string[],
  checks = "appliesTo, assertSeedInstallable, verify",
): string {
  return `export const seedDependencies = ${JSON.stringify(seedDependencies)};
const appliesTo = async (db) =>
  (await db.collection("update_fixture_sources").countDocuments({ done: { $ne: true } })) > 0;
const assertSeedInstallable = async (db, inspection) => {
  await db.collection("update_fixture_marks").insertOne({ pending: inspection.pending });
};
const verify = async (db) => {
  if ((await db.collection("update_fixture_sources").countDocuments({ done: { $ne: true } })) > 0) {
    throw new Error("還有沒轉換的資料");
  }
};
export const up = async (db) => {
  const notes = await db.collection("update_fixture_notes").find().sort({ key: 1 }).toArray();
  await db.collection("update_fixture_sources").updateMany({}, { $set: { done: true, notes: notes.map((note) => note.name) } });
};
export { ${checks} };
`;
}

/** 一份普通種子的快照(documents);`parentKey` 讓它引用另一份快照裡的文件。 */
function noteSnapshot(
  key: string,
  options: { requiresSeeds?: readonly string[]; parentKey?: string } = {},
): string {
  const { requiresSeeds, parentKey } = options;
  const data: Record<string, unknown> = { name: `note ${key}` };
  if (parentKey !== undefined) {
    data.parentId = {
      $seedRef: { collection: "update_fixture_notes", key: parentKey },
    };
  }
  const seed = {
    kind: "documents",
    collection: "update_fixture_notes",
    entries: [{ key, data }],
  };
  return [
    ...(requiresSeeds === undefined
      ? []
      : [`export const requiresSeeds = ${JSON.stringify(requiresSeeds)};`]),
    `export const seed = ${JSON.stringify(seed, null, 2)};`,
    "",
  ].join("\n");
}

/** 在暫存目錄建來源目錄;registry 是空的(這裡驗的是 migration 與快照的來源)。 */
function sourceRoot(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "db-migrator-sources-"));
  const all: Record<string, string> = {
    // 暫存目錄不在任何套件底下:指明裡面的 .js 是 ESM(與本套件相同)
    "package.json": `${JSON.stringify({ type: "module" })}\n`,
    "seeds/registry.ts": "export const seedRegistry = [];\n",
    ...files,
  };
  mkdirSync(path.join(root, "migrations"), { recursive: true });
  for (const [relativePath, content] of Object.entries(all)) {
    const target = path.join(root, ...relativePath.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

/**
 * 把 `relativePath` 換成指向原內容的 symlink。沒有建立檔案 symlink 的權限時(Windows 未開開發人員模式),
 * 改把它的上層目錄換成 junction —— 兩種都是「路徑經過 symlink」。
 */
function replaceWithLink(root: string, relativePath: string): void {
  const target = path.join(root, ...relativePath.split("/"));
  const moved = `${target}.real`;
  renameSync(target, moved);
  try {
    symlinkSync(moved, target, "file");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") {
      throw error;
    }
    renameSync(moved, target);
    const directory = path.dirname(target);
    const movedDirectory = `${directory}.real`;
    renameSync(directory, movedDirectory);
    symlinkSync(movedDirectory, directory, "junction");
  }
}

async function expectRejected(
  suffix: string,
  root: string,
  message: string,
): Promise<void> {
  const databaseUri = mongo.uri(suffix);
  const result = await runUpdate(databaseUri, [`--source-root=${root}`]);
  expect({ status: result.status, stdout: result.stdout }).toEqual({
    status: 1,
    stdout: "",
  });
  expect(result.stderr).toContain(message);
  expect(await collectionNames(databaseUri)).toEqual([]);
}

beforeAll(async () => {
  await mongo.start();
}, 600_000);

afterAll(async () => {
  await mongo.stop();
}, 60_000);

describe("migration 來源不合法:零寫入", () => {
  it("base 與 project 有同一個 basename:拒絕(changelog 以 basename 識別,不靠資料夾區分)", async () => {
    await expectRejected(
      "collision",
      sourceRoot({
        [`migrations/base/${MIGRATION_A}`]: PLAIN_MIGRATION,
        [`migrations/project/${MIGRATION_A}`]: PLAIN_MIGRATION,
      }),
      "migration 檔名重複",
    );
  }, 120_000);

  it("新來源的 basename 與根目錄的歷史檔相同:同樣拒絕,不會把舊 migration 當成新的重跑", async () => {
    await expectRejected(
      "collision-legacy",
      sourceRoot({
        [`migrations/${MIGRATION_A}`]: PLAIN_MIGRATION,
        [`migrations/project/${MIGRATION_A}`]: PLAIN_MIGRATION,
      }),
      "migration 檔名重複",
    );
  }, 120_000);

  it("檔名不符命名規約、目錄裡有不認得的項目:拒絕", async () => {
    await expectRejected(
      "bad-name",
      sourceRoot({
        "migrations/project/20270101000000_misc_Alpha.js": PLAIN_MIGRATION,
      }),
      "不符合命名規約",
    );
    await expectRejected(
      "unknown-entry",
      sourceRoot({ "migrations/extra/readme.txt": "x" }),
      "不是 migration 檔",
    );
  }, 120_000);

  it("migration 檔是 symlink:拒絕", async () => {
    const root = sourceRoot({
      [`migrations/project/${MIGRATION_A}`]: PLAIN_MIGRATION,
    });
    replaceWithLink(root, `migrations/project/${MIGRATION_A}`);
    await expectRejected("migration-symlink", root, "symlink");
  }, 120_000);

  it("有 seed 依賴卻少了檢查函式、或重複列同一份快照:拒絕", async () => {
    await expectRejected(
      "missing-checks",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration(
          [NOTE_SNAPSHOT],
          "appliesTo",
        ),
        [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a"),
      }),
      "必須同時 export assertSeedInstallable、verify",
    );
    await expectRejected(
      "duplicate-dependency",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration([
          NOTE_SNAPSHOT,
          NOTE_SNAPSHOT,
        ]),
        [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a"),
      }),
      `重複列了 ${NOTE_SNAPSHOT}`,
    );
  }, 120_000);
});

describe("快照依賴不合法:零寫入", () => {
  it("依賴的快照不存在(直接依賴與遞迴前置):指出是誰依賴它", async () => {
    await expectRejected(
      "missing",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration([
          NOTE_SNAPSHOT,
        ]),
      }),
      `project:${MIGRATION_A} 依賴的快照 ${NOTE_SNAPSHOT} 不存在`,
    );
    await expectRejected(
      "missing-prerequisite",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration([
          NOTE_SNAPSHOT,
        ]),
        [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a", {
          requiresSeeds: [NOTE_PARENT_SNAPSHOT],
        }),
      }),
      `快照 ${NOTE_SNAPSHOT} 的前置 ${NOTE_PARENT_SNAPSHOT} 不存在`,
    );
  }, 120_000);

  it("快照互相依賴成環:列出循環路徑", async () => {
    await expectRejected(
      "cycle",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration([
          NOTE_SNAPSHOT,
        ]),
        [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a", {
          requiresSeeds: [NOTE_PARENT_SNAPSHOT],
        }),
        [`seeds/${NOTE_PARENT_SNAPSHOT}`]: noteSnapshot("parent", {
          requiresSeeds: [NOTE_SNAPSHOT],
        }),
      }),
      `快照依賴循環:${NOTE_SNAPSHOT} → ${NOTE_PARENT_SNAPSHOT} → ${NOTE_SNAPSHOT}`,
    );
  }, 120_000);

  it("路徑逃出 revisions/(上層目錄、其他資料夾、絕對路徑):拒絕,不會去載入那個檔", async () => {
    const outside =
      "export const seed = (() => { throw new Error('不該被載入'); })();\n";
    for (const [suffix, dependency] of [
      ["escape-parent", "project/revisions/../../outside.seed.ts"],
      ["escape-folder", "project/other/outside.seed.ts"],
      ["escape-absolute", "/etc/outside.seed.ts"],
      ["escape-extension", "project/revisions/outside.ts"],
    ] as const) {
      await expectRejected(
        suffix,
        sourceRoot({
          [`migrations/project/${MIGRATION_A}`]: dependentMigration([
            dependency,
          ]),
          "seeds/outside.seed.ts": outside,
          "seeds/project/other/outside.seed.ts": outside,
          "seeds/project/revisions/outside.ts": outside,
        }),
        `「${dependency}」不合法`,
      );
    }
  }, 240_000);

  it("快照的路徑經過 symlink:拒絕", async () => {
    const root = sourceRoot({
      [`migrations/project/${MIGRATION_A}`]: dependentMigration([
        NOTE_SNAPSHOT,
      ]),
      [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a"),
    });
    replaceWithLink(root, `seeds/${NOTE_SNAPSHOT}`);
    await expectRejected("snapshot-symlink", root, "快照不收 symlink");
  }, 120_000);

  it("定義快照的檔名與內容的 key / revision 不符、普通種子前置的引用不在閉包內:拒絕", async () => {
    const definition = `export const seed = {
  kind: "workflow-definition",
  key: "update_flow",
  revision: "r2",
  name: "流程",
  changelog: "第二版",
  desiredStatus: "published",
  checkFormKey: null,
  definition: { steps: [{ key: "boss", name: "主管", assignee: { kind: "manager", level: 1 }, mode: "any" }] },
};
`;
    await expectRejected(
      "definition-name",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration([
          "project/revisions/update_flow.r1.seed.ts",
        ]),
        "seeds/project/revisions/update_flow.r1.seed.ts": definition,
      }),
      "檔名必須是 update_flow.r2.seed.ts",
    );
    await expectRejected(
      "plain-reference",
      sourceRoot({
        [`migrations/project/${MIGRATION_A}`]: dependentMigration([
          NOTE_SNAPSHOT,
        ]),
        [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a", { parentKey: "parent" }),
      }),
      "引用的種子文件未宣告:找不到種子文件 update_fixture_notes.parent",
    );
  }, 120_000);
});

describe("普通種子的歷史快照當前置", () => {
  it("有待轉換資料:先依前置順序套用快照再 up;沒有資料的那一支只 verify 記成 no-op,不套用快照", async () => {
    const root = sourceRoot({
      // 第一支沒有 seed 依賴,負責準備「待轉換的資料」
      [`migrations/base/${MIGRATION_A}`]: `export const up = async (db) => {
  await db.collection("update_fixture_sources").insertOne({ name: "legacy" });
};
`,
      [`migrations/project/${MIGRATION_B}`]: dependentMigration([
        NOTE_SNAPSHOT,
      ]),
      [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a", {
        requiresSeeds: [NOTE_PARENT_SNAPSHOT],
        parentKey: "parent",
      }),
      [`seeds/${NOTE_PARENT_SNAPSHOT}`]: noteSnapshot("parent"),
    });
    const databaseUri = mongo.uri("plain-snapshot");

    const result = await runUpdate(databaseUri, [`--source-root=${root}`]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const changelog = await changelogOf(databaseUri);
    expect(changelog.map((entry) => entry.fileName as string)).toEqual([
      MIGRATION_A,
      MIGRATION_B,
    ]);
    // 前置(parent)先套用,引用解析成它的 _id;up 看得到兩筆快照文件
    const notes = await documentsOf(databaseUri, "update_fixture_notes");
    const parent = notes.find((note) => note.key === "parent");
    expect(notes.find((note) => note.key === "a")).toMatchObject({
      parentId: parent?._id as unknown,
      isSystem: true,
    });
    expect(
      await documentsOf(databaseUri, "update_fixture_sources"),
    ).toMatchObject([{ done: true, notes: ["note a", "note parent"] }]);
    // assertSeedInstallable 收到的待安裝清單:依賴閉包,前置在前
    expect(
      await documentsOf(databaseUri, "update_fixture_marks"),
    ).toMatchObject([{ pending: [NOTE_PARENT_SNAPSHOT, NOTE_SNAPSHOT] }]);
    const journal = await journalOf(databaseUri, "migration");
    expect(
      journal.map(({ fileName, mode, status }) => ({
        fileName: fileName as string,
        mode: mode as string,
        status: status as string,
      })),
    ).toEqual([
      { fileName: MIGRATION_A, mode: "plain", status: "applied" },
      { fileName: MIGRATION_B, mode: "convert", status: "applied" },
    ]);

    // 另一個全新的資料庫、只有第二支:沒有待轉換資料 → no-op,快照沒有被套用
    const onlySecond = sourceRoot({
      [`migrations/project/${MIGRATION_B}`]: dependentMigration([
        NOTE_SNAPSHOT,
      ]),
      [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a"),
    });
    const freshUri = mongo.uri("plain-snapshot-fresh");
    const fresh = await runUpdate(freshUri, [`--source-root=${onlySecond}`]);
    expect(fresh.stderr).toBe("");
    expect(fresh.status).toBe(0);
    expect(fresh.stdout).toContain(
      `migration ${MIGRATION_B}:applied(no-op:沒有待轉換的資料;verify 通過)`,
    );
    expect(await documentsOf(freshUri, "update_fixture_notes")).toEqual([]);
    expect(await documentsOf(freshUri, "update_fixture_marks")).toEqual([]);
  }, 240_000);
});

const MIGRATION_C = "20270103000000_data_gamma.js";

async function migrationStatuses(databaseUri: string): Promise<string[]> {
  const journal = await journalOf(databaseUri, "migration");
  return journal.map(
    (record) => `${String(record.fileName)}:${String(record.status)}`,
  );
}

describe("中斷後依賴的快照被換掉:不接續、不補成功", () => {
  it.each([
    "migration-started",
    "migration-verified",
    "migration-recorded",
  ] as const)(
    "只依賴普通種子快照的轉換(沒有定義)中斷在 %s 之後快照被改:拒絕,後面的 migration 與種子都不執行",
    async (checkpoint) => {
      const root = sourceRoot({
        [`migrations/base/${MIGRATION_A}`]: `export const up = async (db) => {
  await db.collection("update_fixture_sources").insertOne({ name: "legacy" });
};
`,
        [`migrations/project/${MIGRATION_B}`]: dependentMigration([
          NOTE_SNAPSHOT,
        ]),
        [`migrations/project/${MIGRATION_C}`]: PLAIN_MIGRATION,
        [`seeds/${NOTE_SNAPSHOT}`]: noteSnapshot("a"),
      });
      const args = [`--source-root=${root}`];
      const databaseUri = mongo.uri(`swap-${checkpoint}`);

      const interrupted = await runUpdateWithFault(
        databaseUri,
        args,
        `${checkpoint}@${MIGRATION_B}`,
      );
      expect(interrupted.status).toBe(1);
      const changelog = await changelogOf(databaseUri);
      const statuses = await migrationStatuses(databaseUri);
      const sources = await documentsOf(databaseUri, "update_fixture_sources");

      // 真的把快照檔換成另一份內容
      writeFileSync(
        path.join(root, "seeds", ...NOTE_SNAPSHOT.split("/")),
        noteSnapshot("a-replaced"),
      );
      const resumed = await runUpdate(databaseUri, args);
      expect(resumed.status).toBe(1);
      expect(resumed.stderr).toContain(
        `${MIGRATION_B} 的依賴快照與未完成紀錄記下的不同`,
      );
      expect(resumed.stdout).not.toContain("seed 完成");
      // 沒有補記 changelog、紀錄停在原狀態、後面的 migration 沒跑、資料沒有再被動過
      expect(await changelogOf(databaseUri)).toEqual(changelog);
      expect(await migrationStatuses(databaseUri)).toEqual(statuses);
      expect(await documentsOf(databaseUri, "update_fixture_sources")).toEqual(
        sources,
      );
      const names = changelog.map((entry) => entry.fileName as string);
      expect(names).not.toContain(MIGRATION_C);
    },
    240_000,
  );
});

/** 有 down 的 migration;down 先留下記號(`marker` 用來分辨跑的是哪一份內容),控制文件在就做到一半失敗。 */
function reversibleMigration(marker: string): string {
  return `export const up = async (db) => {
  await db.collection("update_fixture_marks").insertOne({ _id: "up" });
};
export const down = async (db) => {
  await db.collection("update_fixture_marks").insertOne({ down: ${JSON.stringify(marker)} });
  if ((await db.collection("update_fixture_controls").countDocuments({ _id: "fail-down" })) > 0) {
    throw new Error("模擬中斷:down 做到一半");
  }
  await db.collection("update_fixture_marks").deleteOne({ _id: "up" });
};
`;
}

async function downMarkers(databaseUri: string): Promise<string[]> {
  const marks = await documentsOf(databaseUri, "update_fixture_marks");
  return marks.flatMap((mark) =>
    typeof mark.down === "string" ? [mark.down] : [],
  );
}

describe("down 之前核對來源:執行時記下的內容被改寫就拒絕", () => {
  const file = `migrations/project/${MIGRATION_A}`;
  const rewrite = (root: string, marker: string) => {
    writeFileSync(
      path.join(root, ...file.split("/")),
      reversibleMigration(marker),
    );
  };

  it("update 記過來源 hash 的 migration 被改寫:第一次 down 就拒絕,不執行改寫後的 down", async () => {
    const root = sourceRoot({ [file]: reversibleMigration("original") });
    const args = [`--source-root=${root}`];
    const databaseUri = mongo.uri("down-rewritten");
    const applied = await runUpdate(databaseUri, args);
    expect(applied.status).toBe(0);
    const changelog = await changelogOf(databaseUri);

    rewrite(root, "rewritten");
    const down = await runUpdate(databaseUri, [...args, "--down"]);
    expect(down.status).toBe(1);
    expect(down.stderr).toContain(
      `${MIGRATION_A} 的來源檔內容與執行時記下的不同`,
    );
    expect(await downMarkers(databaseUri)).toEqual([]);
    expect(await changelogOf(databaseUri)).toEqual(changelog);
    expect(await migrationStatuses(databaseUri)).toEqual([
      `${MIGRATION_A}:applied`,
    ]);

    // 換回原內容就能還原
    rewrite(root, "original");
    const restored = await runUpdate(databaseUri, [...args, "--down"]);
    expect(restored.stderr).toBe("");
    expect(restored.status).toBe(0);
    expect(await downMarkers(databaseUri)).toEqual(["original"]);
  }, 240_000);

  it("down 做到一半失敗後檔案被改寫:接續時拒絕,不會拿另一份 down 接著做;換回原內容才接續", async () => {
    const root = sourceRoot({ [file]: reversibleMigration("original") });
    const args = [`--source-root=${root}`];
    const databaseUri = mongo.uri("down-partial-rewritten");
    const applied = await runUpdate(databaseUri, args);
    expect(applied.status).toBe(0);
    await withDatabase(databaseUri, (database) =>
      database
        .collection<{ _id: string }>("update_fixture_controls")
        .insertOne({ _id: "fail-down" }),
    );

    const failed = await runUpdate(databaseUri, [...args, "--down"]);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("down 做到一半");
    expect(await downMarkers(databaseUri)).toEqual(["original"]);
    expect(await migrationStatuses(databaseUri)).toEqual([
      `${MIGRATION_A}:rollback-in-progress`,
    ]);
    await withDatabase(databaseUri, (database) =>
      database
        .collection<{ _id: string }>("update_fixture_controls")
        .deleteOne({ _id: "fail-down" }),
    );

    rewrite(root, "rewritten");
    const rejected = await runUpdate(databaseUri, [...args, "--down"]);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain(
      `${MIGRATION_A} 的來源檔內容與執行時記下的不同`,
    );
    expect(await downMarkers(databaseUri)).toEqual(["original"]);
    expect(await migrationStatuses(databaseUri)).toEqual([
      `${MIGRATION_A}:rollback-in-progress`,
    ]);
    const changelog = await changelogOf(databaseUri);
    expect(changelog.map((entry) => entry.fileName as string)).toEqual([
      MIGRATION_A,
    ]);

    rewrite(root, "original");
    const resumed = await runUpdate(databaseUri, [...args, "--down"]);
    expect(resumed.stderr).toBe("");
    expect(resumed.status).toBe(0);
    expect(await downMarkers(databaseUri)).toEqual(["original", "original"]);
    expect(await changelogOf(databaseUri)).toEqual([]);
  }, 240_000);

  it("改版前由 migrate-mongo 直接記的 changelog(沒有記過來源 hash):照歷史相容執行 down,不硬補 hash", async () => {
    const root = sourceRoot({ [file]: reversibleMigration("original") });
    const databaseUri = mongo.uri("down-legacy");
    await withDatabase(databaseUri, async (database) => {
      await database
        .collection("changelog")
        .insertOne({ fileName: MIGRATION_A, appliedAt: new Date(0) });
      await database
        .collection<{ _id: string }>("update_fixture_marks")
        .insertOne({ _id: "up" });
    });

    const down = await runUpdate(databaseUri, [
      `--source-root=${root}`,
      "--down",
    ]);
    expect(down.stderr).toBe("");
    expect(down.status).toBe(0);
    expect(await downMarkers(databaseUri)).toEqual(["original"]);
    expect(await changelogOf(databaseUri)).toEqual([]);
    expect(await migrationStatuses(databaseUri)).toEqual([
      `${MIGRATION_A}:rolled-back`,
    ]);
  }, 240_000);
});
