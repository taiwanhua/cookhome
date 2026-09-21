import { Field, ID, InputType } from "@nestjs/graphql";

/** 刪除示範項目(權限 `demo.sample-two.delete`);軟刪除,資料仍留著(ADR-0007)。 */
@InputType()
export class DeleteDemoItemTwoInput {
  @Field(() => ID)
  id!: string;
}
