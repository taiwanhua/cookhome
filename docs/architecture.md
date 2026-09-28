# CookHome 專案架構

家常食譜平台,底層是一套可複製到其他專案的多租戶後台底座。Turborepo monorepo(pnpm workspace),workspace 套件名一律 `@repo/` 前綴(GEN-06)。

## Apps

| App                 | 技術                                                              | 用途                                                                                                                                                                    | Port              |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `@repo/api`         | NestJS + GraphQL(Apollo / Express,code-first)+ Mongoose + MongoDB | 後端 API,front 與 admin 都打這個服務                                                                                                                                    | 5001              |
| `@repo/front`       | Next.js(App Router)                                               | 前台。SEO 頁面走 Server Component + ISR,不使用 Next API Routes                                                                                                          | 3002              |
| `@repo/admin`       | Vite + React SPA                                                  | 後台管理,不需 SEO                                                                                                                                                       | 3001              |
| `@repo/storybook`   | Storybook(react-vite)                                             | 設計系統目錄 + Palette Lab;元件的 stories 住在 `packages/ui`                                                                                                            | 6006              |
| `@repo/db-migrator` | migrate-mongo + seed / reset runner                               | 資料庫遷移、種子、還原工具;不部署、不常駐,CI 在部署 api 後呼叫(ADR-0002)                                                                                                | —                 |
| `@repo/e2e`         | Playwright(只裝 chromium)                                         | 權限劇本的 E2E(`docs/testing/permission-scenarios.md`);不部署,**只手動觸發**(`pnpm e2e` / `e2e.yml`,TEST-05);harness 自己起 Mongo → migrate + seed → api → admin 靜態檔 | 5101 / 4301(可改) |

### 技術棧版本

下表只列主版本,確切版本以各 `package.json` 為準。

| 類別     | 套件                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 執行環境 | Node 22(CI / 部署;`engines` 下限 20)、pnpm 10、Turborepo 2、TypeScript 5.9                                                             |
| 後端     | NestJS 11、`@nestjs/graphql` 13、Apollo Server 5、graphql 16、Mongoose 9、migrate-mongo 14                                             |
| 前端     | React 19、MUI 9、Vite 8、Next.js 16、React Router 8、TanStack Query 5、TanStack Table 9、graphql-request 7、`use-intl` / `next-intl` 4 |
| 工具     | Storybook 10、Jest 30、Playwright 1、ESLint 9、Prettier 3、bunchee 6                                                                   |

## Packages

