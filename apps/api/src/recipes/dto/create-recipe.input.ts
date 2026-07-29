import { Field, InputType, Int } from "@nestjs/graphql";

@InputType()
export class IngredientInput {
  @Field()
  name!: string;

  @Field()
  amount!: string;
}

@InputType()
export class CreateRecipeInput {
  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [IngredientInput], { nullable: true })
  ingredients?: IngredientInput[];

  @Field(() => [String], { nullable: true })
  steps?: string[];

  @Field(() => Int, { nullable: true })
  cookMinutes?: number;

  @Field(() => Int, { nullable: true })
  servings?: number;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  imageUrl?: string;
}
