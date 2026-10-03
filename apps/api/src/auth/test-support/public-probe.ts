import { Module } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";

import { Public } from "../decorators";

/**
 * 測試專用探針(不進 build:tsconfig.build.json 排除 test-support):
 * 公開存取的守門行為靠這支標了 `@Public()` 的 query 經真 AuthGuard 與 GraphQL 驗證,
 * 不借用任何專案功能的公開端點。只在測試的 `extraModules` 掛上,不進提交的 `schema.gql`。
 */
@Resolver()
export class PublicProbeResolver {
  @Public()
  @Query(() => Boolean, { name: "publicProbe" })
  probe(): boolean {
    return true;
  }
}

@Module({ providers: [PublicProbeResolver] })
export class PublicProbeModule {}
