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

## STRUCT-06 CLI 工具的輸出走 `process.stdout.write`,不走 `@repo/logger`

`apps/db-migrator` 這類指令列工具,摘要輸出(新增 N / 更新 M / 未變 K)就是它的介面,且 logger 需先 build 才能被 tsx 直跑的腳本使用。規則:CLI 工具用 `process.stdout.write` / `process.stderr.write`;`no-console` 仍禁 `console.*`;server(api)一律 `@repo/logger`。

## STRUCT-07 前後端共用的純邏輯放 `@repo/domain`,按主題分資料夾,不一個共用開一個包

前端與後端都要用、而且**沒有框架依賴**的邏輯(密碼規則、權限 key 切分與同層 wildcard 比對、表單驗證規則…)統一放 `packages/domain`,以子路徑匯出、按主題分資料夾:

```
packages/domain/src/password/     → import { validatePassword } from "@repo/domain/password"
packages/domain/src/permission/   → import { ownerModuleKey } from "@repo/domain/permission"
```

入包門檻(三個都要符合):①純函式 / 純型別,不碰 React、Nest、Mongoose ②api 與 admin(或 front)都會用 ③規則只能有一份、兩邊漂移會出事。不符合的留在各自 app;只有一邊用的不進來。
