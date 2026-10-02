import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../auth/test-support/auth-app";
import { rootToken } from "../forms/test-support/form-fixtures";
import { runFullReset } from "./test-support/reset-command";

/** 建置(turbo 連依賴一起)與 reset 子程序都慢,放寬逾時。 */
const BUILD_TIMEOUT_MS = 600_000;
jest.setTimeout(300_000);

const API_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(API_ROOT, "..", "..");
const CLI_ENTRY = path.join(API_ROOT, "dist", "seed", "run.js");
const TURBO_CLI = path.join(REPO_ROOT, "node_modules", "turbo", "bin", "turbo");

/** 建置 api 與它的 workspace 依賴(同一個 checkout 的產物),不依賴本機恰好留著的 dist。 */
function buildCli(): void {
  const build = spawnSync(
    process.execPath,
    [TURBO_CLI, "run", "build", "--filter=@repo/api"],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: BUILD_TIMEOUT_MS - 30_000 },
  );
  if (build.status !== 0 || !existsSync(CLI_ENTRY)) {
    throw new Error(
      `建置 api 失敗(status ${String(build.status)}):${build.stdout.slice(-3000)}\n${build.stderr.slice(-3000)}`,
    );
  }
}

interface IndexShape {
  name: string | undefined;
  key: unknown;
  unique: boolean;
  partialFilterExpression: unknown;
}

/**
 * full reset 會 drop 每個 collection 連同索引(`docs/plans/seed-migration.md`「重置與操作者確認」:
 * 完整的應用資料與索引重建)。正式 registry 沒有登記任何表單 / 流程定義時也一樣要把**全部**登記 schema 的索引
 * 建回來 —— 常駐的 api 早就做完 `model.init()`,不會自己重建,也不能要求操作者重啟服務。
 *
 * 全程同一個 app instance、不重啟;reset 是真的 db-migrator 指令子行程(正式 registry,沒有定義)。
 * 「全部 schema」取自這個 app 實際註冊的 model,不另列清單。
 */
describe("full reset(沒有受管定義):同一個 api instance 不重啟,全部 schema 的索引都重建", () => {
  let api: AuthTestApp;
  let databaseUri: string;
  /** app 自己的連線(model 都註冊在它上面)。 */
  let models: Connection;

  beforeAll(async () => {
    buildCli();
    api = await startAuthTestApp("cookhome-test-reset-full-indexes");
    databaseUri = process.env.MONGODB_URI ?? "";
    models = api.app.get<Connection>(getConnectionToken());
    // api 啟動後在背景建索引:等它建完才是「reset 之前」的狀態。`init()` 每個 model 只做一次,
    // 之後再呼叫拿到的是同一個已完成的結果 —— 這個 app 不會因此在 reset 之後重建索引
    await Promise.all(
      Object.values(models.models).map((model) => model.init()),
    );
  }, BUILD_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, 60_000);

  /** 每個已註冊 model 的 collection → 索引(依名稱);collection 不存在就是沒有索引。 */
  async function indexSnapshot(): Promise<Record<string, IndexShape[]>> {
    const snapshot: Record<string, IndexShape[]> = {};
    const names = Object.values(models.models)
      .map((model) => model.collection.collectionName)
      .toSorted((left, right) => left.localeCompare(right, "zh-Hant"));
    for (const name of names) {
      const indexes = await api.connection
        .collection(name)
        .indexes()
        .catch(() => []);
      snapshot[name] = indexes
        .map((index) => ({
          name: index.name,
          key: index.key,
          unique: index.unique === true,
          partialFilterExpression: index.partialFilterExpression ?? null,
        }))
        .toSorted((left, right) =>
          String(left.name).localeCompare(String(right.name), "zh-Hant"),
        );
    }
    return snapshot;
  }

  it("reset 前後索引完全相同;唯一約束實際有效(重複寫入被拒絕)", async () => {
    const before = await indexSnapshot();
    // 前提:api 啟動時已建好 schema 的索引(核心與表單 / 流程各取代表)
    const namesOf = (collection: string) =>
      (before[collection] ?? []).map((index) => index.name);
    expect(namesOf("users")).toContain("account_1");
    expect(namesOf("forms")).toContain("key_1");
    expect(namesOf("form_versions")).toContain("formKey_draft_unique");
    expect(namesOf("workflow_versions")).toContain("workflowKey_draft_unique");

    const result = await runFullReset(databaseUri);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    // 正式 registry 沒有任何定義:這次不是靠發布定義順便建回索引
    expect(result.stdout).not.toContain("定義 form-definition");
    expect(result.stdout).not.toContain("定義 workflow-definition");

    expect(await indexSnapshot()).toEqual(before);

    // 約束真的生效:同 key 的表單、同一流程的第二份草稿、同帳號的使用者都寫不進去
    const { connection } = api;
    const now = new Date();
    const stamps = { createdAt: now, updatedAt: now };
    await connection
      .collection("forms")
      .insertOne({ key: "dup_form", moduleKey: "demo-form", ...stamps });
    await expect(
      connection
        .collection("forms")
        .insertOne({ key: "dup_form", moduleKey: "demo-form", ...stamps }),
    ).rejects.toThrow(/E11000/);
    const draft = { workflowKey: "dup_flow", version: null, status: "draft" };
    await connection
      .collection("workflow_versions")
      .insertOne({ ...draft, ...stamps });
    await expect(
      connection
        .collection("workflow_versions")
        .insertOne({ ...draft, ...stamps }),
    ).rejects.toThrow(/E11000/);
    const root = await connection.collection("users").findOne({});
    await expect(
      connection.collection("users").insertOne({
        account: root?.account as string,
        email: "another@example.com",
        ...stamps,
      }),
    ).rejects.toThrow(/E11000/);

    // 同一個 app instance 照常服務(root 由這次的種子重建)
    expect(await rootToken(api)).toEqual(expect.any(String));
  });
});
