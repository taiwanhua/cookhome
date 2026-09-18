# 專案結構與依賴邊界(STRUCT)

## STRUCT-01 依賴方向單向:apps → packages

- app 之間禁止互相 import(admin 不准 import front 的任何東西)。
- packages 禁止 import apps。
- packages 之間保持最小依賴。循環依賴由 `import-x/no-cycle` 強制擋下。

## STRUCT-02 共用 UI 的歸屬

被兩個以上 app 使用(或明確預期會被共用)的元件 → `@repo/ui`;單一 app 專用的元件留在該 app 內。搬移時機:第二個使用者出現的那個 PR。

## STRUCT-03 app 內用 feature 資料夾切分

參考 bulletproof-react 的架構:

```
apps/<app>/src/
├── features/<feature>/     ← 該功能的元件、hooks、邏輯(例:features/recipes/)
├── components/             ← 跨 feature 共用、但還不到進 @repo/ui 的元件
├── lib/                    ← 跨 feature 的工具(例:graphql client)
└── app/ 或 main.tsx        ← 路由與組裝層,不放業務邏輯
```

feature 之間不互相 import 內部檔案;需要共用就上移到 `components/`、`lib/` 或 packages。

## STRUCT-04 GraphQL 產物只走 `@repo/graphql` 的出口

```ts
✅ import { useRecipesQuery } from "@repo/graphql";
❌ import { useRecipesQuery } from "@repo/graphql/src/generated";
```

`src/generated` 是 codegen 產物(lint 也忽略它),永遠不手改、不深層 import。

## STRUCT-05 ESLint 豁免:檔案第一行、附原因與到期條件

需要豁免某條 lint 規則時,一律寫在**該檔案第一行**的 `/* eslint-disable ... */`,且註解**必附原因與到期條件**;禁止在 ESLint config 以路徑白名單豁免(刪檔後留殭屍設定、讀檔案的人看不見豁免)。

```ts
/* eslint-disable @repo/no-raw-model-query -- deprecated:早期原型,食譜域重寫時整包刪除 */
```

## STRUCT-06 輸出與 log 依執行環境分三種,都不直接 `console.*`

| 環境                         | 用什麼                                          | 為什麼                                                                                 |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| CLI 工具(`apps/db-migrator`) | `process.stdout.write` / `process.stderr.write` | 摘要輸出(新增 N / 更新 M / 未變 K)就是它的介面;tsx 直跑的腳本不該依賴需先 build 的套件 |
| api(NestJS)                  | Nest 內建 `Logger`(`new Logger(ClassName)`)     | 框架自帶等級、前綴與輸出管道,與 Nest 的啟動 log 一致;不另接 `@repo/logger`             |
| front / admin(瀏覽器、Next)  | `@repo/logger`                                  | 全 repo 唯一允許碰 `console` 的地方,集中管理                                           |

`no-console` 一律開著;三種以外的寫法都算違規。

## STRUCT-07 前後端共用的純邏輯放 `@repo/domain`,按主題分資料夾,不一個共用開一個包

前端與後端都要用、而且**沒有框架依賴**的邏輯(密碼規則、權限 key 切分與同層 wildcard 比對、表單驗證規則…)統一放 `packages/domain`,以子路徑匯出、按主題分資料夾:

```
packages/domain/src/password/     → import { validatePassword } from "@repo/domain/password"
packages/domain/src/permission/   → import { ownerModuleKey } from "@repo/domain/permission"
```

入包門檻(三個都要符合):①純函式 / 純型別,不碰 React、Nest、Mongoose ②api 與 admin(或 front)都會用 ③規則只能有一份、兩邊漂移會出事。不符合的留在各自 app;只有一邊用的不進來。

**api 怎麼吃到它**(踩過的坑,一次講清楚):api 是 CommonJS + `moduleResolution: node`,**看不到 `package.json` 的 `exports`**,子路徑的型別要靠 `typesVersions` 指到 `dist/es/<主題>.d.ts`;套件用 bunchee 出雙格式(`dist/es` 給 admin / front,`dist/cjs` 給 api)。api 測試在執行期 `require` 的是 dist,所以根 `turbo.json` 的 `test` 依賴 `^build`(先建依賴套件再跑測試);本地直接跑 `jest` 前要先 `pnpm --filter @repo/domain build`。

## STRUCT-08 新增 workspace 套件的清單

新開 `packages/<name>` 時照這份做,不要拼湊既有套件猜:

1. `package.json`:`"name": "@repo/<name>"`(GEN-06)、`"type": "module"`、`"private": true`、`"files": ["dist"]`;`exports` 一律**子路徑**(`"./<主題>"`)並附 `import` / `require` 兩組 `types` + `default`;同一組子路徑再寫一份 `typesVersions`(給 api 這種 node10 解析用);scripts 固定 `build: bunchee`、`lint`、`check-types`、`test`
2. `tsconfig.json` extends `@repo/typescript-config/base.json`;`eslint.config.js` 只有一行 `export { config as default } from "@repo/eslint-config"`;jest 用 `@repo/jest-presets/node`(純邏輯)或 `browser-esm`(瀏覽器);`turbo.json` 宣告 `build` 輸出 `dist/**`
3. 消費端:api 加 devDependency `workspace:*` 後直接 `import "@repo/<name>/<主題>"`;admin / front 同
4. 登記:`docs/architecture.md` 的 packages 表加一列,寫「誰用、怎麼用」
