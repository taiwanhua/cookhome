import { Injectable, NotFoundException } from "@nestjs/common";

import type { RecipeDocument } from "../database/recipe.schema";
import { RecipesLegacyRepository } from "../database/recipes-legacy.repository";
import { CreateRecipeInput } from "./dto/create-recipe.input";

@Injectable()
export class RecipesService {
  constructor(private readonly recipes: RecipesLegacyRepository) {}

  findAll(): Promise<RecipeDocument[]> {
    return this.recipes.findAllNewestFirst();
  }

  async findById(id: string): Promise<RecipeDocument> {
    const recipe = await this.recipes.findById(id);
    if (!recipe) {
      throw new NotFoundException(`Recipe ${id} not found`);
    }
    return recipe;
  }

  create(input: CreateRecipeInput): Promise<RecipeDocument> {
    return this.recipes.create(input);
  }
}
