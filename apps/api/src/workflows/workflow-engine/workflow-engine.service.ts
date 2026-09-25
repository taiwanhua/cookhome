import { Injectable, Logger } from "@nestjs/common";
import type { Types } from "mongoose";

import {
  type AdvanceAction,
  type AdvanceInput,
  type AdvancePlan,
  type WorkflowDefinition,
  advance,
  isReviewStep,
  stepOf,
} from "@repo/domain/workflow";

import {
  WorkflowInstancesRepository,
  WorkflowVersionsRepository,
} from "../../database/database.module";
import { WorkflowSubmissionStore } from "../../database/workflow-submission-store";
import { WorkflowTasksRepository } from "../../database/workflow-tasks.repository";
import { systemContext } from "../tenant-directory.service";
import { definitionOfVersion } from "../workflow-definition-input";
import { isDuplicateKey } from "../workflows-error";
import {
  type InstanceRecord,
  historyEventDocument,
  instanceFilterOf,
  instanceUpdateOf,
  taskProjectionDocument,
  toInstanceSnapshot,
  toObjectId,
  toSubmissionSnapshot,
  toTaskSnapshot,
} from "./instance-writes";
import { StepEntryService } from "./step-entry.service";
import { WorkflowNotifier } from "./workflow-notifier.service";

/** 一輪動作執行的結果。 */
type RoundResult = "done" | "casFailed" | "invalid";

/** 推進的上限輪數(正常一次推進只要個位數輪;超過代表資料在來回打架,記 log 停下)。 */
const MAX_ROUNDS = 60;

/**
 * 引擎的檢查點(正式環境什麼都不做)。要驗「中斷後重試 = 一次成功」,測試必須能讓某一步**真的**
 * 在半路失敗 —— GraphQL 端點上看不到這個能力,所以測試經 `app.get(WorkflowEngineHooks)` 讓指定檢查點丟錯
 * (TEST-07 的第二個接縫,理由同 `FormPublishHooks`):
 * - `submit:instance-created` / `submit:submission-linked` / `submit:started`:送出寫入順序第 2 / 3 / 4 步之後
 * - `action:<動作種類>`:推進執行每一個動作之前(如 `action:createTask`)
 */
@Injectable()
export class WorkflowEngineHooks {
  private last: string | null = null;

  /** 最後走到的檢查點(除錯用)。 */
  get lastCheckpoint(): string | null {
    return this.last;
  }

  reached(checkpoint: string): Promise<void> {
    this.last = checkpoint;
    return Promise.resolve();
  }
}

