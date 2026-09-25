import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../../auth/decorators";
import type { OperatorContext } from "../../database/operator-context";
import { RequirePermission } from "../../permission/require-permission.decorator";
import { FormAccessService } from "../form-access.service";
import { FORMS_PERMISSIONS } from "../form-permission-keys";
import {
  AssignFormToTenantsInput,
  CreateFormInput,
  ForkFormInput,
  FormsInput,
  RevokeFormFromTenantInput,
  SetTenantFormEnabledInput,
  UpdateFormInput,
} from "./dto/form-design.input";
import { FormsService } from "./forms.service";
import { FormModel, FormPayload, FormsPayload } from "./models/form.model";

/**
 * 表單管理(`system.forms`)的表單端點(形式 GQL-02 / GQL-03、錯誤 GQL-04 + `docs/modules/forms.md`「錯誤」)。
 * resolver 只做「端點層守門 + 轉呼叫」;「這張表單是不是你的」「是不是站在根組織」在 service。
 */
@Resolver(() => FormModel)
export class FormsResolver {
  constructor(
    private readonly service: FormsService,
    private readonly access: FormAccessService,
  ) {}

  @RequirePermission(FORMS_PERMISSIONS.view)
  @Query(() => FormsPayload, { name: "forms" })
  async forms(
    @Args("input") input: FormsInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormsPayload> {
    return this.service.list(await this.access.factsOf(operator), input);
  }

  @RequirePermission(FORMS_PERMISSIONS.view)
  @Query(() => FormPayload, { name: "form" })
  async form(
    @Args("key", { type: () => ID }) key: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.get(await this.access.factsOf(operator), key),
    };
  }

  @RequirePermission(FORMS_PERMISSIONS.create)
  @Mutation(() => FormPayload)
  async createForm(
    @Args("input") input: CreateFormInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.create(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => FormPayload)
  async updateForm(
    @Args("input") input: UpdateFormInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.update(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(FORMS_PERMISSIONS.create)
  @Mutation(() => FormPayload)
  async forkForm(
    @Args("input") input: ForkFormInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.fork(await this.access.factsOf(operator), input),
    };
  }

  @RequirePermission(FORMS_PERMISSIONS.assign)
  @Mutation(() => FormPayload)
  async assignFormToTenants(
    @Args("input") input: AssignFormToTenantsInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.assign(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(FORMS_PERMISSIONS.assign)
  @Mutation(() => FormPayload)
  async revokeFormFromTenant(
    @Args("input") input: RevokeFormFromTenantInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.revoke(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }

  @RequirePermission(FORMS_PERMISSIONS.setEnabled)
  @Mutation(() => FormPayload)
  async setTenantFormEnabled(
    @Args("input") input: SetTenantFormEnabledInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormPayload> {
    return {
      form: await this.service.setTenantEnabled(
        await this.access.factsOf(operator),
        input,
      ),
    };
  }
}
