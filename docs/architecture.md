# CookHome 專案架構

家常食譜分享網站。Turborepo monorepo(pnpm workspace)。

## Apps

| App | 技術 | 用途 | Port |
|-----|------|------|------|
| `api` | NestJS + GraphQL(Apollo/Express, code-first)+ Mongoose + MongoDB | 後端 API,front 與 admin 都打這個服務 | 5001 |
| `front` | Next.js(App Router) | 前台。SEO 頁面走 Server Component + ISR,不使用 Next API Routes | 3002 |
| `admin` | Vite + React SPA | 後台管理,不需 SEO | 5173 |

## Packages

| Package | 用途 |
|---------|------|
| `@repo/graphql` | GraphQL codegen 共用套件:讀 `apps/api/schema.gql` + `src/documents/*.graphql`,產生 TypeScript 型別與 TanStack Query hooks(fetcher 為 graphql-request),front/admin 共用 |
| `@repo/ui` | 共用 React 元件 |
| `@repo/logger` | 共用 logger |
| `@repo/eslint-config` / `@repo/typescript-config` / `@repo/jest-presets` | 共用開發設定 |

## 資料流

```
瀏覽器 ── front (Next.js SSR/ISR, SEO) ──┐
瀏覽器 ── admin (Vite SPA) ──────────────┤──> api (NestJS GraphQL :5001/graphql) ──> MongoDB (Docker :27017)
        (TanStack Query + graphql-request hooks 來自 @repo/graphql)
```

## 型別打通流程(codegen)

1. `api` 使用 code-first,啟動時自動輸出 `apps/api/schema.gql`
2. `packages/graphql/src/documents/*.graphql` 定義前端要用的 query/mutation
3. `pnpm --filter @repo/graphql generate` 產生 `src/generated/index.ts`(型別 + hooks)
4. front/admin import `@repo/graphql` 取得型別安全的 `useRecipesQuery` 等 hooks

後端 schema 變更後,重跑步驟 3 即可讓前端型別同步。

## 本地開發

```bash
docker compose up -d        # 啟動 MongoDB
pnpm install
pnpm dev                    # turbo 同時啟動 api / front / admin
```

環境變數見各 app 的 `.env.example`(`MONGODB_URI`、`NEXT_PUBLIC_GRAPHQL_ENDPOINT`、`VITE_GRAPHQL_ENDPOINT`)。

## 技術決策記錄

- **MongoDB + Mongoose**(`@nestjs/mongoose`):食譜巢狀結構(食材、步驟)適合文件模型;曾評估 Prisma,因其 MongoDB 支援需 replica set 且無 migration 而改用 Mongoose
- **graphql 固定在 v16**:Apollo Server 5 與 @nestjs/graphql 13 尚不支援 graphql 17
- **front 不用 Apollo Client**:SEO 頁面在 Server Component 用 `useXxxQuery.fetcher` 直接抓;瀏覽器端互動用 TanStack Query hooks
- **codegen 已知問題**:`typescript-react-query` plugin 會產生 graphql-request v4 的舊型別路徑,`scripts/fix-generated.mjs` 在 generate 後自動修正
