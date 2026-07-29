import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { Recipe, RecipeSchema } from "./models/recipe.model";
import { RecipesResolver } from "./recipes.resolver";
import { RecipesService } from "./recipes.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Recipe.name, schema: RecipeSchema }]),
  ],
  providers: [RecipesService, RecipesResolver],
})
export class RecipesModule {}
