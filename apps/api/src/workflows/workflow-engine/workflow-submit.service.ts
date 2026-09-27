import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import type { StoredValues, SubmissionSummary } from "@repo/domain/form";
import {
  type WorkflowDefinition,
  checkSubmitCompatibility,
  initialStepStates,
  startStepKey,
} from "@repo/domain/workflow";

import type { Persisted } from "../../database/base.repository";
import { BusinessRelationshipsRepository } from "../../database/business-relationships.repository";
import {
  type FormSubmissionDocument,
  FormSubmissionsRepository,
  FormVersionsRepository,
  FormsRepository,
  WorkflowInstancesRepository,
  WorkflowVersionsRepository,
} from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import type { FormRevision } from "../../database/schemas/form-submission.schema";
import type { WorkflowLinkSource } from "../../database/schemas/workflow-instance.schema";
import {
  type WorkflowRecord,
  WorkflowsRepository,
} from "../../database/workflows.repository";
import { systemContext } from "../tenant-directory.service";
import { WorkflowAccessService } from "../workflow-access.service";
import { definitionOfVersion } from "../workflow-definition-input";
import {
  isDuplicateKey,
  submitBlockedError,
  workflowConflictError,
} from "../workflows-error";
import type { InstanceRecord } from "./instance-writes";
import {
  WorkflowEngineHooks,
  WorkflowEngineService,
} from "./workflow-engine.service";

type SubmissionRecord = Persisted<FormSubmissionDocument>;

/** 送出時檢查的結果:不走流程(6a),或走這一版流程。 */
export type SubmitRoute =
  | { kind: "noWorkflow" }
  | {
      kind: "workflow";
      workflowKey: string;
      workflowVersion: number;
      definition: WorkflowDefinition;
    };

/** 這次送出要寫進提交的內容(6a 的驗證與重算已做完)。 */
export interface SubmitContent {
  values: StoredValues;
  summary: SubmissionSummary;
  ctx: FormRevision["ctx"];
  at: Date;
}

/**
 * 綁流程時的送出(Spec 6b §6「送出(綁流程時)的寫入順序」),掛在 6a 的 `submitFormSubmission` 裡:
 *
 * 0. 提交已是 `reviewing` 且指向屬於這個修訂的實例 → 直接接續(`linking` 補第 4 步、之後推進);
 *    不跑送出時檢查、不看目前綁定、不增加修訂(`resume`)
 * 1. 6a 的驗證與重算(呼叫端)→ 送出時檢查(`route`)→ 新修訂號 N
 * 2. 建 `linking` 實例(`(submissionId, N)` 唯一;記 `linkSource`)。撞唯一鍵:未連上 → 核對 `linkSource`,
 *    相同沿用、不同整份重置
 * 3. 提交的 `values` / `summary` / `revision` / 快照 / `reviewing` / `currentInstanceId` / `editVersion`
 *    **同一次**條件更新;舊實例 → `superseded`
 * 4. 實例 `linking → running`、`activeStepKeys = [startStepKey]`、`history: started`(CAS)
 * 5. `advance`
 *
 * 任一步失敗,重試同一次送出會從缺的那步接下去;`linking` 的實例不派單。
 */
@Injectable()
export class WorkflowSubmitService {
  constructor(
    private readonly submissions: FormSubmissionsRepository,
    private readonly instances: WorkflowInstancesRepository,
    private readonly forms: FormsRepository,
    private readonly formVersions: FormVersionsRepository,
    private readonly workflows: WorkflowsRepository,
    private readonly workflowVersions: WorkflowVersionsRepository,
    private readonly relations: BusinessRelationshipsRepository,
    private readonly access: WorkflowAccessService,
    private readonly engine: WorkflowEngineService,
    private readonly hooks: WorkflowEngineHooks,
  ) {}

  /**
   * 第 0 步:`reviewing` 的提交指向屬於目前修訂的實例 → 接續(第 4 步若沒做就補、再推進)。
   * 指向的實例不屬於目前修訂(資料不一致)→ `CONFLICT`(`STATUS_MISMATCH`)。
   */
  async resume(record: SubmissionRecord): Promise<void> {
    const instance =
      record.currentInstanceId === null
        ? null
        : await this.engine.findInstance(record.currentInstanceId);
    if (
      instance === null ||
      !instance.submissionId.equals(record._id) ||
      instance.revision !== record.revision
    ) {
      throw workflowConflictError(
        `Submission ${String(record._id)} is already under review`,
        "STATUS_MISMATCH",
      );
    }
    await this.supersedeOlder(record._id, record.revision);
    await this.start(instance);
    await this.engine.advance(instance._id);
  }

