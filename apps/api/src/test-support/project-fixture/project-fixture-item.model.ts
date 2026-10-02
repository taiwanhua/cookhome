import { Field, ID, ObjectType } from "@nestjs/graphql";

/** 測試專案項目的對外形狀(只存在於測試的記憶體 schema,不進 `schema.gql`)。 */
@ObjectType("ProjectFixtureItem")
export class ProjectFixtureItemModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => ID)
  orgId!: string;
}
