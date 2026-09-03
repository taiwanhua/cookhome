import path from "node:path";

import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { MongooseModule } from "@nestjs/mongoose";

import { RecipesModule } from "./recipes/recipes.module";

// GraphQL Sandbox 開關:本地開發(NODE_ENV 非 production)預設開;
// 雲端預設關(不讓外人窺探 schema),dev/staging 環境以 GRAPHQL_SANDBOX=true 明確打開
const isSandboxEnabled =
  process.env.GRAPHQL_SANDBOX === "true" ||
  process.env.NODE_ENV !== "production";

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
      introspection: isSandboxEnabled,
      playground: false,
      plugins: isSandboxEnabled
        ? [ApolloServerPluginLandingPageLocalDefault({ embed: true })]
        : [],
    }),
    RecipesModule,
  ],
})
export class AppModule {}
