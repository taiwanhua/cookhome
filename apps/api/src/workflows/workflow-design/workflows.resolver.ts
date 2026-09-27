import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../../auth/decorators";
import type { OperatorContext } from "../../database/operator-context";
import { FormUserNames } from "../../forms/form-mapper";
import { RequirePermission } from "../../permission/require-permission.decorator";
import { WorkflowAccessService } from "../workflow-access.service";
import { WORKFLOWS_PERMISSIONS } from "../workflow-keys";
import {
  AssignWorkflowToTenantsInput,
  CreateWorkflowInput,
  CreateWorkflowVersionDraftInput,
  ForkWorkflowInput,
  PublishWorkflowVersionInput,
  RevokeWorkflowFromTenantInput,
  SaveWorkflowVersionDraftInput,
  UpdateWorkflowInput,
  ValidateWorkflowVersionInput,
  WorkflowKeyInput,
  WorkflowsInput,
} from "./dto/workflow-design.input";
import {
  WorkflowModel,
  WorkflowPayload,
  WorkflowValidationReport,
  WorkflowVersionPayload,
  WorkflowVersionsPayload,
  WorkflowsPayload,
} from "./models/workflow.model";
import { toWorkflowVersionModel } from "./workflow-mapper";
import { WorkflowPublishService } from "./workflow-publish.service";
import { WorkflowVersionsService } from "./workflow-versions.service";
import { WorkflowsService } from "./workflows.service";

/**
 * 流程管理(`system.workflows`)的設計端點(形式 GQL-02 / GQL-03、錯誤 GQL-04 + `docs/modules/workflows.md`)。
 * resolver 只做「端點層守門 + 轉呼叫」;「這個流程是不是你的」「是不是站在根組織」在 service。
 */
@Resolver(() => WorkflowModel)
export class WorkflowsResolver {
  constructor(
    private readonly service: WorkflowsService,
    private readonly versions: WorkflowVersionsService,
    private readonly publisher: WorkflowPublishService,
    private readonly access: WorkflowAccessService,
    private readonly userNames: FormUserNames,
  ) {}

  @RequirePermission(WORKFLOWS_PERMISSIONS.view)
  @Query(() => WorkflowsPayload, { name: "workflows" })
  async workflows(
    @Args("input") input: WorkflowsInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowsPayload> {
    return this.service.list(await this.access.factsOf(operator), input);
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.view)
  @Query(() => WorkflowPayload, { name: "workflow" })
  async workflow(
    @Args("key", { type: () => ID }) key: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    return {
      workflow: await this.service.get(
        await this.access.factsOf(operator),
        key,
      ),
    };
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.create)
  @Mutation(() => WorkflowPayload)
  async createWorkflow(
    @Args("input") input: CreateWorkflowInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    return {
      workflow: await this.service.create(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.edit)
  @Mutation(() => WorkflowPayload)
  async updateWorkflow(
    @Args("input") input: UpdateWorkflowInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    return {
      workflow: await this.service.update(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.create)
  @Mutation(() => WorkflowPayload)
  async forkWorkflow(
    @Args("input") input: ForkWorkflowInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    return {
      workflow: await this.service.fork(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.assign)
  @Mutation(() => WorkflowPayload)
  async assignWorkflowToTenants(
    @Args("input") input: AssignWorkflowToTenantsInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    return {
      workflow: await this.service.assign(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.assign)
  @Mutation(() => WorkflowPayload)
  async revokeWorkflowFromTenant(
    @Args("input") input: RevokeWorkflowFromTenantInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    return {
      workflow: await this.service.revoke(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  // ---- 版本 ----

  /** 某一版;`version` 省略 = 草稿(附檢查器結果)。 */
  @RequirePermission(WORKFLOWS_PERMISSIONS.view)
  @Query(() => WorkflowVersionPayload, { name: "workflowVersion" })
  async workflowVersion(
    @Args("workflowKey", { type: () => ID }) workflowKey: string,
    @Args("version", { type: () => Int, nullable: true })
    version: number | null,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowVersionPayload> {
    return this.versions.get(
      await this.access.factsOf(operator),
      workflowKey,
      version,
    );
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.view)
  @Query(() => WorkflowVersionsPayload, { name: "workflowVersions" })
  async workflowVersions(
    @Args("workflowKey", { type: () => ID }) workflowKey: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowVersionsPayload> {
    return this.versions.list(await this.access.factsOf(operator), workflowKey);
  }

  /** 設計器即時檢查(不落庫)。 */
  @RequirePermission(WORKFLOWS_PERMISSIONS.view)
  @Query(() => WorkflowValidationReport, { name: "validateWorkflowVersion" })
  async validateWorkflowVersion(
    @Args("input") input: ValidateWorkflowVersionInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowValidationReport> {
    return this.versions.validate(await this.access.factsOf(operator), input);
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.edit)
  @Mutation(() => WorkflowVersionPayload)
  async createWorkflowVersionDraft(
    @Args("input") input: CreateWorkflowVersionDraftInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowVersionPayload> {
    return this.versions.createDraft(
      await this.access.factsOf(operator),
      input,
    );
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.edit)
  @Mutation(() => WorkflowVersionPayload)
  async saveWorkflowVersionDraft(
    @Args("input") input: SaveWorkflowVersionDraftInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowVersionPayload> {
    return this.versions.saveDraft(await this.access.factsOf(operator), input);
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.publish)
  @Mutation(() => WorkflowVersionPayload)
  async publishWorkflowVersion(
    @Args("input") input: PublishWorkflowVersionInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowVersionPayload> {
    const published = await this.publisher.publish(
      await this.access.factsOf(operator),
      input,
    );
    const names = await this.userNames.load(operator, [published.publishedBy]);
    return {
      workflowVersion: toWorkflowVersionModel(published, names),
      validation: null,
    };
  }

  @RequirePermission(WORKFLOWS_PERMISSIONS.publish)
  @Mutation(() => WorkflowVersionPayload)
  async retryPublishWorkflowVersion(
    @Args("input") input: WorkflowKeyInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowVersionPayload> {
    const published = await this.publisher.retry(
      await this.access.factsOf(operator),
      input,
    );
    const names = await this.userNames.load(operator, [published.publishedBy]);
    return {
      workflowVersion: toWorkflowVersionModel(published, names),
      validation: null,
    };
  }

  /** 退役目前版本(`currentVersion → null`):進行中的實例照常走完,只影響新送出。 */
  @RequirePermission(WORKFLOWS_PERMISSIONS.publish)
  @Mutation(() => WorkflowPayload)
  async retireCurrentWorkflowVersion(
    @Args("input") input: WorkflowKeyInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<WorkflowPayload> {
    const facts = await this.access.factsOf(operator);
    const workflow = await this.versions.retireCurrent(facts, input);
    return { workflow: await this.service.get(facts, workflow.key) };
  }
}
