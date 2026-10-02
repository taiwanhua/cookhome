import { Injectable } from "@nestjs/common";

import { AuditService } from "../../audit/audit.service";
import { WorkflowVersionsRepository } from "../../database/database.module";
import type { OperatorContext } from "../../database/operator-context";
import {
  type WorkflowRecord,
  WorkflowsRepository,
} from "../../database/workflows.repository";
import type { FormOperatorFacts } from "../../forms/form-access.service";
import {
  type LifecycleOwner,
  type PublishInternalOptions,
  type RetryPublishInternalOptions,
  type VersionLifecycleConfig,
  type VersionSwitchCheckpoint,
  assertNotPublishing,
  interruptedPublishOf,
  lockDraftForPublish,
  publishExpectationMismatch,
  repositoryVersionStore,
  switchToPublished,
} from "../../versioning/version-lifecycle";
import { WorkflowAccessService } from "../workflow-access.service";
import { definitionOfVersion } from "../workflow-definition-input";
import { WORKFLOWS_PERMISSIONS } from "../workflow-keys";
import {
  workflowConflictError,
  workflowDefinitionInvalidError,
  workflowValidationError,
} from "../workflows-error";
import type {
  PublishWorkflowVersionInput,
  WorkflowKeyInput,
} from "./dto/workflow-design.input";
import { WorkflowDefinitionChecker } from "./workflow-definition-checker";
import type { WorkflowVersionRecord } from "./workflow-mapper";

/** 稽核動作名(`docs/modules/workflows.md`「稽核」)。 */
export const WORKFLOW_VERSION_AUDIT = {
  createDraft: "workflow-version.create-draft",
  saveDraft: "workflow-version.save-draft",
  deleteDraft: "workflow-version.delete-draft",
  publish: "workflow-version.publish",
  retryPublish: "workflow-version.retry-publish",
  retire: "workflow-version.retire",
} as const;

export const WORKFLOW_VERSION_TARGET = "workflow_version";

/**
 * 發布步驟 4 的檢查點(正式環境什麼都不做;測試經 `app.get(WorkflowPublishHooks)` 讓指定檢查點丟錯,
 * 驗「中途失敗後重試 = 一次成功」—— TEST-07 的第二個接縫,理由同 `FormPublishHooks`)。
 */
@Injectable()
export class WorkflowPublishHooks {
  private last: VersionSwitchCheckpoint | null = null;

  /** 最後走到的檢查點(除錯用)。 */
  get lastCheckpoint(): VersionSwitchCheckpoint | null {
    return this.last;
  }

  reached(checkpoint: VersionSwitchCheckpoint): Promise<void> {
    this.last = checkpoint;
    return Promise.resolve();
  }
}

/**
 * 流程版本的四步發布(Spec 6b §4「workflow_versions」:規則照 6a §6,**沒有欄位級權限那一步**)。
 * 骨架與表單共用 `versioning/version-lifecycle.ts`:檢查器 → 搶鎖配版號 → 三筆切換;
 * 任何一步失敗,`retryPublishWorkflowVersion` 從切換那步冪等重跑。
 */
@Injectable()
export class WorkflowPublishService {
  constructor(
    private readonly workflows: WorkflowsRepository,
    private readonly versions: WorkflowVersionsRepository,
    private readonly access: WorkflowAccessService,
    private readonly checker: WorkflowDefinitionChecker,
    private readonly hooks: WorkflowPublishHooks,
    private readonly audit: AuditService,
  ) {}

  lifecycle(
    operator: OperatorContext,
    workflow: WorkflowRecord,
  ): VersionLifecycleConfig<WorkflowVersionRecord> {
    return {
      keyField: "workflowKey",
      versions: repositoryVersionStore(this.versions, operator),
      switchCurrent: async (owner, expected, next) =>
        (await this.workflows.update(
          operator,
          workflow.tenantId,
          { key: owner.key },
          { currentVersion: next },
          { currentVersion: expected },
        )) !== null,
      conflict: (reason, message) => workflowConflictError(message, reason),
      reached: (checkpoint) => this.hooks.reached(checkpoint),
    };
  }

  async interruptedOf(
    operator: OperatorContext,
    workflow: WorkflowRecord,
  ): Promise<WorkflowVersionRecord | null> {
    return interruptedPublishOf(
      this.lifecycle(operator, workflow),
      ownerOf(workflow),
    );
  }

  async assertNotPublishing(
    operator: OperatorContext,
    workflow: WorkflowRecord,
  ): Promise<void> {
    await assertNotPublishing(
      this.lifecycle(operator, workflow),
      ownerOf(workflow),
    );
  }

