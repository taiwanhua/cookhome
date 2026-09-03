import path from "node:path";

import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { MongooseModule } from "@nestjs/mongoose";

import { RecipesModule } from "./recipes/recipes.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>("MONGODB_URI") ??
          "mongodb://localhost:27017/cookhome",
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: path.join(process.cwd(), "schema.gql"),
      sortSchema: true,
      // 雲端(NODE_ENV=production)也開放 Apollo Sandbox 與 introspection —
      // 目前是學習/staging 性質;正式營運前改為環境變數開關(見 dis.md 待辦)
      introspection: true,
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
    }),
    RecipesModule,
  ],
})
export class AppModule {}
