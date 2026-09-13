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