/**
 * `advance(instance)` 的執行器(Spec 6b §6「冪等推進」;判斷表本體是 `@repo/domain/workflow` 的純函式
 * `advance`,**執行合約**見它的檔頭):
 *
 * 1. 讀實例(權威)、它的全部任務、對應的提交 → `advance` → 列 5 需要時先解析進關結果再呼叫一次
 * 2. 依序執行動作,每個寫入都是條件更新:實例用 `editVersion` CAS(節點以 `arrayFilters` 指到 `stepKey`)、
 *    任務用 `(instanceId, taskKey)` 唯一鍵與讀到的狀態、提交用「仍指向本實例 + 修訂號 + 審核中」
 * 3. **`updateInstance` 的條件不成立就中止本輪**、重讀再判斷;其他動作條件不成立 = 已做過
 * 4. `invalidState` = 權威資料自相矛盾:不寫、停下、記 log(它會一直出現在「需要推進」)
 *
 * 重複到「沒事可做」。任何入口(送出、決定、撤回、改派、新增審核者、失效 hook、重試推進)都呼叫同一支,
 * 重跑結果相同。
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  /** 已發布的流程版本不會再變,定義可以快取。 */
  private readonly definitions = new Map<string, WorkflowDefinition>();

  constructor(
    private readonly instances: WorkflowInstancesRepository,
    private readonly versions: WorkflowVersionsRepository,
    private readonly tasks: WorkflowTasksRepository,
    private readonly submissions: WorkflowSubmissionStore,
    private readonly entries: StepEntryService,
    private readonly notifier: WorkflowNotifier,
    private readonly hooks: WorkflowEngineHooks,
  ) {}

  /** 實例走的那一版流程定義。 */
  async definitionOf(instance: {
    workflowKey: string;
    workflowVersion: number;
  }): Promise<WorkflowDefinition> {
    const cacheKey = `${instance.workflowKey}@${String(instance.workflowVersion)}`;
    const cached = this.definitions.get(cacheKey);
    if (cached) {
      return cached;
    }
    const version = await this.versions.findOne(systemContext(), {
      workflowKey: instance.workflowKey,
      version: instance.workflowVersion,
    });
    if (!version) {
      throw new Error(`流程版本 ${cacheKey} 不存在`);
    }
    const definition = definitionOfVersion(version);
    this.definitions.set(cacheKey, definition);
    return definition;
  }

  async findInstance(
    instanceId: Types.ObjectId,
  ): Promise<InstanceRecord | null> {
    return this.instances.findOne(systemContext(), { _id: instanceId });
  }

  /** 推進到「沒事可做」;回最後讀到的實例(實例不存在回 null)。 */
  async advance(instanceId: Types.ObjectId): Promise<InstanceRecord | null> {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const instance = await this.findInstance(instanceId);
      if (instance === null) {
        return null;
      }
      const definition = await this.definitionOf(instance);
      const plan = await this.planOf(instance, definition);
      if (plan.actions.length === 0) {
        return instance;
      }
      const result = await this.execute(instance, definition, plan.actions);
      if (result === "invalid") {
        return instance;
      }
    }
    this.logger.warn(
      `實例 ${String(instanceId)} 推進超過 ${String(MAX_ROUNDS)} 輪仍未停下,先停止(可由重試推進接續)`,
    );
    return this.findInstance(instanceId);
  }

  /** 這一輪的判斷(不寫入);給「需要推進」的識別用。 */
  async planOf(
    instance: InstanceRecord,
    definition: WorkflowDefinition,
  ): Promise<AdvancePlan> {
    const tenantId = instance.tenantId;
    const [tasks, submission] =
      tenantId === null
        ? [[], null]
        : await Promise.all([
            this.tasks.findMany(tenantId, { instanceId: instance._id }),
            this.submissions.findById(tenantId, instance.submissionId),
          ]);
    const input: AdvanceInput = {
      definition,
      instance: toInstanceSnapshot(instance),
      tasks: tasks.map((task) => toTaskSnapshot(task)),
      submission: toSubmissionSnapshot(submission),
      now: new Date(),
    };
    const plan = advance(input);
    const [first] = plan.actions;
    if (first?.kind !== "resolveStepEntry") {
      return plan;
    }
    const step = stepOf(definition, first.stepKey);
    if (step === undefined || !isReviewStep(step)) {
      return {
        row: "invalid",
        actions: [
          {
            kind: "invalidState",
            reason: "entering step is not a review step",
            stepKey: first.stepKey,
          },
        ],
      };
    }
    const entry = await this.entries.resolve(instance, step);
    return advance({ ...input, stepEntries: { [first.stepKey]: entry } });
  }

  private async execute(
    instance: InstanceRecord,
    definition: WorkflowDefinition,
    actions: readonly AdvanceAction[],
  ): Promise<RoundResult> {
    for (const action of actions) {
      await this.hooks.reached(`action:${action.kind}`);
      const result = await this.apply(instance, definition, action);
      if (result !== "done") {
        return result;
      }
    }
    return "done";
  }

  private async apply(
    instance: InstanceRecord,
    definition: WorkflowDefinition,
    action: AdvanceAction,
  ): Promise<RoundResult> {
    const tenantId = instance.tenantId;
    switch (action.kind) {
      case "resolveStepEntry": {
        // 兩段式已在 planOf 處理;走到這裡代表第二次呼叫仍要求解析,當作資料錯誤
        this.logger.error(
          `實例 ${String(instance._id)} 的關卡 ${action.stepKey} 解析後仍要求進關解析`,
        );
        return "invalid";
      }
      case "invalidState": {
        this.logger.error(
          `實例 ${String(instance._id)} 的權威資料自相矛盾(${action.reason};關卡 ${action.stepKey ?? "-"}、任務 ${action.taskKey ?? "-"}),停止推進、等人工處理`,
        );
        return "invalid";
      }
      case "updateInstance": {
        const { update, arrayFilters } = instanceUpdateOf(action.update);
        const updated = await this.instances.findOneAndUpdate(
          systemContext(),
          instanceFilterOf(instance._id, action.condition),
          update,
          arrayFilters.length > 0 ? { arrayFilters } : {},
        );
        return updated === null ? "casFailed" : "done";
      }
      case "updateSubmission": {
        await this.submissions.updateOne(
          tenantId,
          {
            _id: toObjectId(action.condition.submissionId),
            currentInstanceId: toObjectId(action.condition.currentInstanceId),
            revision: action.condition.revision,
            status: action.condition.status,
          },
          { ...action.set },
          null,
        );
        return "done";
      }
      case "createTask": {
        await this.createTask(instance, action);
        return "done";
      }
      case "syncTask": {
        await this.tasks.updateOne(
          systemContext(),
          tenantId,
          {
            instanceId: instance._id,
            taskKey: action.taskKey,
            status: action.expectedStatus,
          },
          { $set: taskProjectionDocument(action.set) },
        );
        return "done";
      }
      case "notifyTaskCreated": {
        await this.notifier.taskCreated(
          instance,
          definition,
          action.stepKey,
          action.assigneeId,
        );
        return "done";
      }
      case "notifyResult": {
        await this.notifier.result(instance, action.result);
        return "done";
      }
      case "appendHistoryOnce": {
        const { event } = action;
        await this.instances.findOneAndUpdate(
          systemContext(),
          {
            _id: instance._id,
            history: {
              $not: {
                $elemMatch: {
                  kind: event.kind,
                  taskKey: event.taskKey ?? null,
                  result: event.result ?? null,
                },
              },
            },
          },
          { $push: { history: historyEventDocument(event) } },
        );
        return "done";
      }
    }
  }

  /** 依計畫建任務;`(instanceId, taskKey)` 已存在 = 已建過(推進重跑不重建)。 */
  private async createTask(
    instance: InstanceRecord,
    action: Extract<AdvanceAction, { kind: "createTask" }>,
  ): Promise<void> {
    try {
      await this.tasks.create(systemContext(), instance.tenantId, {
        instanceId: instance._id,
        stepKey: action.stepKey,
        taskKey: action.taskKey,
        submissionId: instance.submissionId,
        revision: instance.revision,
        moduleKey: instance.moduleKey,
        formKey: instance.formKey,
        assigneeId: toObjectId(action.projection.assigneeId),
        previousAssigneeIds: action.projection.previousAssigneeIds.map((id) =>
          toObjectId(id),
        ),
        status: action.projection.status,
        decidedAt: action.projection.decidedAt,
        comment: action.projection.comment,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }
  }
}
