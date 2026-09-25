import { Injectable } from "@nestjs/common";
import type { Types } from "mongoose";

import { stepOf } from "@repo/domain/workflow";

import { BusinessRelationshipsRepository } from "../../database/business-relationships.repository";
import {
  FormsRepository,
  ModulesRepository,
} from "../../database/database.module";
import {
  type SubmissionFilter,
  type SubmissionSnapshotRecord,
  WorkflowSubmissionStore,
} from "../../database/workflow-submission-store";
import { WorkflowTasksRepository } from "../../database/workflow-tasks.repository";
import {
  FormAccessService,
  type FormOperatorFacts,
  toObjectId,
} from "../../forms/form-access.service";
import { formModulePermission } from "../../forms/form-permission-keys";
import type { FormSubmissionStatusEnum } from "../../forms/form-runtime/models/form-submission.model";
import type {
  WorkflowInstanceModel,
  WorkflowTasksPayload,
} from "../models/workflow-instance.model";
import { systemContext } from "../tenant-directory.service";
import { SubmissionReadAccess } from "../workflow-engine/submission-read-access.service";
import { WorkflowEngineService } from "../workflow-engine/workflow-engine.service";
import { WorkflowPresenter } from "../workflow-engine/workflow-presenter.service";
import { WORKFLOW_REASSIGN_PERMISSION } from "../workflow-keys";
import { workflowNotFoundError } from "../workflows-error";
import {
  type ApplicableModuleForms,
  type ApplicationItem,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type MyApplicationsInput,
  type MyApplicationsPayload,
  type MyTasksInput,
} from "./apply-center.types";

const DONE_STATUSES = ["approved", "rejected", "returned", "late"];

function pageOf(input: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  return {
    page: Math.max(1, input.page ?? 1),
    pageSize: Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    ),
  };
}

/**
 * 申請中心(`apply-center`,Spec 6b §4「申請中心的資料來源」、§7):兩個跨模組頁籤 + 新申請入口 + 詳情。
 * **都以 `tenantId` 為邊界**,不套可見範圍與資料範圍(內容以「我」為邊界:我送的、派給我的);
 * 任務列表與詳情的摘要一律讀**實例快照**。
 */
@Injectable()
export class ApplyCenterService {
  constructor(
    private readonly store: WorkflowSubmissionStore,
    private readonly tasks: WorkflowTasksRepository,
    private readonly relations: BusinessRelationshipsRepository,
    private readonly forms: FormsRepository,
    private readonly modules: ModulesRepository,
    private readonly formAccess: FormAccessService,
    private readonly readAccess: SubmissionReadAccess,
    private readonly engine: WorkflowEngineService,
    private readonly presenter: WorkflowPresenter,
  ) {}