| Package                                                                                            | 用途                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/graphql`                                                                                    | GraphQL codegen 共用套件:讀 `apps/api/schema.gql` + `src/documents/*.graphql`,產生 TypeScript 型別與 TanStack Query hooks(fetcher 為 graphql-request),front / admin 共用                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@repo/ui`                                                                                         | 設計系統:兩層 tokens(`src/theme/`,品牌層 `brands/*.ts` 可整包替換 + 語意層)、`createAppTheme`(MUI cssVariables、light / dark)、共用元件(元件 + 測試 + story 三件套同居),另含模組圖示白名單 `@repo/ui/icons` 與 `@repo/ui/module-icon-picker`。**子路徑清單不在此列舉**,正本是 `packages/ui/package.json` 的 `exports`(STRUCT-08 第 5 點)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@repo/logger`                                                                                     | 共用 logger(全 repo 唯一可用 `console` 的地方,其他地方被 `no-console` 擋)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `@repo/i18n`                                                                                       | 多語訊息檔(`messages/<locale>/<namespace>.json`)+ locale 定義;front 以 `next-intl`、admin 以 `use-intl` 消費(同生態);規範見 `standards/general/i18n.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `@repo/domain`                                                                                     | 前後端共用的純邏輯(STRUCT-07):`@repo/domain/permission`(權限 key 切分、同層 wildcard 比對 `hasPermission`)、`@repo/domain/password`(密碼規則)、`@repo/domain/module-icon`(模組圖示 key 白名單與型別,api / ui 共用同一份常數)、`@repo/domain/form`(表單引擎:欄位定義型別、表單 / 欄位 key 與租戶短碼格式、JSONLogic + decimal 表達式計算器、定義檢查器(ReDoS 檢查由呼叫端注入)、版面換算、摘要計算、受保護依賴鏈、提交值的正規化與規則驗證;依賴 json-logic-js、decimal.js)、`@repo/domain/form-regex-safety`(定義檢查器的 ReDoS 檢查 `recheckRegexSafety`,依賴 recheck;與 `form` 分開是因為 recheck 瀏覽器版約 2.9 MB:`validateDefinition` 的 `regexSafety` 必填、由呼叫端注入,api 直接 import,admin 設計器懶載入)、`@repo/domain/form-keys`(`form/keys` 的輕量出口:表單 key / 欄位 key / 租戶短碼的格式,不依賴外部套件 —— `form` 打成一檔、模組頂層註冊 JSONLogic 並帶進 decimal,只要格式檢查的首屏程式碼(組織管理的租戶短碼)走這裡)、`@repo/domain/workflow`(審核流程引擎:關卡 / 連線 / 實例 / 任務型別、`startStepKey` / `nextStepKeys`、定義檢查器含結構檢查、送出時檢查、`evaluateStep` 與全案終局、任務投影規則、`advance` 判斷表(給實例與任務 → 動作清單,不碰資料庫)、主管解析的純規則;跳過條件沿用 `form` 的表達式計算器);bunchee 雙格式,api 走 cjs + `typesVersions`,admin 走 es。**新增子路徑要補進本列**(STRUCT-08 第 5 點) |
| `@repo/eslint-config` / `@repo/prettier-config` / `@repo/typescript-config` / `@repo/jest-presets` | 共用開發設定(單一入口,各 app 不自訂規則)。jest-presets 三種:`node`(純邏輯 / api)、`browser`(純元件庫 `ui`)、`browser-esm`(admin:jsdom + MSW 需要的 Node 全域 + ts-jest ESM,TEST-08)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 品質約束(三層)

1. **機器強制**:ESLint(typescript-eslint strictTypeChecked + import-x + unicorn + sonarjs + jsx-a11y,入口 `@repo/eslint-config`)、TS strict(含 `noUncheckedIndexedAccess`)、Prettier(`@repo/prettier-config`,@trivago import 排序)。`only-warn` + `--max-warnings 0`:編輯器顯示警告,CI / CLI 全擋。
2. **可審查清單**:`docs/standards/`(編號規則 GEN / STRUCT / REACT / STYLE / DATA / GQL / I18N / TEST / FIGMA)+ vercel-labs skills(`.agents/skills/`)。
3. **原則層**:`CLAUDE.md`。

## 資料流

```
瀏覽器 ── front (Next.js SSR/ISR, SEO) ──┐
瀏覽器 ── admin (Vite SPA) ──────────────┤──> api (NestJS GraphQL :5001/graphql) ──> MongoDB(本地 Docker :27017 / 雲端 Atlas)
        (TanStack Query + graphql-request hooks 來自 @repo/graphql)
```

## 型別打通流程(codegen)

1. `api` 使用 code-first,GraphQLModule 在啟動時輸出 `apps/api/schema.gql`(`NODE_ENV=test` 除外);只重產不開服務用 `pnpm --filter @repo/api schema:generate`
2. `packages/graphql/src/documents/*.graphql` 定義前端要用的 query / mutation
3. `pnpm --filter @repo/graphql generate` 產生 `src/generated/index.ts`(型別 + hooks)
4. front / admin import `@repo/graphql` 取得型別安全的 hooks(如 `useRecipesQuery`)

後端 schema 變更後依序跑步驟 1 與 3,兩份產物同一個 commit(GQL-05;CI 的 `format-codegen` job 會擋)。

## 部署

三環境:`dev` → dev、`staging` → staging(預發布)、`main` → production。api / admin 在 Cloud Run(手動觸發 `deploy.yml`),front 在 Vercel,資料庫是 MongoDB Atlas。網域、資源、CI / CD 與 release 步驟見 `docs/deployment.md`。

## 本地開發

```bash
docker compose up -d        # 啟動 MongoDB
pnpm install
pnpm dev                    # turbo 同時啟動 api / front / admin / storybook
pnpm --filter @repo/storybook dev   # 只開設計系統(http://localhost:6006)
```

環境變數範本在各 app 的 `.env.example`;變數清單與說明見 `docs/env-registry.md`。

## 技術選型

尚未寫成 ADR 的選型與理由(已寫成 ADR 的在 `docs/adr/`):

- **MongoDB + Mongoose**(`@nestjs/mongoose`):食譜巢狀結構(食材、步驟)適合文件模型;Prisma 的 MongoDB 支援需要 replica set 且沒有 migration,所以用 Mongoose。
- **graphql 固定在 v16**:Apollo Server 5 與 `@nestjs/graphql` 13 不支援 graphql 17。
- **front 不用 Apollo Client**:SEO 頁面在 Server Component 用 `useXxxQuery.fetcher` 直接抓;瀏覽器端互動用 TanStack Query hooks。
- **codegen 產物修正**:`typescript-react-query` plugin 會產生 graphql-request v4 的型別路徑,`packages/graphql/scripts/fix-generated.mjs` 在 generate 後自動修正。
- **程式碼是設計的唯一真實來源**:設計系統先存在於 `@repo/ui`(tokens + MUI theme + 元件),Figma 是它的投影(figma-generate-library 生成、Code Connect 對應);不買現成 Figma kit 或模板。
- **設計風格走 Minimal 方向**:以 MUI theme 客製(柔和陰影、大圓角、冷灰階)重現,不購買模板。
- **版本統一**:同一套件全 repo 同一版本(見上面「技術棧版本」);已知例外 `eslint-plugin-unicorn` 釘 65(最後支援 ESLint 9 的版本)。
- **TS 編譯目標統一**:`@repo/typescript-config` 各範本一律 `lib` ES2024、`target` ES2022(執行環境 Node 22 與現代瀏覽器都支援;不用 `ESNext`,因為它隨 TS 版本變動),各 app / package 不自訂這兩項,只補 `DOM` 之類的環境差異。
- **apps 不直接 import MUI / Emotion,一律經 `@repo/ui`**:由 `@repo/eslint-config` 的 `designSystemWall`(`no-restricted-imports`)在 vite / next 設定裡強制(STYLE-05);缺的元件先到 `packages/ui` 包一層。
