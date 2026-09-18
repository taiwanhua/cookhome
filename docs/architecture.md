# CookHome 專案架構

家常食譜分享網站。Turborepo monorepo(pnpm workspace)。
(最後更新:2026-09-04)

## Apps

| App               | 技術                                                             | 用途                                                           | Port |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | ---- |
| `@repo/api`       | NestJS + GraphQL(Apollo/Express, code-first)+ Mongoose + MongoDB | 後端 API,front 與 admin 都打這個服務                           | 5001 |
| `@repo/front`     | Next.js(App Router)                                              | 前台。SEO 頁面走 Server Component + ISR,不使用 Next API Routes | 3002 |
| `@repo/admin`     | Vite + React SPA                                                 | 後台管理,不需 SEO                                              | 3001 |
| `@repo/storybook` | Storybook(react-vite)                                            | 設計系統目錄 + Palette Lab;stories 檔案住在 `packages/ui`      | 6006 |
| `@repo/db-migrator` | migrate-mongo + seed runner                            | 資料庫遷移與種子工具,不部署不常駐;CI 於部署 api 後呼叫(ADR-0002) | — |

workspace 套件名一律 `@repo/` 前綴(規則 GEN-06)。

## Packages

| Package                                                                                            | 用途                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/graphql`                                                                                    | GraphQL codegen 共用套件:讀 `apps/api/schema.gql` + `src/documents/*.graphql`,產生 TypeScript 型別與 TanStack Query hooks(fetcher 為 graphql-request),front/admin 共用 |
| `@repo/ui`                                                                                         | 設計系統:兩層 tokens(`src/theme/`,品牌層 `brands/*.ts` 可整包替換 + 語意層)、`createAppTheme`(MUI cssVariables、light/dark)、共用元件(元件+測試+story 三件套同居)      |
| `@repo/logger`                                                                                     | 共用 logger(全 repo 唯一可用 `console` 的地方,其他地方被 `no-console` 擋)                                                                                              |
| `@repo/i18n`                                                                                       | 多語訊息檔(`messages/<locale>/<namespace>.json`)+ locale 定義;front 以 `next-intl`、admin 以 `use-intl` 消費(同生態);規範見 `standards/general/i18n.md`               |
| `@repo/eslint-config` / `@repo/prettier-config` / `@repo/typescript-config` / `@repo/jest-presets` | 共用開發設定(單一入口,各 app 不自訂規則)                                                                                                                               |

## 品質約束(三層)

1. **機器強制**:ESLint(typescript-eslint strictTypeChecked + import-x + unicorn + sonarjs + jsx-a11y,入口 `@repo/eslint-config`)、TS strict(含 `noUncheckedIndexedAccess`)、Prettier(`@repo/prettier-config`,@trivago import 排序)。`only-warn` + `--max-warnings 0`:編輯器顯示警告,CI/CLI 全擋。
2. **可審查清單**:`docs/standards/`(編號規則 GEN/STRUCT/REACT/DATA/GQL/TEST)+ vercel-labs skills(`.agents/skills/`)。
3. **原則層**:`CLAUDE.md`。

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

## 部署架構(已上線,三環境)

分支 ↔ 環境:`dev` → dev、`staging` → staging(預發布)、`main` → production。

| App   | dev                                    | staging                                   | production                                     |
| ----- | -------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| front | `dev.cookhome.online`(Vercel 分支網域) | `staging.cookhome.online`                 | `www.cookhome.online`(裸網域 308 轉 www)       |
| admin | `erp-dev.cookhome.online`              | `erp-staging.cookhome.online`             | `erp.cookhome.online`(Cloud Run + nginx)       |
| api   | `api-dev.cookhome.online`(Sandbox 開)  | `api-staging.cookhome.online`(Sandbox 關) | `api.cookhome.online`(Cloud Run;Sandbox 關)    |
| DB    | Atlas db `cookhome-dev`                | Atlas db `cookhome-staging`               | Atlas db `cookhome`(M0, asia-east1,同 cluster) |

CI:`ci.yml`(所有 PR + 三分支 push 驗證);CD:`deploy.yml` **一律手動觸發**(Actions UI 或 `gh workflow run`,分支↔環境防呆;front 由 Vercel 於 merge/Deploy Hook 觸發),認證走 Workload Identity Federation 免金鑰。費用:全服務 min=0/max=2 + Budget NT$600 警告。完整操作手冊見 `docs/deployment.md`。

## 本地開發

```bash
docker compose up -d        # 啟動 MongoDB
pnpm install
pnpm dev                    # turbo 同時啟動 api / front / admin / storybook
pnpm --filter @repo/storybook dev   # 只開設計系統(http://localhost:6006)
```

環境變數見各 app 的 `.env.example`(`MONGODB_URI`、`NEXT_PUBLIC_GRAPHQL_ENDPOINT`、`VITE_GRAPHQL_ENDPOINT`)。

## 技術決策記錄

> 這些之後會逐步正式化為 `docs/adr/`(由 `/domain-modeling` 建立)。

- **MongoDB + Mongoose**(`@nestjs/mongoose`):食譜巢狀結構(食材、步驟)適合文件模型;曾評估 Prisma,因其 MongoDB 支援需 replica set 且無 migration 而改用 Mongoose
- **graphql 固定在 v16**:Apollo Server 5 與 @nestjs/graphql 13 尚不支援 graphql 17
- **front 不用 Apollo Client**:SEO 頁面在 Server Component 用 `useXxxQuery.fetcher` 直接抓;瀏覽器端互動用 TanStack Query hooks
- **codegen 已知問題**:`typescript-react-query` plugin 會產生 graphql-request v4 的舊型別路徑,`scripts/fix-generated.mjs` 在 generate 後自動修正
- **程式碼是設計的唯一真實來源**:設計系統先存在於 `@repo/ui`(tokens + MUI theme + 元件),Figma 是它的投影(figma-generate-library 生成、Code Connect 對應);不買現成 Figma kit 或模板
- **設計風格走 Minimal 方向**:以 MUI theme 客製(柔和陰影、大圓角、冷灰階)重現,非購買模板
- **版本統一策略**:同一套件全 repo 同版本(React 19、MUI 9、Vite 8、Storybook 10、TS 5.9);已知例外:`eslint-plugin-unicorn` 釘 65(最後支援 ESLint 9 的版本)
- **apps 只能 import `@repo/ui`,不直接 import `@mui/material`**(lint 規則待補,見待辦)
