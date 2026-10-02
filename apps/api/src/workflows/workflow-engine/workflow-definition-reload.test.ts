import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { Connection } from "mongoose";

import type { StepDef } from "@repo/domain/workflow";

import {
  type AuthTestApp,
  startAuthTestApp,
} from "../../auth/test-support/auth-app";
import { HOOK_TIMEOUT_MS } from "../../database/test-support/mongo-connection";
import { ok, rootToken } from "../../forms/test-support/form-fixtures";
import { runDataReset } from "../../seed/test-support/reset-command";
import {
  CREATE_WORKFLOW,
  CREATE_WORKFLOW_DRAFT,
  PUBLISH_WORKFLOW,
  SAVE_WORKFLOW_DRAFT,
  WORKFLOW_TEST_TIMEOUT_MS,
  reviewStep,
} from "../test-support/workflow-fixtures";
import { WorkflowEngineService } from "./workflow-engine.service";

jest.setTimeout(WORKFLOW_TEST_TIMEOUT_MS);

interface VersionData {
  workflowVersion: { version: number | null; draftRevision: number };
}

/**
 * 引擎讀流程定義不跨請求快取(`docs/deployment.md`「資料庫還原(reset)」):
 * 資料庫 reset 之後,同一個流程 key、同一個版號可以是另一份內容,或已經不存在;
 * 活得比資料庫內容久的 `WorkflowEngineService` 不能拿先前讀過的那一份。
 *
 * 全程是**同一個 app、同一個 service instance**(不重建 app、不清任何快取);
 * 流程由真的發布流程建立,清除由真的 reset 指令做。
 */
describe("引擎的流程定義:reset / 重建之後同 key、同版號讀到的是現在的內容", () => {
  const KEY = "reload_review";
  let api: AuthTestApp;
  let connection: Connection;
  let databaseUri: string;
  let engine: WorkflowEngineService;

  beforeAll(async () => {
    api = await startAuthTestApp("workflow_definition_reload");
    ({ connection } = api);
    databaseUri = process.env.MONGODB_URI ?? "";
    engine = api.app.get(WorkflowEngineService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  /** root 建共用流程 → 開草稿 → 存定義 → 發布(畫面上的那一條路);回發布後的版號。 */
  async function publishShared(steps: StepDef[]): Promise<number | null> {
    const token = await rootToken(api);
    await ok(api, token, CREATE_WORKFLOW, {
      input: { key: KEY, name: "重建測試流程" },
    });
    const draft = await ok<{ createWorkflowVersionDraft: VersionData }>(
      api,
      token,
      CREATE_WORKFLOW_DRAFT,
      { input: { workflowKey: KEY, baseVersion: null } },
    );
    const saved = await ok<{ saveWorkflowVersionDraft: VersionData }>(
      api,
      token,
      SAVE_WORKFLOW_DRAFT,
      {
        input: {
          workflowKey: KEY,
          expectedDraftRevision:
            draft.createWorkflowVersionDraft.workflowVersion.draftRevision,
          definition: { steps, edges: null },
        },
      },
    );
    const published = await ok<{ publishWorkflowVersion: VersionData }>(
      api,
      token,
      PUBLISH_WORKFLOW,
      {
        input: {
          workflowKey: KEY,
          expectedDraftRevision:
            saved.saveWorkflowVersionDraft.workflowVersion.draftRevision,
          changelog: "測試發布",
        },
      },
    );
    return published.publishWorkflowVersion.workflowVersion.version;
  }

  async function stepKeys(): Promise<string[]> {
    const definition = await engine.definitionOf({
      workflowKey: KEY,
      workflowVersion: 1,
    });
    return definition.steps.map((step) => step.key);
  }

  it("先讀舊版 → reset 清掉後回「不存在」→ 以同 key 重建成同版號、不同內容後讀到新內容", async () => {
    const manager = { kind: "manager", level: 1 };
    expect(await publishShared([reviewStep("old_boss", manager)])).toBe(1);
    // 讀兩次:第一次之後若有快取,第二次起就不再看資料庫
    expect(await stepKeys()).toEqual(["old_boss"]);
    expect(await stepKeys()).toEqual(["old_boss"]);

    // 真的 reset(data):畫面上自建、沒有登記的共用流程連同版本一起清掉
    const reset = await runDataReset(databaseUri);
    expect(reset.stderr).toBe("");
    expect(reset.status).toBe(0);
    expect(
      await connection.collection("workflow_versions").countDocuments({
        workflowKey: KEY,
      }),
    ).toBe(0);

    // 同一個 service instance:已刪除的版本回「不存在」,不是先前讀到的那一份
    await expect(stepKeys()).rejects.toThrow(`流程版本 ${KEY}@1 不存在`);

    // 以同一個 key 重建:版號又從 1 起算,內容不同
    expect(
      await publishShared([
        reviewStep("new_boss", manager),
        reviewStep("new_second", { kind: "manager", level: 2 }),
      ]),
    ).toBe(1);
    expect(await stepKeys()).toEqual(["new_boss", "new_second"]);
    expect(api.app.get(WorkflowEngineService)).toBe(engine);
  });
});
