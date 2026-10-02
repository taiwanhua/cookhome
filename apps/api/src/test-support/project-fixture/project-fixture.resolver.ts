import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../../auth/decorators";
import type { OperatorContext } from "../../database/operator-context";
import { RequirePermission } from "../../permission/require-permission.decorator";
import { ProjectFixtureItemModel } from "./project-fixture-item.model";
import { ProjectFixtureService } from "./project-fixture.service";

/** 測試專案功能的 GraphQL 端點:守門沿用底座的全域 guard 與 `@RequirePermission`。 */
@Resolver(() => ProjectFixtureItemModel)
export class ProjectFixtureResolver {
  constructor(private readonly service: ProjectFixtureService) {}

  @RequirePermission("project-fixture.view")
  @Query(() => [ProjectFixtureItemModel], { name: "projectFixtureItems" })
  projectFixtureItems(
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ProjectFixtureItemModel[]> {
    return this.service.list(operator);
  }

  @RequirePermission("project-fixture.create")
  @Mutation(() => ProjectFixtureItemModel)
  createProjectFixtureItem(
    @Args("name", { type: () => String }) name: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ProjectFixtureItemModel> {
    return this.service.create(operator, name);
  }

  @RequirePermission("project-fixture.delete")
  @Mutation(() => Boolean)
  deleteProjectFixtureItem(
    @Args("id", { type: () => ID }) id: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<boolean> {
    return this.service.remove(operator, id);
  }
}
