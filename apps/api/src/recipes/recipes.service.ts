import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { CreateRecipeInput } from "./dto/create-recipe.input";
import { Recipe, type RecipeDocument } from "./models/recipe.model";

@Injectable()
export class RecipesService {
  constructor(
    @InjectModel(Recipe.name)
    private readonly recipeModel: Model<RecipeDocument>,
  ) {}

  findAll(): Promise<RecipeDocument[]> {
    return this.recipeModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<RecipeDocument> {
    const recipe = await this.recipeModel.findById(id).exec();
    if (!recipe) {
      throw new NotFoundException(`Recipe ${id} not found`);
    }
    return recipe;
  }

  create(input: CreateRecipeInput): Promise<RecipeDocument> {
    return this.recipeModel.create(input);
  }
}