  /** 我的申請:`createdBy = 我` 且(走過流程,或該表單目前綁了流程)。 */
  async myApplications(
    facts: FormOperatorFacts,
    input: MyApplicationsInput,
  ): Promise<MyApplicationsPayload> {
    const { page, pageSize } = pageOf(input);
    const tenantId = facts.tenantId;
    const actorId = facts.operator.actorId;
    if (tenantId === null || actorId === null) {
      return { items: [], totalCount: 0, page, pageSize };
    }
    const boundKeys = await this.boundFormKeys(tenantId);
    const filter: SubmissionFilter = {
      createdBy: actorId,
      ...(input.moduleKey ? { moduleKey: input.moduleKey } : {}),
      ...(input.formKey ? { formKey: input.formKey } : {}),
      ...(input.status ? { status: input.status } : {}),
      $or: [
        { currentInstanceId: { $ne: null } },
        { formKey: { $in: [...boundKeys] } },
      ],
    };
    const [totalCount, records] = await Promise.all([
      this.store.count(tenantId, filter),
      this.store.findMany(tenantId, filter, {
        sort: { updatedAt: -1, _id: -1 },
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    ]);
    const items: ApplicationItem[] = [];
    for (const record of records) {
      items.push(await this.applicationOf(record));
    }
    return { items, totalCount, page, pageSize };
  }

  /** 新申請:我有 `create` 且可新增、而且本租戶綁了流程的表單,依模組分組。 */
  async applicableForms(
    facts: FormOperatorFacts,
  ): Promise<ApplicableModuleForms[]> {
    if (facts.tenantId === null) {
      return [];
    }
    const boundKeys = await this.boundFormKeys(facts.tenantId);
    const modules = await this.modules.findMany(
      systemContext(),
      { engine: "form" },
      { sort: { order: 1, key: 1 } },
    );
    const groups: ApplicableModuleForms[] = [];
    for (const module of modules) {
      if (
        !this.formAccess.has(facts, formModulePermission(module.key, "create"))
      ) {
        continue;
      }
      const available = await this.formAccess.availableForms(facts, module.key);
      const forms = available
        .filter((form) => boundKeys.has(form.key))
        .map((form) => ({
          key: form.key,
          name: form.name,
          moduleKey: form.moduleKey,
          currentVersion: form.currentVersion ?? 0,
          tabLabelTemplate: form.tabLabelTemplate,
        }));
      if (forms.length > 0) {
        groups.push({ moduleKey: module.key, moduleName: module.name, forms });
      }
    }
    return groups;
  }

  /** 待我審核:`assigneeId = 我`;摘要與申請人讀實例快照。 */
  async myTasks(
    facts: FormOperatorFacts,
    input: MyTasksInput,
  ): Promise<WorkflowTasksPayload> {
    const { page, pageSize } = pageOf(input);
    const tenantId = facts.tenantId;
    const actorId = facts.operator.actorId;
    if (tenantId === null || actorId === null) {
      return { items: [], totalCount: 0, page, pageSize };
    }
    const isDone = input.done === true;
    const filter = {
      assigneeId: actorId,
      status: isDone ? { $in: DONE_STATUSES } : "pending",
      ...(input.moduleKey ? { moduleKey: input.moduleKey } : {}),
      ...(input.formKey ? { formKey: input.formKey } : {}),
    };
    const [totalCount, records] = await Promise.all([
      this.tasks.count(tenantId, filter),
      this.tasks.findMany(tenantId, filter, {
        sort: isDone ? { decidedAt: -1, _id: -1 } : { createdAt: -1, _id: -1 },
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    ]);
    return {
      items: await this.presenter.taskModels(records),
      totalCount,
      page,
      pageSize,
    };
  }

  /** 實例詳情:授權同 `canReadSubmissionRevision`(申請人 / 模組讀者 / 任務持有者只看該修訂)。 */
  async instance(
    facts: FormOperatorFacts,
    id: string,
  ): Promise<WorkflowInstanceModel> {
    const instance = await this.engine.findInstance(toObjectId(id, "id"));
    const submission =
      instance === null || facts.tenantId === null
        ? null
        : await this.readAccess.findInTenant(facts, instance.submissionId);
    if (
      instance === null ||
      submission === null ||
      !(await this.readAccess.canReadSubmissionRevision(
        facts,
        submission,
        instance.revision,
      ))
    ) {
      throw workflowNotFoundError(`Instance not found: ${id}`);
    }
    return this.presenter.instanceModel(instance, {
      actorId: facts.operator.actorId,
      canManage: this.formAccess.has(facts, WORKFLOW_REASSIGN_PERMISSION),
    });
  }

  // ---- 內部 ----

  private async boundFormKeys(tenantId: Types.ObjectId): Promise<Set<string>> {
    const links = await this.relations.findMany(tenantId, {
      type: "org_form_workflow",
    });
    if (links.length === 0) {
      return new Set();
    }
    const forms = await this.forms.findMany(systemContext(), {
      _id: { $in: links.map((link) => link.secondId) },
    });
    return new Set(forms.map((form) => form.key));
  }

  private async applicationOf(
    record: SubmissionSnapshotRecord,
  ): Promise<ApplicationItem> {
    const [form, module, instance] = await Promise.all([
      this.forms.findOne(systemContext(), { key: record.formKey }),
      this.modules.findOne(systemContext(), { key: record.moduleKey }),
      record.currentInstanceId === null
        ? null
        : this.engine.findInstance(record.currentInstanceId),
    ]);
    const definition = instance
      ? await this.engine.definitionOf(instance)
      : null;
    return {
      id: String(record._id),
      moduleKey: record.moduleKey,
      moduleName: module?.name ?? null,
      formKey: record.formKey,
      formName: form?.name ?? null,
      status: record.status as FormSubmissionStatusEnum,
      blocked: record.blocked,
      revision: record.revision,
      summary: record.summary
        ? {
            title: record.summary.title,
            date: record.summary.date,
            amount: record.summary.amount ?? null,
          }
        : null,
      currentInstanceId: record.currentInstanceId
        ? String(record.currentInstanceId)
        : null,
      activeSteps:
        instance && definition
          ? instance.activeStepKeys.map((stepKey) => ({
              stepKey,
              name: stepOf(definition, stepKey)?.name ?? stepKey,
            }))
          : [],
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
    };
  }
}
