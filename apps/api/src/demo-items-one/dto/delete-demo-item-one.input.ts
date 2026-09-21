import { Field, ID, InputType } from "@nestjs/graphql";

/** 刪除示範項目(軟刪除,ADR-0007;需 `demo.sub.sample-one.delete`)。 */
@InputType()
export class DeleteDemoItemOneInput {
  @Field(() => ID)
  id!: string;
}
