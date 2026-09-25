import { Injectable } from "@nestjs/common";

import { isValidFormKey } from "@repo/domain/form";
import { isReviewStep } from "@repo/domain/workflow";

import { AuditService } from "../../audit/audit.service";
import { BusinessRelationshipsRepository } from "../../database/business-relationships.repository";
import {
  FormsRepository,
  OrgsRepository,
  WorkflowVersionsRepository,
} from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import {
  type WorkflowRecord,
  WorkflowsRepository,
} from "../../database/workflows.repository";
import {
  type FormOperatorFacts,
  escapeRegex,
  toObjectId,
} from "../../forms/form-access.service";
import { WorkflowAccessService } from "../workflow-access.service";
import { WORKFLOWS_PERMISSIONS } from "../workflow-keys";
import {
  isDuplicateKey,
  workflowForbiddenError,
  workflowNotFoundError,
  workflowValidationError,
} from "../workflows-error";
import {
  type AssignWorkflowToTenantsInput,
  type CreateWorkflowInput,
  DEFAULT_PAGE_SIZE,
  type ForkWorkflowInput,
  MAX_PAGE_SIZE,
  type RevokeWorkflowFromTenantInput,
  type UpdateWorkflowInput,
  type WorkflowsInput,
} from "./dto/workflow-design.input";
import type {
  WorkflowAssignment,
  WorkflowBoundForm,
  WorkflowModel,
  WorkflowsPayload,
} from "./models/workflow.model";
import { WorkflowPublishService } from "./workflow-publish.service";
import { WorkflowVersionsService } from "./workflow-versions.service";

/** 稽核動作名(`docs/modules/workflows.md`「稽核」)。 */
export const WORKFLOW_AUDIT = {
  create: "workflow.create",
  update: "workflow.update",
  fork: "workflow.fork",
  assign: "workflow.assign",
  revoke: "workflow.revoke",
} as const;

const WORKFLOW_TARGET = "workflow";

/** 讀組織只取名稱,不受管理範圍影響。 */
function orgReader(operator: OperatorContext): OperatorContext {
  return { ...operator, visibleOrgIds: "all", managedOrgIds: "all" };
}

function requireName(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw workflowValidationError("name is required", ["name"]);
  }
  return trimmed;
}

/**
 * 流程(設計端,Spec 6b §3、§7):清單、建立、改名、以某版為基底建流程(fork)、分派 / 收回。
 * 站在根組織建的是共用流程;站在租戶內建的是客製流程,**自動建本租戶的 `org_workflow`**。
 */
@Injectable()
export class WorkflowsService {
  constructor(
    private readonly workflows: WorkflowsRepository,
    private readonly versions: WorkflowVersionsRepository,
    private readonly forms: FormsRepository,
    private readonly orgs: OrgsRepository,
    private readonly relations: BusinessRelationshipsRepository,
    private readonly access: WorkflowAccessService,
    private readonly versionsService: WorkflowVersionsService,
    private readonly publisher: WorkflowPublishService,
    private readonly audit: AuditService,
  ) {}

