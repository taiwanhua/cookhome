import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { LIVE_INSTANCE_STATUSES } from "@repo/domain/workflow";

import { WorkflowInstancesRepository } from "../../database/database.module";
import { systemContext } from "../tenant-directory.service";
import { workflowConflictError } from "../workflows-error";
import {
  WorkflowEngineHooks,
  WorkflowEngineService,
} from "./workflow-engine.service";

const LIVE = [...LIVE_INSTANCE_STATUSES];

/** CAS 重讀次數(實例被別的動作推進、但還沒有決定時重試)。 */
const CAS_ATTEMPTS = 3;

/**
 * 撤回(Spec 6b §6「撤回」):條件更新實例 `{ status ∈ [running, blocked], editVersion: 預期值,
 * 所有關卡的 decisions 都空 }` → `withdrawn`、所有 active 關卡 `terminated`、`$inc editVersion`。
 * 「沒有決定」**寫進條件本身**,不只靠先讀:撤回讀到無決定後決定才寫入 → 決定的原子 `+1` 讓撤回的 CAS 失敗,
 * 重讀後看到決定 → 拒絕「已有審核意見,不能撤回」。之後 `advance` 收尾(列 2:任務取消、提交 → `withdrawn`)。
 */
@Injectable()
export class InstanceWithdrawService {
  constructor(
    private readonly instances: WorkflowInstancesRepository,
    private readonly engine: WorkflowEngineService,
    private readonly hooks: WorkflowEngineHooks,
  ) {}

  async withdraw(
    instanceId: Types.ObjectId,
    actorId: Types.ObjectId,
  ): Promise<void> {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const instance = await this.engine.findInstance(instanceId);
      if (instance === null || !LIVE.includes(instance.status as never)) {
        throw workflowConflictError(
          "The submission is no longer under review",
          "STATUS_MISMATCH",
        );
      }
      if (instance.steps.some((step) => step.decisions.length > 0)) {
        throw workflowConflictError(
          "Accepted review decisions exist; the submission can no longer be withdrawn",
          "HAS_DECISIONS",
        );
      }
      const set: Record<string, unknown> = {
        status: "withdrawn",
        activeStepKeys: [],
      };
      const arrayFilters = instance.activeStepKeys.map((stepKey, index) => {
        set[`steps.$[s${String(index)}].status`] = "terminated";
        return { [`s${String(index)}.stepKey`]: stepKey };
      });
      await this.hooks.reached("withdraw:before-write");
      const updated = await this.instances.findOneAndUpdate(
        systemContext(),
        {
          _id: instance._id,
          editVersion: instance.editVersion,
          status: { $in: LIVE },
          "steps.decisions.0": { $exists: false },
        },
        {
          $set: set,
          $push: {
            history: { at: new Date(), kind: "withdrawn", userId: actorId },
          },
          $inc: { editVersion: 1 },
        },
        arrayFilters.length > 0 ? { arrayFilters } : {},
      );
      if (updated !== null) {
        await this.engine.advance(instance._id);
        return;
      }
    }
    throw workflowConflictError(
      "The instance kept changing; reload and try again",
      "INSTANCE_CHANGED",
    );
  }
}
