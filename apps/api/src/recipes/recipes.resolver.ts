import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { Public } from "../auth/decorators";
import { CreateRecipeInput } from "./dto/create-recipe.input";
import { Recipe } from "./models/recipe.model";
import { RecipesService } from "./recipes.service";

/** 早期原型、front 的公開查詢(CI 建置 front 時會打):整個 resolver 標 @Public,不改其行為(#62)。 */
@Public()
@Resolver(() => Recipe)
export class RecipesResolver {
  constructor(private readonly recipesService: RecipesService) {}

  @Query(() => [Recipe], { name: "recipes" })
  recipes(): Promise<Recipe[]> {
    return this.recipesService.findAll();
  }

  @Query(() => Recipe, { name: "recipe" })
  recipe(@Args("id", { type: () => ID }) id: string): Promise<Recipe> {
    return this.recipesService.findById(id);
  }

  @Mutation(() => Recipe)
  createRecipe(@Args("input") input: CreateRecipeInput): Promise<Recipe> {
    return this.recipesService.create(input);
  }
}