  /**
   * `internal`:只給內部的受管定義安裝用(`PublishInternalOptions`,同表單)—— 指名草稿、並要求流程與
   * `currentVersion` 還是登記時的樣子;不符在配版號與任何寫入之前就拒絕。
   */
  async publish(
    facts: FormOperatorFacts,
    input: PublishWorkflowVersionInput,
    internal: PublishInternalOptions = {},
  ): Promise<WorkflowVersionRecord> {
    this.access.assertPermission(facts, WORKFLOWS_PERMISSIONS.publish);
    const operator = facts.operator;
    const workflow = await this.access.requireWritable(
      facts,
      input.workflowKey,
    );
    const changelog = input.changelog.trim();
    if (changelog === "") {
      throw workflowValidationError("changelog is required", ["changelog"]);
    }
    const mismatch = publishExpectationMismatch(workflow, internal.expected);
    if (mismatch !== null) {
      throw workflowConflictError(mismatch, "CURRENT_VERSION_CHANGED");
    }
    await this.assertNotPublishing(operator, workflow);
    const draft = await this.versions.findOne(operator, {
      ...(internal.draftId === undefined ? {} : { _id: internal.draftId }),
      workflowKey: workflow.key,
      status: "draft",
    });
    if (!draft) {
      throw workflowConflictError(
        `Workflow ${workflow.key} has no draft`,
        "DRAFT_MISSING",
      );
    }
    if (draft.draftRevision !== input.expectedDraftRevision) {
      throw workflowConflictError(
        `Draft revision mismatch: expected ${String(input.expectedDraftRevision)}, actual ${String(draft.draftRevision)}`,
        "DRAFT_REVISION_MISMATCH",
      );
    }
    // 步驟 1:檢查器(共用流程的 `users` 在這裡擋、客製流程的 `role` 必須指到本租戶角色)
    const report = await this.checker.check(
      facts,
      workflow,
      definitionOfVersion(draft),
      draft.checkFormKey ?? null,
    );
    if (report.errors.length > 0) {
      throw workflowDefinitionInvalidError(
        `Workflow ${workflow.key} draft has ${String(report.errors.length)} definition error(s)`,
        report.errors,
      );
    }
    // 步驟 2:搶鎖並配版號
    const locked = await lockDraftForPublish(
      this.lifecycle(operator, workflow),
      ownerOf(workflow),
      draft._id,
      input.expectedDraftRevision,
      changelog,
    );
    await this.audit.record(operator, {
      action: WORKFLOW_VERSION_AUDIT.publish,
      targetType: WORKFLOW_VERSION_TARGET,
      targetId: locked._id,
      after: {
        workflowKey: workflow.key,
        version: locked.version,
        changelog,
      },
    });
    // 步驟 3(欄位級權限)流程沒有;步驟 4:三筆切換
    return switchToPublished(
      this.lifecycle(operator, workflow),
      ownerOf(workflow),
      locked,
      operator.actorId,
    );
  }

  /**
   * 從切換那步冪等重跑;沒有中斷的發布 → `CONFLICT`(`PUBLISH_NOT_INTERRUPTED`)。
   * `internal.versionId`:只給內部的受管定義安裝用 —— 只接續那一版;此刻中斷的是別的版本同樣回
   * `PUBLISH_NOT_INTERRUPTED`(在稽核與切換之前判斷)。
   */
  async retry(
    facts: FormOperatorFacts,
    input: WorkflowKeyInput,
    internal: RetryPublishInternalOptions = {},
  ): Promise<WorkflowVersionRecord> {
    this.access.assertPermission(facts, WORKFLOWS_PERMISSIONS.publish);
    const operator = facts.operator;
    const workflow = await this.access.requireWritable(
      facts,
      input.workflowKey,
    );
    const interrupted = await this.interruptedOf(operator, workflow);
    if (!interrupted) {
      throw workflowConflictError(
        `Workflow ${workflow.key} has no interrupted publish`,
        "PUBLISH_NOT_INTERRUPTED",
      );
    }
    if (
      internal.versionId !== undefined &&
      !interrupted._id.equals(internal.versionId)
    ) {
      throw workflowConflictError(
        `Workflow ${workflow.key} interrupted publish is version ${String(interrupted.version)}, not the expected one`,
        "PUBLISH_NOT_INTERRUPTED",
      );
    }
    await this.audit.record(operator, {
      action: WORKFLOW_VERSION_AUDIT.retryPublish,
      targetType: WORKFLOW_VERSION_TARGET,
      targetId: interrupted._id,
      after: { workflowKey: workflow.key, version: interrupted.version },
    });
    return switchToPublished(
      this.lifecycle(operator, workflow),
      ownerOf(workflow),
      interrupted,
      operator.actorId,
    );
  }
}

export function ownerOf(workflow: WorkflowRecord): LifecycleOwner {
  return { key: workflow.key, currentVersion: workflow.currentVersion };
}
