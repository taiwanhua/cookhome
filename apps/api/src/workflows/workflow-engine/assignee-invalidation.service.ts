import { Injectable, Logger } from "@nestjs/common";
import type { Types } from "mongoose";

import {
  LIVE_INSTANCE_STATUSES,
  isReviewStep,
  stepOf,
} from "@repo/domain/workflow";

import { WorkflowInstancesRepository } from "../../database/database.module";
import {
  TenantDirectoryService,
  systemContext,
} from "../tenant-directory.service";
import type { InstanceRecord } from "./instance-writes";
import { WorkflowEngineService } from "./workflow-engine.service";

const LIVE = [...LIVE_INSTANCE_STATUSES];

/** CAS 重讀次數(實例被別的動作推進時重試)。 */
const CAS_ATTEMPTS = 3;

/**
 * 審核者失效 hook(Spec 6b §6「審核者失效」):使用者被停用、或被移出某個租戶後,
 * 對他在該租戶所有「進行中關卡、尚無決定」的派任計畫項目 CAS 實例 `assigneeState = invalid`、
 * `history: blocked`、`$inc editVersion`;該關:`any` 且同關仍有有效未決定的項目 → 不變,
 * 否則 `blocked = true`、實例 `blocked`(其他 active 關卡照常)。之後 `advance` 同步任務投影
 * (→ `blocked`)與提交的阻擋標記。失效的人已被接受的決定不受影響。
 *
 * 由使用者管理的停用 / 所屬組織異動呼叫(`users.service.ts`);**冪等**:只動「仍有效、且此刻已不合格」的項目,
 * 重呼叫不會重複記錄。
 */
@Injectable()
export class AssigneeInvalidationService {
  private readonly logger = new Logger(AssigneeInvalidationService.name);

  constructor(
    private readonly instances: WorkflowInstancesRepository,
    private readonly directory: TenantDirectoryService,
    private readonly engine: WorkflowEngineService,
  ) {}

  async onUserChanged(userId: Types.ObjectId): Promise<void> {
    const candidates = await this.instances.findMany(systemContext(), {
      status: { $in: LIVE },
      steps: {
        $elemMatch: {
          status: "active",
          plan: { $elemMatch: { assigneeId: userId, assigneeState: "active" } },
        },
      },
    });
    for (const candidate of candidates) {
      if (
        candidate.tenantId === null ||
        (await this.directory.isEligible(candidate.tenantId, userId))
      ) {
        continue;
      }
      if (await this.invalidate(candidate._id, userId)) {
        await this.engine.advance(candidate._id);
      }
    }
  }

  /** 對一個實例 CAS 標失效;回是否真的寫了。 */
  private async invalidate(
    instanceId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const instance = await this.engine.findInstance(instanceId);
      if (instance === null || !LIVE.includes(instance.status as never)) {
        return false;
      }
      const change = await this.changeOf(instance, userId);
      if (change === null) {
        return false;
      }
      const updated = await this.instances.findOneAndUpdate(
        systemContext(),
        { _id: instance._id, editVersion: instance.editVersion },
        change.update,
        { arrayFilters: change.arrayFilters },
      );
      if (updated !== null) {
        return true;
      }
    }
    this.logger.warn(
      `實例 ${String(instanceId)} 標審核者 ${String(userId)} 失效時一直被別的動作搶先,留給重試推進 / 下次異動`,
    );
    return false;
  }

  /** 要改的項目與關卡;沒有要改的回 null。 */
  private async changeOf(
    instance: InstanceRecord,
    userId: Types.ObjectId,
  ): Promise<{
    update: Record<string, unknown>;
    arrayFilters: Record<string, unknown>[];
  } | null> {
    const definition = await this.engine.definitionOf(instance);
    const set: Record<string, unknown> = {};
    const arrayFilters: Record<string, unknown>[] = [];
    const history: Record<string, unknown>[] = [];
    const now = new Date();
    let isInstanceBlocked = instance.status === "blocked";
    for (const [stepIndex, step] of instance.steps.entries()) {
      if (
        step.status !== "active" ||
        !instance.activeStepKeys.includes(step.stepKey)
      ) {
        continue;
      }
      const decided = new Set(step.decisions.map((entry) => entry.taskKey));
      const targets = step.plan.filter(
        (item) =>
          item.assigneeId.equals(userId) &&
          item.assigneeState === "active" &&
          !decided.has(item.taskKey),
      );
      if (targets.length === 0) {
        continue;
      }
      const stepName = `s${String(stepIndex)}`;
      arrayFilters.push({ [`${stepName}.stepKey`]: step.stepKey });
      for (const [itemIndex, item] of targets.entries()) {
        const itemName = `${stepName}p${String(itemIndex)}`;
        arrayFilters.push({ [`${itemName}.taskKey`]: item.taskKey });
        set[`steps.$[${stepName}].plan.$[${itemName}].assigneeState`] =
          "invalid";
        history.push({
          at: now,
          kind: "blocked",
          stepKey: step.stepKey,
          taskKey: item.taskKey,
          userId,
        });
      }
      const node = stepOf(definition, step.stepKey);
      const targetKeys = new Set(targets.map((item) => item.taskKey));
      const hasOtherActive = step.plan.some(
        (item) =>
          !targetKeys.has(item.taskKey) &&
          item.assigneeState === "active" &&
          !decided.has(item.taskKey),
      );
      const isStepBlocked =
        node === undefined ||
        !isReviewStep(node) ||
        node.mode === "all" ||
        !hasOtherActive;
      if (isStepBlocked) {
        set[`steps.$[${stepName}].blocked`] = true;
        isInstanceBlocked = true;
      }
    }
    if (history.length === 0) {
      return null;
    }
    if (isInstanceBlocked) {
      set.status = "blocked";
    }
    return {
      update: {
        $set: set,
        $push: { history: { $each: history } },
        $inc: { editVersion: 1 },
      },
      arrayFilters,
    };
  }
}
