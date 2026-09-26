import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../../auth/decorators";
import type { OperatorContext } from "../../database/operator-context";
import { RequirePermission } from "../../permission/require-permission.decorator";
import { FormAccessService } from "../form-access.service";
import { FormUserNames, toFormVersionModel } from "../form-mapper";
import { FORMS_PERMISSIONS } from "../form-permission-keys";
import {
  FormValidationReport,
  FormVersionModel,
  FormVersionPayload,
} from "../models/form-common.model";
import {
  CreateFormVersionDraftInput,
  DeleteFormVersionDraftInput,
  FormKeyInput,
  PreviewFormVersionInput,
  PublishFormVersionInput,
  SaveFormVersionDraftInput,
  ValidateFormVersionInput,
} from "./dto/form-design.input";
import { FormPublishService } from "./form-publish.service";
import { FormVersionsService } from "./form-versions.service";
import { FormsService } from "./forms.service";
import {
  FormPayload,
  FormPreviewPayload,
  FormVersionsPayload,
} from "./models/form.model";

/**
 * 表單版本的端點(設計器、版本面板):讀、草稿、檢查器、預覽、四步發布與重試、退役目前版本。
 */
@Resolver(() => FormVersionModel)
export class FormVersionsResolver {
  constructor(
    private readonly versions: FormVersionsService,
    private readonly publisher: FormPublishService,
    private readonly forms: FormsService,
    private readonly access: FormAccessService,
    private readonly userNames: FormUserNames,
  ) {}

  /** `version` 省略 = 草稿(附檢查器結果)。 */
  @RequirePermission(FORMS_PERMISSIONS.view)
  @Query(() => FormVersionPayload, { name: "formVersion" })
  async formVersion(
    @Args("formKey", { type: () => ID }) formKey: string,
    @Args("version", { type: () => Int, nullable: true })
    version: number | null,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormVersionPayload> {
    return this.versions.get(
      await this.access.factsOf(operator),
      formKey,
      version,
    );
  }

  @RequirePermission(FORMS_PERMISSIONS.view)
  @Query(() => FormVersionsPayload, { name: "formVersions" })
  async formVersions(
    @Args("formKey", { type: () => ID }) formKey: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormVersionsPayload> {
    return this.versions.list(await this.access.factsOf(operator), formKey);
  }

  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormVersionPayload)
  async createFormVersionDraft(
    @Args("input") input: CreateFormVersionDraftInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormVersionPayload> {
    return this.versions.createDraft(
      await this.access.factsOf(operator),
      input,
    );
  }

  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormVersionPayload)
  async saveFormVersionDraft(
    @Args("input") input: SaveFormVersionDraftInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormVersionPayload> {
    return this.versions.saveDraft(await this.access.factsOf(operator), input);
  }

  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormVersionPayload)
  async publishFormVersion(
    @Args("input") input: PublishFormVersionInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormVersionPayload> {
    const record = await this.publisher.publish(
      await this.access.factsOf(operator),
      input,
    );
    const names = await this.userNames.load(operator, [record.publishedBy]);
    return { formVersion: toFormVersionModel(record, names), validation: null };
  }

  /** 發布中斷時,從步驟 3 冪等重跑。 */
  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormVersionPayload)
  async retryPublishFormVersion(
    @Args("input") input: FormKeyInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormVersionPayload> {
    const record = await this.publisher.retry(
      await this.access.factsOf(operator),
      input,
    );
    const names = await this.userNames.load(operator, [record.publishedBy]);
    return { formVersion: toFormVersionModel(record, names), validation: null };
  }

  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormPayload)
  async retireCurrentVersion(
    @Args("input") input: FormKeyInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    const facts = await this.access.factsOf(operator);
    const form = await this.versions.retireCurrent(facts, input);
    return { form: await this.forms.get(facts, form.key) };
  }

  /** 刪除草稿(版本面板「刪除草稿」);發布中不可,`expectedDraftRevision` 不符 → 409。 */
  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormPayload)
  async deleteFormVersionDraft(
    @Args("input") input: DeleteFormVersionDraftInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    const facts = await this.access.factsOf(operator);
    const form = await this.versions.deleteDraft(facts, input);
    return { form: await this.forms.get(facts, form.key) };
  }

  /** 設計器即時檢查,不落庫。 */
  @RequirePermission(FORMS_PERMISSIONS.view)
  @Query(() => FormValidationReport, { name: "validateFormVersion" })
  async validateFormVersion(
    @Args("input") input: ValidateFormVersionInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormValidationReport> {
    return this.versions.validate(await this.access.factsOf(operator), input);
  }

  /** 設計器「預覽」:對草稿跑計算與條件,不建提交。 */
  @RequirePermission(FORMS_PERMISSIONS.view)
  @Query(() => FormPreviewPayload, { name: "previewFormVersion" })
  async previewFormVersion(
    @Args("input") input: PreviewFormVersionInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPreviewPayload> {
    return this.versions.preview(await this.access.factsOf(operator), input);
  }
}
