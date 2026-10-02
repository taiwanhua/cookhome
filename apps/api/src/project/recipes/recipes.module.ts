import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { RecipesResolver } from "./recipes.resolver";
import { RecipesService } from "./recipes.service";

/** 食譜(早期原型、front 的公開查詢);資料出口由資料登記提供,本模組不自己註冊 model。 */
@Module({
  imports: [DatabaseModule],
  providers: [RecipesService, RecipesResolver],
})
export class RecipesModule {}