  /**
   * 第 1 步的送出時檢查(Spec §3):這筆提交綁的表單版本 + 現在綁的流程目前發布版搭不搭。
   * 擋下 → `FORBIDDEN` + reason(`WORKFLOW_REMOVED` / `WORKFLOW_UNPUBLISHED` / `WORKFLOW_MISCONFIGURED`)。
   */
  async route(record: SubmissionRecord): Promise<SubmitRoute> {
    const context = systemContext();
    const tenantId = record.tenantId;
    const form = await this.forms.findOne(context, { key: record.formKey });
    const binding =
      tenantId === null || form === null
        ? null
        : await this.relations.findOne(tenantId, {
            type: "org_form_workflow",
            firstId: tenantId,
            secondId: form._id,
          });
    const workflow =
      binding?.thirdId && tenantId !== null
        ? await this.workflowById(tenantId, binding.thirdId)
        : null;
    const current =
      workflow?.currentVersion === null || workflow === null
        ? null
        : await this.workflowVersions.findOne(context, {
            workflowKey: workflow.key,
            version: workflow.currentVersion,
          });
    const version = await this.formVersions.findOne(context, {
      formKey: record.formKey,
      version: record.version,
    });
    const result = checkSubmitCompatibility({
      formKey: record.formKey,
      formFields: version?.fields ?? [],
      hasBeenReviewed: record.currentInstanceId !== null,
      binding: binding === null ? null : { workflowKey: workflow?.key ?? "" },
      workflow:
        workflow === null || tenantId === null
          ? null
          : {
              key: workflow.key,
              currentVersion: current ? workflow.currentVersion : null,
              isAssigned: await this.access.isHeldByTenant(tenantId, workflow),
            },
      definition: current ? definitionOfVersion(current) : null,
    });
    switch (result.kind) {
      case "noWorkflow": {
        return result;
      }
      case "blocked": {
        throw submitBlockedError(result.message, result.code, result.issues);
      }
      case "workflow": {
        return {
          ...result,
          definition: definitionOfVersion(
            current ?? { steps: [], edges: null },
          ),
        };
      }
    }
  }

  /** 第 2–5 步(第 1 步的驗證、重算與送出時檢查已由呼叫端做完)。 */
  async submit(
    operator: OperatorContext,
    record: SubmissionRecord,
    expectedEditVersion: number,
    content: SubmitContent,
    route: Extract<SubmitRoute, { kind: "workflow" }>,
  ): Promise<void> {
    const revision = record.revision + 1;
    const linkSource: WorkflowLinkSource = {
      submissionEditVersion: expectedEditVersion,
      formVersion: record.version,
      workflowKey: route.workflowKey,
      workflowVersion: route.workflowVersion,
    };
    // 第 2 步
    const instance = await this.linkingInstance(
      record,
      revision,
      content.summary,
      linkSource,
      route,
    );
    await this.hooks.reached("submit:instance-created");
    // 第 3 步:提交同一次更新(條件含 editVersion 與讀到的狀態)
    const linked = await this.submissions.findOwnAndUpdate(
      operator,
      {
        _id: record._id,
        status: record.status,
        editVersion: expectedEditVersion,
      },
      {
        $set: {
          values: content.values,
          summary: content.summary,
          revision,
          status: "reviewing",
          currentInstanceId: instance._id,
          blocked: false,
          submittedAt: record.submittedAt ?? content.at,
        },
        $push: {
          revisions: { revision, values: content.values, ctx: content.ctx },
        },
        $inc: { editVersion: 1 },
      },
    );
    if (!linked) {
      throw workflowConflictError(
        `Submission ${String(record._id)} was updated by someone else`,
        "EDIT_VERSION_MISMATCH",
      );
    }
    await this.hooks.reached("submit:submission-linked");
    await this.supersedeOlder(record._id, revision);
    // 第 4、5 步
    await this.start(instance);
    await this.hooks.reached("submit:started");
    await this.engine.advance(instance._id);
  }

