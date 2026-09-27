import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../auth/decorators";
import type { OperatorContext } from "../database/operator-context";
import { RequirePermission } from "../permission/require-permission.decorator";
import {
  CreateFieldCategoryInput,
  FieldCategoriesInput,
  SetFieldCategoryEnabledInput,
  UpdateFieldCategoryInput,
} from "./dto/field-category.input";
import { FieldCategoriesService } from "./field-categories.service";
import {
  FieldCategoriesPayload,
  FieldCategoryPayload,
} from "./models/field-payloads.model";
import { FieldCategoryModel } from "./models/field.model";

/** 類別作業(根組織專屬的權限容器;field-manager.md 權限表最後一列)。 */
const MANAGE_CATEGORIES = "system.field-manager.category-ops.manage-categories";

/**
 * 欄位類別的 GraphQL 端點(形式 GQL-02 / GQL-03、錯誤 GQL-04)。
 * resolver 只做「守門 + 轉呼叫」;「站在根組織」與系統類別的保護在 service(STRUCT-01)。
 */
@Resolver(() => FieldCategoryModel)
export class FieldCategoriesResolver {
  constructor(private readonly service: FieldCategoriesService) {}

  @RequirePermission("system.field-manager.view")
  @Query(() => FieldCategoriesPayload, { name: "fieldCategories" })
  fieldCategories(
    @CurrentOperator() operator: OperatorContext,
    @Args("input", { type: () => FieldCategoriesInput, nullable: true })
    input?: FieldCategoriesInput | null,
  ): Promise<FieldCategoriesPayload> {
    return this.service.list(operator, input);
  }

  @RequirePermission(MANAGE_CATEGORIES)
  @Mutation(() => FieldCategoryPayload)
  async createFieldCategory(
    @Args("input") input: CreateFieldCategoryInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FieldCategoryPayload> {
    return { category: await this.service.create(operator, input) };
  }

  @RequirePermission(MANAGE_CATEGORIES)
  @Mutation(() => FieldCategoryPayload)
  async updateFieldCategory(
    @Args("input") input: UpdateFieldCategoryInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FieldCategoryPayload> {
    return { category: await this.service.update(operator, input) };
  }

  @RequirePermission(MANAGE_CATEGORIES)
  @Mutation(() => FieldCategoryPayload)
  async setFieldCategoryEnabled(
    @Args("input") input: SetFieldCategoryEnabledInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FieldCategoryPayload> {
    return { category: await this.service.setEnabled(operator, input) };
  }
}
