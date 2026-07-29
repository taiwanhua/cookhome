import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@ObjectType()
@Schema({ _id: false })
export class Ingredient {
  @Field()
  @Prop({ required: true })
  name!: string;

  @Field()
  @Prop({ required: true })
  amount!: string;
}

export const IngredientSchema = SchemaFactory.createForClass(Ingredient);

@ObjectType()
@Schema({ timestamps: true })
export class Recipe {
  @Field(() => ID)
  id!: string;

  @Field()
  @Prop({ required: true })
  title!: string;

  @Field()
  @Prop({ default: "" })
  description!: string;

  @Field(() => [Ingredient])
  @Prop({ type: [IngredientSchema], default: [] })
  ingredients!: Ingredient[];

  @Field(() => [String])
  @Prop({ type: [String], default: [] })
  steps!: string[];

  @Field(() => Int)
  @Prop({ default: 0 })
  cookMinutes!: number;

  @Field(() => Int)
  @Prop({ default: 1 })
  servings!: number;

  @Field(() => [String])
  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Field({ nullable: true })
  @Prop()
  imageUrl?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export type RecipeDocument = HydratedDocument<Recipe>;
export const RecipeSchema = SchemaFactory.createForClass(Recipe);