  /**
   * 第 2 步:建 `linking` 實例;同修訂號已有 `linking` 實例(上次送出在第 3 步前失敗)→
   * `linkSource` 相同沿用、不同整份重置(未連上、沒有任務,重置安全)。
   */
  private async linkingInstance(
    record: SubmissionRecord,
    revision: number,
    summary: SubmissionSummary,
    linkSource: WorkflowLinkSource,
    route: Extract<SubmitRoute, { kind: "workflow" }>,
  ): Promise<InstanceRecord> {
    const content = {
      formVersion: record.version,
      summary,
      workflowKey: route.workflowKey,
      workflowVersion: route.workflowVersion,
      linkSource,
      activeStepKeys: [],
      steps: initialStepStates(route.definition),
      history: [],
      outcome: null,
      finishedAt: null,
    };
    // 實例的建立者 = 申請人(資料歸屬與主管解析的起點都抄自提交)
    const context = systemContext(record.createdBy);
    try {
      return await this.instances.create(context, {
        submissionId: record._id,
        revision,
        orgId: record.orgId,
        moduleKey: record.moduleKey,
        formKey: record.formKey,
        status: "linking",
        editVersion: 0,
        ...content,
      } as never);
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }
    const existing = await this.instances.findOne(context, {
      submissionId: record._id,
      revision,
    });
    if (existing?.status !== "linking") {
      throw workflowConflictError(
        `Instance for revision ${String(revision)} is not linking`,
        "INSTANCE_CHANGED",
      );
    }
    if (isSameLinkSource(existing.linkSource, linkSource)) {
      return existing;
    }
    const reset = await this.instances.findOneAndUpdate(
      context,
      { _id: existing._id, status: "linking" },
      { $set: content, $inc: { editVersion: 1 } },
    );
    if (!reset) {
      throw workflowConflictError(
        `Instance for revision ${String(revision)} changed while resetting`,
        "INSTANCE_CHANGED",
      );
    }
    return reset;
  }

  /** 第 4 步:`linking → running`、從起點開始(CAS;已不是 `linking` = 已做過)。 */
  private async start(instance: InstanceRecord): Promise<void> {
    if (instance.status !== "linking") {
      return;
    }
    const definition = await this.engine.definitionOf(instance);
    const start = startStepKey(definition);
    await this.instances.findOneAndUpdate(
      systemContext(),
      { _id: instance._id, status: "linking" },
      {
        $set: {
          status: "running",
          activeStepKeys: start === null ? [] : [start],
        },
        $push: { history: { at: new Date(), kind: "started" } },
        $inc: { editVersion: 1 },
      },
    );
  }

  /**
   * 再送出後舊實例 → `superseded`(被退回 / 撤回的前一個修訂的實例);`advance` 收尾它自己的任務與歷程,
   * 不碰提交。重試送出時也會再跑一次(條件更新,已取代過就不動)。
   */
  private async supersedeOlder(
    submissionId: Types.ObjectId,
    revision: number,
  ): Promise<void> {
    const context = systemContext();
    const older = await this.instances.findMany(context, {
      submissionId,
      revision: { $lt: revision },
      status: { $in: ["returned", "withdrawn"] },
    });
    for (const instance of older) {
      await this.instances.findOneAndUpdate(
        context,
        { _id: instance._id, status: instance.status },
        {
          $set: { status: "superseded" },
          $push: { history: { at: new Date(), kind: "superseded" } },
          $inc: { editVersion: 1 },
        },
      );
      await this.engine.advance(instance._id);
    }
  }

  private async workflowById(
    tenantId: Types.ObjectId,
    id: Types.ObjectId,
  ): Promise<WorkflowRecord | null> {
    return (
      (await this.workflows.findOne(null, { _id: id })) ??
      (await this.workflows.findOne(tenantId, { _id: id }))
    );
  }
}

function isSameLinkSource(
  left: WorkflowLinkSource | null,
  right: WorkflowLinkSource,
): boolean {
  return (
    left !== null &&
    left.submissionEditVersion === right.submissionEditVersion &&
    left.formVersion === right.formVersion &&
    left.workflowKey === right.workflowKey &&
    left.workflowVersion === right.workflowVersion
  );
}
