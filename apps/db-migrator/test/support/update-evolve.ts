/**
 * 夾具 `test/fixtures/update-evolve/` 的共用部分:兩個版本的來源、migration 檔名、版本 1 的真資料,
 * 以及「升到版本 3 之後應有的最終狀態」。
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect } from "@jest/globals";
import { type Document, MongoClient, ObjectId } from "mongodb";

import {
  changelogOf,
  documentsOf,
  fixtureSourceRoot,
  journalOf,
  lockOf,
  withDatabase,
} from "./update-harness";

export const V1 = `--source-root=${fixtureSourceRoot("update-evolve", "v1")}`;
export const V3 = `--source-root=${fixtureSourceRoot("update-evolve", "v3")}`;

/**
 * 把版本 3 的來源複製到暫存目錄:測試要在兩次執行之間**真的改來源檔**(換快照、改 migration)時用。
 * migration 與快照是複本,registry 仍是夾具的那一份。回傳目錄與對應的 `--source-root` 參數。
 */
export function copyV3Root(): { root: string; arg: string } {
  const source = fixtureSourceRoot("update-evolve", "v3");
  const root = mkdtempSync(path.join(os.tmpdir(), "db-migrator-evolve-"));
  cpSync(path.join(source, "migrations"), path.join(root, "migrations"), {
    recursive: true,
  });
  cpSync(
    path.join(source, "seeds", "project"),
    path.join(root, "seeds", "project"),
    { recursive: true },
  );
  // 暫存目錄不在任何套件底下:指明裡面的 .js 是 ESM(與本套件相同)
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ type: "module" })}\n`,
  );
  const registry = pathToFileURL(path.join(source, "seeds", "registry.ts"));
  writeFileSync(
    path.join(root, "seeds", "registry.ts"),
    `export { seedRegistry } from ${JSON.stringify(registry.href)};\n`,
  );
  return { root, arg: `--source-root=${root}` };
}

/** 改寫來源目錄裡的一個檔(內容必須真的有變,否則測試前提不成立)。 */
export function editSourceFile(
  root: string,
  relativePath: string,
  edit: (content: string) => string,
): void {
  const target = path.join(root, ...relativePath.split("/"));
  const before = readFileSync(target, "utf8");
  const after = edit(before);
  if (after === before) {
    throw new Error(`${relativePath} 沒有被改到`);
  }
  writeFileSync(target, after);
}

export const MARKER = "20270101000000_data_ticket-marker.js";
export const TICKET_V2 = "20270201000000_data_ticket-v2.js";
export const TICKET_INDEX = "20270201000000_schema_ticket-index.js";
export const TICKET_V3 = "20270301000000_data_ticket-v3.js";
/** 版本 3 的全部 migration,依完整檔名排序。 */
export const V3_MIGRATIONS = [MARKER, TICKET_V2, TICKET_INDEX, TICKET_V3];

export const TICKET = "update_ticket";
export const LEGACY = "update_legacy";
/** 工單第二版快照的定義 id(檢查點的對象)。 */
export const TICKET_R2 = `form-definition:${TICKET}@r2`;

export const instanceId = new ObjectId();
export const draftId = new ObjectId();
export const completedId = new ObjectId();
export const inFlightId = new ObjectId();

/** 版本 1 的真資料:兩筆沒走流程的提交(其中一筆有修訂)、一筆走流程中的提交與它的流程實例。 */
export async function insertV1Data(databaseUri: string): Promise<void> {
  await withDatabase(databaseUri, async (database) => {
    const root = await database.collection("orgs").findOne({ key: "root" });
    const base = {
      orgId: root?._id,
      formKey: TICKET,
      moduleKey: "project-form",
      tenantId: null,
      version: 1,
      revision: 0,
      revisions: [],
      currentInstanceId: null,
    };
    // api 的受管定義 CLI 啟動時已建好這張表的索引(createdBy + clientRequestId 唯一)
    await database.collection("form_submissions").insertMany([
      {
        ...base,
        _id: draftId,
        clientRequestId: "ticket-draft",
        status: "draft",
        values: { title: "草稿" },
      },
      {
        ...base,
        _id: completedId,
        clientRequestId: "ticket-completed",
        status: "completed",
        values: { title: "已完成" },
        revision: 1,
        revisions: [{ version: 1, kind: "edit", values: { title: "修訂前" } }],
      },
      {
        ...base,
        _id: inFlightId,
        clientRequestId: "ticket-in-flight",
        status: "in_review",
        values: { title: "審核中" },
        currentInstanceId: instanceId,
      },
    ]);
    await database.collection("workflow_instances").insertOne({
      _id: instanceId,
      workflowKey: "update_ticket_flow",
      workflowVersion: 1,
      submissionId: inFlightId,
      status: "running",
    });
  });
}

/** 把一個資料庫的全部文件複製到另一個(同一台 MongoDB;索引不複製)。 */
export async function cloneDatabase(
  sourceUri: string,
  targetUri: string,
): Promise<void> {
  const targetName = new URL(targetUri).pathname.slice(1);
  const client = await MongoClient.connect(sourceUri);
  try {
    const database = client.db();
    const collections = await database
      .listCollections({}, { nameOnly: true })
      .toArray();
    for (const { name } of collections) {
      await database
        .collection(name)
        .aggregate([{ $out: { db: targetName, coll: name } }])
        .toArray();
    }
  } finally {
    await client.close();
  }
}

export function versionsOf(
  databaseUri: string,
  formKey: string,
): Promise<Document[]> {
  return documentsOf(databaseUri, "form_versions", { formKey }, "version");
}

export async function formOf(
  databaseUri: string,
  key: string,
): Promise<Document | undefined> {
  const [form] = await documentsOf(databaseUri, "forms", { key });
  return form;
}

/** 安裝紀錄,依 key、revision 排序。 */
export async function installationsOf(
  databaseUri: string,
): Promise<Document[]> {
  const installations = await documentsOf(
    databaseUri,
    "seed_definition_installations",
  );
  return installations.toSorted((left, right) =>
    `${String(left.key)}@${String(left.revision)}`.localeCompare(
      `${String(right.key)}@${String(right.revision)}`,
      "zh-Hant",
    ),
  );
}

/** 測試夾具的計數文件(migration 每次執行時自己記的)。 */
export async function markOf(
  databaseUri: string,
  id: string,
): Promise<Document | undefined> {
  const marks = await documentsOf(databaseUri, "update_fixture_marks");
  return marks.find((mark) => mark._id === id);
}

/** 某支 migration 的 journal 紀錄(依建立順序)。 */
export async function migrationRecordsOf(
  databaseUri: string,
  fileName: string,
): Promise<Document[]> {
  const journal = await journalOf(databaseUri, "migration");
  return journal.filter((record) => record.fileName === fileName);
}

/**
 * 從版本 1 的真資料升到版本 3 之後的最終狀態(不論中間斷過幾次、斷在哪裡都要收斂到這裡):
 * 四支 migration 各記一次、工單恰好三個版本、沒走流程的提交轉到第三版、走流程中的不動、
 * 沒有未完成的紀錄、鎖已釋放。
 */
export async function expectUpgradedToV3(databaseUri: string): Promise<void> {
  const changelog = await changelogOf(databaseUri);
  expect(changelog.map((entry) => entry.fileName as string)).toEqual(
    V3_MIGRATIONS,
  );
  expect(await formOf(databaseUri, TICKET)).toMatchObject({
    currentVersion: 3,
  });
  const versions = await versionsOf(databaseUri, TICKET);
  expect(versions.map((version) => version.version as number)).toEqual([
    1, 2, 3,
  ]);
  const installations = await installationsOf(databaseUri);
  expect(
    installations
      .filter((item) => item.key === TICKET)
      .map(({ revision, status, localVersion }) => ({
        revision: revision as string,
        status: status as string,
        localVersion: localVersion as number,
      })),
  ).toEqual([
    { revision: "r1", status: "installed", localVersion: 1 },
    { revision: "r2", status: "installed", localVersion: 2 },
    { revision: "r3", status: "installed", localVersion: 3 },
  ]);
  const submissions = await documentsOf(databaseUri, "form_submissions");
  const byId = (id: ObjectId) =>
    submissions.find((submission) => id.equals(submission._id as ObjectId));
  expect(byId(draftId)).toMatchObject({
    version: 3,
    values: { title: "草稿", priority: "normal", note: "" },
  });
  expect(byId(completedId)).toMatchObject({
    version: 3,
    values: { title: "已完成", priority: "normal", note: "" },
    revisions: [{ version: 1, kind: "edit", values: { title: "修訂前" } }],
  });
  expect(byId(inFlightId)).toMatchObject({
    version: 1,
    values: { title: "審核中" },
    currentInstanceId: instanceId,
  });
  const journal = await journalOf(databaseUri, "migration");
  expect(
    journal
      .filter((record) => record.status !== "applied")
      .map((record) => `${String(record.fileName)}:${String(record.status)}`),
  ).toEqual([]);
  // 每一支只有一筆紀錄:中斷後是接續同一筆,不是另起一次
  expect(new Set(journal.map((record) => record.fileName as string))).toEqual(
    new Set(V3_MIGRATIONS),
  );
  expect(journal).toHaveLength(V3_MIGRATIONS.length);
  expect(await lockOf(databaseUri)).toBeNull();
}