  async list(
    facts: FormOperatorFacts,
    input: WorkflowsInput,
  ): Promise<WorkflowsPayload> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const keyword = input.keyword?.trim().toLowerCase() ?? "";
    const pattern = keyword === "" ? null : new RegExp(escapeRegex(keyword));
    const all = await this.access.listVisible(facts);
    const visible = all
      .filter(
        (workflow) =>
          pattern === null ||
          pattern.test(workflow.key.toLowerCase()) ||
          pattern.test(workflow.name.toLowerCase()),
      )
      .toSorted((left, right) => left.key.localeCompare(right.key));
    const items: WorkflowModel[] = [];
    for (const workflow of visible.slice(
      (page - 1) * pageSize,
      page * pageSize,
    )) {
      items.push(await this.toModel(facts, workflow));
    }
    return { items, totalCount: visible.length, page, pageSize };
  }

  async get(facts: FormOperatorFacts, key: string): Promise<WorkflowModel> {
    return this.toModel(facts, await this.access.requireReadable(facts, key));
  }

  /** 建流程:根組織 → 共用;租戶內 → 客製 + 本租戶 `org_workflow`。 */
  async create(
    facts: FormOperatorFacts,
    input: CreateWorkflowInput,
  ): Promise<WorkflowModel> {
    const key = requireWorkflowKey(input.key);
    const name = requireName(input.name);
    const created = await this.insertWorkflow(facts, key, name, null);
    await this.audit.record(facts.operator, {
      action: WORKFLOW_AUDIT.create,
      targetType: WORKFLOW_TARGET,
      targetId: created._id,
      after: { key, name, isShared: created.tenantId === null },
    });
    return this.toModel(facts, created);
  }

  async update(
    facts: FormOperatorFacts,
    input: UpdateWorkflowInput,
  ): Promise<WorkflowModel> {
    const workflow = await this.access.requireWritable(facts, input.key);
    const name = requireName(input.name);
    if (name === workflow.name) {
      return this.toModel(facts, workflow);
    }
    const updated = await this.workflows.update(
      facts.operator,
      workflow.tenantId,
      { _id: workflow._id },
      { name },
    );
    if (!updated) {
      throw workflowNotFoundError(`Workflow not found: ${input.key}`);
    }
    await this.audit.record(facts.operator, {
      action: WORKFLOW_AUDIT.update,
      targetType: WORKFLOW_TARGET,
      targetId: workflow._id,
      before: { name: workflow.name },
      after: { name },
    });
    return this.toModel(facts, updated);
  }

  /**
   * 以某流程的某一版為基底建新流程 + 一份草稿(節點 `kind` 與 `edges` 原樣複製):
   * 站在根組織 → 共用;站在租戶內 → 客製(`forkedFrom` 記來源,自動 `org_workflow`)。
   * 來源必須讀得到,版本必須已發布或已退役。
   */
  async fork(
    facts: FormOperatorFacts,
    input: ForkWorkflowInput,
  ): Promise<WorkflowModel> {
    const operator = facts.operator;
    const source = await this.access.requireReadable(facts, input.sourceKey);
    const key = requireWorkflowKey(input.key);
    const name = requireName(input.name);
    const definition = await this.versionsService.baseDefinitionOf(
      operator,
      source,
      input.sourceVersion,
    );
    const forkedFrom = {
      workflowKey: source.key,
      version: input.sourceVersion,
    };
    const created = await this.insertWorkflow(facts, key, name, forkedFrom);
    // 草稿寫入失敗時流程已建好:可再開草稿補上,不做補償刪除(同表單的 fork)
    await this.versionsService.insertDraft(operator, key, definition, null);
    await this.audit.record(operator, {
      action: WORKFLOW_AUDIT.fork,
      targetType: WORKFLOW_TARGET,
      targetId: created._id,
      after: { key, name, forkedFrom },
    });
    return this.toModel(facts, created);
  }

  /** root 分派共用流程給租戶(建 `org_workflow`);已分派的略過(冪等)。 */
  async assign(
    facts: FormOperatorFacts,
    input: AssignWorkflowToTenantsInput,
  ): Promise<WorkflowModel> {
    const workflow = await this.requireAssignable(facts, input.workflowKey);
    const added: string[] = [];
    for (const raw of input.tenantOrgIds) {
      const tenantId = await this.relations.tenantIdFor(
        facts.operator,
        toObjectId(raw, "tenantOrgIds"),
      );
      const existing = await this.relations.findOne(tenantId, {
        type: "org_workflow",
        secondId: workflow._id,
      });
      if (existing) {
        continue;
      }
      try {
        await this.relations.create(facts.operator, tenantId, {
          type: "org_workflow",
          firstId: tenantId,
          secondId: workflow._id,
          meta: {},
        });
        added.push(String(tenantId));
      } catch (error) {
        if (!isDuplicateKey(error)) {
          throw error;
        }
      }
    }
    if (added.length > 0) {
      await this.audit.record(facts.operator, {
        action: WORKFLOW_AUDIT.assign,
        targetType: WORKFLOW_TARGET,
        targetId: workflow._id,
        after: { tenantOrgIds: added },
      });
    }
    return this.toModel(facts, workflow);
  }

  /**
   * root 收回分派(刪 `org_workflow`):進行中的實例照常走完;綁著它的表單之後送出會被擋
   * (「審核流程已移除」,Spec §3),綁定本身不刪 —— 列表會顯示「綁定的流程已失效」。
   */
  async revoke(
    facts: FormOperatorFacts,
    input: RevokeWorkflowFromTenantInput,
  ): Promise<WorkflowModel> {
    const workflow = await this.requireAssignable(facts, input.workflowKey);
    const tenantId = await this.relations.tenantIdFor(
      facts.operator,
      toObjectId(input.tenantOrgId, "tenantOrgId"),
    );
    const removed = await this.relations.deleteMany(tenantId, {
      type: "org_workflow",
      secondId: workflow._id,
    });
    if (removed > 0) {
      await this.audit.record(facts.operator, {
        action: WORKFLOW_AUDIT.revoke,
        targetType: WORKFLOW_TARGET,
        targetId: workflow._id,
        before: { tenantOrgId: String(tenantId) },
      });
    }
    return this.toModel(facts, workflow);
  }

  // ---- 內部 ----

  /** 分派 / 收回:站在根組織 + 共用流程。 */
  private async requireAssignable(
    facts: FormOperatorFacts,
    workflowKey: string,
  ): Promise<WorkflowRecord> {
    if (!facts.isRoot) {
      throw workflowForbiddenError(
        "Only the root org can assign workflows",
        "ROOT_ONLY",
      );
    }
    return this.access.requireReadable(facts, workflowKey);
  }

  /** 建流程(共用 / 客製由操作者站在哪裡決定);key 撞名 → `VALIDATION_FAILED`(`key`)。 */
  private async insertWorkflow(
    facts: FormOperatorFacts,
    key: string,
    name: string,
    forkedFrom: { workflowKey: string; version: number } | null,
  ): Promise<WorkflowRecord> {
    const tenantId = facts.isRoot ? null : facts.tenantId;
    if (!facts.isRoot && tenantId === null) {
      throw workflowForbiddenError(
        "Operator is not inside a tenant",
        "NOT_WORKFLOW_OWNER",
      );
    }
    let created: WorkflowRecord;
    try {
      created = await this.workflows.create(facts.operator, tenantId, {
        key,
        name,
        forkedFrom,
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw workflowValidationError(`Workflow key already exists: ${key}`, [
          "key",
        ]);
      }
      throw error;
    }
    if (tenantId !== null) {
      await this.relations.create(facts.operator, tenantId, {
        type: "org_workflow",
        firstId: tenantId,
        secondId: created._id,
        meta: {},
      });
    }
    return created;
  }

  private async toModel(
    facts: FormOperatorFacts,
    workflow: WorkflowRecord,
  ): Promise<WorkflowModel> {
    const operator = facts.operator;
    const [owner, draft, interrupted, current] = await Promise.all([
      workflow.ownerOrgId
        ? this.orgs.findById(orgReader(operator), workflow.ownerOrgId)
        : null,
      this.versions.findOne(operator, {
        workflowKey: workflow.key,
        status: "draft",
      }),
      this.publisher.interruptedOf(operator, workflow),
      workflow.currentVersion === null
        ? null
        : this.versions.findOne(operator, {
            workflowKey: workflow.key,
            version: workflow.currentVersion,
          }),
    ]);
    const canWrite = this.access.canWrite(facts, workflow);
    return {
      id: String(workflow._id),
      key: workflow.key,
      name: workflow.name,
      isShared: workflow.tenantId === null,
      ownerOrgId: workflow.ownerOrgId ? String(workflow.ownerOrgId) : null,
      ownerOrgName: owner?.name ?? null,
      forkedFrom: workflow.forkedFrom,
      currentVersion: workflow.currentVersion,
      hasDraft: draft !== null,
      publishInterrupted: interrupted !== null,
      hasRolePlaceholder:
        current?.steps.some(
          (step) =>
            isReviewStep(step) &&
            step.assignee.kind === "role" &&
            (step.assignee.roleId ?? "") === "",
        ) ?? false,
      assignments:
        facts.isRoot && workflow.tenantId === null
          ? await this.assignmentsOf(operator, workflow)
          : [],
      boundForms: await this.boundFormsOf(facts, workflow),
      abilities: {
        canEdit: canWrite && this.access.has(facts, WORKFLOWS_PERMISSIONS.edit),
        canPublish:
          canWrite && this.access.has(facts, WORKFLOWS_PERMISSIONS.publish),
        canAssign:
          facts.isRoot &&
          workflow.tenantId === null &&
          this.access.has(facts, WORKFLOWS_PERMISSIONS.assign),
        canFork: this.access.has(facts, WORKFLOWS_PERMISSIONS.create),
      },
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  }

  /** root 視角:共用流程分派到哪些租戶(`org_workflow` 以各租戶為邊界各讀一次)。 */
  private async assignmentsOf(
    operator: OperatorContext,
    workflow: WorkflowRecord,
  ): Promise<WorkflowAssignment[]> {
    const tenants = await this.orgs.findMany(orgReader(operator), {
      "ancestors.0": { $exists: true },
      "ancestors.1": { $exists: false },
    });
    const assignments: WorkflowAssignment[] = [];
    for (const tenant of tenants) {
      const link = await this.relations.findOne(tenant._id, {
        type: "org_workflow",
        secondId: workflow._id,
      });
      if (link) {
        assignments.push({
          tenantOrgId: String(tenant._id),
          tenantName: tenant.name,
        });
      }
    }
    return assignments;
  }

  /** 租戶視角:本租戶哪些表單綁了這個流程(反查 `org_form_workflow.thirdId`)。 */
  private async boundFormsOf(
    facts: FormOperatorFacts,
    workflow: WorkflowRecord,
  ): Promise<WorkflowBoundForm[]> {
    if (facts.tenantId === null) {
      return [];
    }
    const links = await this.relations.findMany(facts.tenantId, {
      type: "org_form_workflow",
      thirdId: workflow._id,
    });
    if (links.length === 0) {
      return [];
    }
    const forms = await this.forms.findMany(
      facts.operator,
      { _id: { $in: links.map((link) => link.secondId) } },
      { sort: { key: 1 } },
    );
    return forms.map((form) => ({
      formKey: form.key,
      formName: form.name,
      moduleKey: form.moduleKey,
    }));
  }
}

function requireWorkflowKey(key: string): string {
  if (!isValidFormKey(key)) {
    throw workflowValidationError(`Invalid workflow key: ${key}`, ["key"]);
  }
  return key;
}
