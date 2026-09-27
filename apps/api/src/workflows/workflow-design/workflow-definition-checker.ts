import { Injectable } from "@nestjs/common";

import type { FieldDef } from "@repo/domain/form";
import {
  type ValidateWorkflowOptions,
  type WorkflowDefinition,
  type WorkflowValidationReport,
  isReviewStep,
  validateWorkflowDefinition,
} from "@repo/domain/workflow";

import {
  FormVersionsRepository,
  FormsRepository,
} from "../../database/database.module";
import type { WorkflowRecord } from "../../database/workflows.repository";
import type { FormOperatorFacts } from "../../forms/form-access.service";
import { TenantDirectoryService } from "../tenant-directory.service";

/**
 * 流程定義檢查器的 api 端(Spec 6b §5「定義檢查器」):規則正本是 `@repo/domain/workflow` 的
 * `validateWorkflowDefinition`,這裡只把它要的目錄從資料庫組好 ——
 * 共用 / 客製、本租戶的角色與使用者、`field` 來源表單與「檢查用表單」的**目前版本**欄位。
 *
 * 表單目錄的範圍跟著流程走:共用流程只認共用表單;客製流程認共用表單與自己租戶的客製表單
 * (別租戶的客製表單一律當不存在,同 `FormAccessService.isRuntimeVisible`)。
 */
@Injectable()
export class WorkflowDefinitionChecker {
  constructor(
    private readonly forms: FormsRepository,
    private readonly formVersions: FormVersionsRepository,
    private readonly directory: TenantDirectoryService,
  ) {}

  async check(
    facts: FormOperatorFacts,
    workflow: WorkflowRecord,
    definition: WorkflowDefinition,
    checkFormKey?: string | null,
  ): Promise<WorkflowValidationReport> {
    return validateWorkflowDefinition(
      definition,
      await this.optionsOf(facts, workflow, definition, checkFormKey ?? null),
    );
  }

  private async optionsOf(
    facts: FormOperatorFacts,
    workflow: WorkflowRecord,
    definition: WorkflowDefinition,
    checkFormKey: string | null,
  ): Promise<ValidateWorkflowOptions> {
    const tenantId = workflow.tenantId;
    const reviewSteps = definition.steps.filter((step) => isReviewStep(step));
    const formKeys = new Set<string>();
    const userIds: string[] = [];
    for (const step of reviewSteps) {
      if (step.assignee.kind === "field") {
        formKeys.add(step.assignee.formKey);
      } else if (step.assignee.kind === "users") {
        userIds.push(...step.assignee.userIds);
      }
    }
    if (checkFormKey !== null) {
      formKeys.add(checkFormKey);
    }
    const forms = new Map<string, readonly FieldDef[] | null>();
    for (const formKey of formKeys) {
      const fields = await this.currentFieldsOf(facts, workflow, formKey);
      if (fields !== undefined) {
        forms.set(formKey, fields);
      }
    }
    return {
      isShared: tenantId === null,
      ...(tenantId === null
        ? {}
        : {
            tenantRoleIds: await this.directory.tenantRoleIds(tenantId),
            users: await this.directory.userFacts(tenantId, userIds),
          }),
      forms,
      ...(checkFormKey === null
        ? {}
        : { checkFormFields: forms.get(checkFormKey) ?? [] }),
    };
  }

  /** 表單目前版本的欄位;表單不存在(或不在這個流程看得到的範圍)→ undefined;沒有目前版本 → null。 */
  private async currentFieldsOf(
    facts: FormOperatorFacts,
    workflow: WorkflowRecord,
    formKey: string,
  ): Promise<readonly FieldDef[] | null | undefined> {
    const form = await this.forms.findOne(facts.operator, { key: formKey });
    if (form === null) {
      return undefined;
    }
    const isVisible =
      form.ownerOrgId === null ||
      (workflow.tenantId !== null && form.ownerOrgId.equals(workflow.tenantId));
    if (!isVisible) {
      return undefined;
    }
    if (form.currentVersion === null) {
      return null;
    }
    const version = await this.formVersions.findOne(facts.operator, {
      formKey,
      version: form.currentVersion,
    });
    return version?.fields ?? null;
  }
}
