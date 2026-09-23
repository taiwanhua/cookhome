# 專案結構與依賴邊界(STRUCT)

## STRUCT-01 依賴方向單向:apps → packages

- app 之間禁止互相 import(admin 不准 import front 的任何東西)。
- packages 禁止 import apps。
- packages 之間保持最小依賴。循環依賴由 `import-x/no-cycle` 強制擋下。

## STRUCT-02 共用 UI 的歸屬

被兩個以上 app 使用(或明確預期會被共用)的元件 → `@repo/ui`;單一 app 專用的元件留在該 app 內。搬移時機:第二個使用者出現的那個 PR。

## STRUCT-03 app 內分層:`app / pages / components / hooks / stores / lib / test`,import 只能往下

(2026-09-19 改,ADR-0012,取代原本的 `features/` 分法;lint:`@repo/eslint-config/frontend-style` 的 `import-x/no-restricted-paths`)

```
apps/<app>/src/
├── app/          組裝層:main.tsx、routes.tsx、providers/、guards/(RequireAuth、ModuleRoute、ForbiddenPage)、
│                 AdminShell/(AppBar / SideNav / RouteTabs 版面)、module-pages.tsx。不含業務內容
├── pages/        路由進入點,一個路由一個資料夾,樹照側欄(= 路由路徑)長:
│                 auth/LoginPage/、OverviewPage/、system/OrgManagerPage/ …;只有這頁用的元件放在頁底下
├── components/   兩個以上頁面共用、但還不到進 @repo/ui 的元件
├── hooks/        跨頁 hook(useMe、useSession)
├── stores/       zustand store(useXxxStore.ts)
├── lib/          純工具、client、paths(不含 React)
└── test/         MSW、renderApp 等測試支援
```

- **import 方向只能往下**:`app → pages → components → hooks / stores → lib`;下層不准 import 上層,同層的頁面之間不准互相 import(要共用就往上提到 `components/` 或 `hooks/`)。
- **元件放在唯一使用它的那層**:只有一頁用 → 該頁資料夾底下;兩頁以上用 → `components/`;兩個 app 用 → `@repo/ui`(STRUCT-02)。殼(AdminShell)只被 `routes.tsx` 用,所以住 `app/`。
- **頁面一律資料夾**(路由 = 資料夾,`OverviewPage/OverviewPage.tsx`),即使目前只有一個檔;非頁面的單檔元件不開資料夾(GEN-01)。
- **路由群組資料夾可放該群組共用的元件**:`pages/auth/AuthCard.tsx` 給四個登入線頁面用、之後 `pages/system/` 也可以放治理模組共用的東西;跨群組才上提到 `components/`。「同層頁面不互相 import」指的是頁面資料夾之間(`LoginPage/` 不 import `SetPasswordPage/` 的檔)。
- **非 React 程式碼要碰 store**(如 `lib/auth/auth-fetch.ts` 要讀 access token、失效時 `clear()`):lib 不准 import `stores/`,改由 app 層把 store 實例注入(`createAuthSession(endpoint, useSessionStore)`),lib 只認 zustand 的 `StoreApi<T>` 介面(型別放 `lib/`)。#116 的做法就是這樣。
- **跨路由群組要共用就上提到 `components/`**,不要複製一份:`pages/auth/NewPasswordFields/` 的密碼欄位被 `pages/system/` 的新增使用者彈窗需要時,正確做法是搬到 `components/NewPasswordFields/`(#139 當時複製了一份單欄位版,兩份「密碼規則提示」現在要合併,待重構票)。
- **`pages/` 為什麼取代 `features/`**:admin 的業務單位是模組(側欄每一項),「一個頁面 = 一個模組」已是產品定義(ADR-0004),不需要再一層沒定義的 feature。

其他包的對應:`packages/ui` 沒有分層,`src/<Component>/<Component>.tsx` 平鋪(`theme/`、`icons/` 維持);`apps/front` 的 `app/` 是 Next.js 路由目錄(框架例外),其餘 `components / hooks / lib` 同上。front 沒有 `pages/` 層,**單一路由專用的元件放 `components/<RouteView>/`**(如 `components/HomeView/HomeView.tsx` + 它的子元件),路由檔 `app/**/page.tsx` 只剩組裝;兩個路由共用的才是一般的 `components/`。

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

**已知會誤判、豁免時照抄理由的規則**(碰到就在該行寫 `// eslint-disable-next-line`,別為了閃它改寫程式):

- `unicorn/no-array-callback-reference` 對 **mongodb driver 的 `collection.find(filter)`** 會誤判(2026-09-23,#364):規則假設 `find` 是 `Array.prototype.find`、傳進去的是 callback,而 driver 的 `find` 收的是查詢條件物件。`apps/db-migrator` 的 reset 直接操作 driver,整支都會踩到。理由寫「mongodb driver 的 `find` 收的是 filter 不是 callback」。

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

**同一個主題長到第二個檔時,`index.ts` 只當出口,實作檔不可回指 index**(2026-09-20,#202):
`permission/` 從一個檔變成 `keys.ts` + `matrix.ts` 時,`matrix.ts` 要用 key 工具、`index.ts` 又要
re-export `matrix.ts`,若 `matrix.ts` 寫 `from "./index"` 就是 `import-x/no-cycle`。規則:
實作檔之間**互相直接引用檔名**(`from "./keys"`),`index.ts` 只有 `export * from "./…"` 幾行。
這樣拆檔不動對外 API,**子路徑與 `package.json` 都不必改**。

**api 怎麼吃到它**(踩過的坑,一次講清楚):api 是 CommonJS + `moduleResolution: node`,**看不到 `package.json` 的 `exports`**,子路徑的型別要靠 `typesVersions` 指到 `dist/es/<主題>.d.ts`;套件用 bunchee 出雙格式(`dist/es` 給 admin / front,`dist/cjs` 給 api)。api 測試在執行期 `require` 的是 dist,所以根 `turbo.json` 的 `test` 依賴 `^build`(先建依賴套件再跑測試);本地直接跑 `jest` 前要先 `pnpm --filter @repo/domain build`。

## STRUCT-08 新增 workspace 套件的清單

新開 `packages/<name>` 時照這份做,不要拼湊既有套件猜:

1. `package.json`:`"name": "@repo/<name>"`(GEN-06)、`"type": "module"`、`"private": true`、`"files": ["dist"]`;`exports` 一律**子路徑**(`"./<主題>"`)並附 `import` / `require` 兩組 `types` + `default`;同一組子路徑再寫一份 `typesVersions`(給 api 這種 node10 解析用);scripts 固定 `build: bunchee`、`lint`、`check-types`、`test`
2. `tsconfig.json` extends `@repo/typescript-config/base.json`;`eslint.config.js` 只有一行 `export { config as default } from "@repo/eslint-config"`;jest 用 `@repo/jest-presets/node`(純邏輯)或 `browser-esm`(瀏覽器);`turbo.json` 宣告 `build` 輸出 `dist/**`
3. 消費端:api 加 devDependency `workspace:*` 後直接 `import "@repo/<name>/<主題>"`;admin / front 同
4. 登記:`docs/architecture.md` 的 packages 表加一列,寫「誰用、怎麼用」

**既有套件新增一個子路徑匯出(最常見:往 `@repo/ui` 加一個元件)要動五處**
(2026-09-20,#197 / #207;第 5 點 2026-09-22 補,#292):

1. 元件三件套:`src/<元件>/<元件>.tsx` + `<元件>.test.tsx` + story(GEN-01 / TEST-09)
2. `src/<主題>.ts` 出口檔(對外 API 的那一行 `export`)
3. `package.json` 的 `exports`;**被 api 消費的套件(目前只有 `@repo/domain`)再加一份同名的 `typesVersions`** — 它只為 api 那種 node10 / CommonJS 解析服務。`@repo/ui` **免除**(只被 admin / front 以 bundler 解析消費,`package.json` 裡本來就沒有 `typesVersions`,不要為了對稱補上)
4. `package.json` 的 `dependencies`(包了新的外部庫時)+ 用到新版外部庫時先 `npm view <pkg> version` 查最新
5. 登記 `docs/architecture.md` 的 packages 表:**`@repo/domain` 那列逐一列出子路徑,新增時要補上**;`@repo/ui` 那列**不列舉**子路徑(三十餘個,正本是 `package.json` 的 `exports`),只維持用途概述

漏第 3 點的症狀是「本地 import 得到、`check-types` 在別的包紅」;漏第 5 點的症狀是 architecture.md 的子路徑列悄悄過期(`@repo/domain/module-icon` 就漏了一輪)。

### 新增一個 app workspace(`apps/<name>`)的清單(2026-09-23,#378 開 `apps/e2e` 時整理)

app 與 package 不同:它不出 `dist` 給別人 import,但**會被 turbo 排程、被 CI 掃到、被 lint 與 prettier 管**。照這份做:

1. `package.json`:`"name": "@repo/<name>"`、`"private": true`;scripts 至少 `lint`、`check-types`,有測試再加 `test`。**不要**宣告 `files` / `exports`(沒人 import 它)
2. `tsconfig.json` extends `@repo/typescript-config/` 底下對應的那一份
3. **eslint 設定檔的副檔名先看自己 `package.json` 有沒有 `"type": "module"`,不要照抄鄰居**:沒有(目前只有 `apps/api`)就**必須**寫 `eslint.config.mjs`,否則 node 會把它當 CommonJS 載入而炸;有就兩種都載得起來。現況是 `apps/admin` / `apps/front` 用 `.js`、`apps/api` / `apps/db-migrator` / `apps/e2e` 用 `.mjs`(後兩者其實有 `"type": "module"`,`.mjs` 只是沿用 api 的寫法)。**這個不一致是歷史的,不是 bug**,不要為了對齊去改既有的檔;新 app 挑一種、與性質最近的那個 app 一致即可
4. `turbo.json`(`extends: ["//"]`)宣告自己的 `build` 輸出;**build 時烘進產物的環境變數一定要登記進 `env`**,見下一條
5. 登記:`docs/architecture.md`、`docs/env-registry.md`(新變數)、CI 的 job 清單(如果它要進 `ci.yml`)

### build 時烘進產物的變數要登記進該 package 的 turbo `env`(2026-09-23,#378)

`VITE_*` / `NEXT_PUBLIC_*` 這類變數會被**編譯進產物**,所以它們是 build 的**輸入**。沒登記進該 package `turbo.json` 的 `tasks.build.env`,turbo 的 build 快取就不含它 —— **換一個值重 build 會直接 `cache hit`,拿到烘著舊值的產物**,而且沒有任何一步會失敗。

```jsonc
// apps/admin/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": { "env": ["VITE_GRAPHQL_ENDPOINT"], "outputs": ["dist/**"] },
  },
}
```

admin 的 `VITE_GRAPHQL_ENDPOINT` 原本就漏登記過(admin 每個環境各建一顆 image,正是最容易吃到這個坑的形狀)。新增這類變數時三處一起動:該 package 的 `turbo.json` 的 `env`、`docs/env-registry.md`、該環境的 build 參數(`deploy/env/<環境>.yaml` 或 deploy.yml 的 `--build-arg`,見 `docs/deployment.md`)。**執行期才讀的變數不在此列**(api 的那些),它們不影響產物。

## STRUCT-09 全 repo 都走 prettier,CI 守門:表格與 import 由它排版,不手排

全 repo 的 `.md` 與 `.ts` / `.tsx` / `.js`(含 `.mjs` / `.cjs`)/ `.json` / `.yaml` 都受 CI 的 `prettier --check` 檢查(`pnpm run format:check`,與 `pnpm format` 同一組副檔名、同一套設定;md 自 2026-09-19、其餘自 #195 於 2026-09-22 起)。`ci.yml` 與 `docs.yml` 都跑同一個腳本,排除清單的正本是 `.prettierignore`(`pnpm-lock.yaml`、`dist` / `build` / `.next` / `coverage` 等產物、`**/src/generated`、`.agents` 的 skill 正本、Claude Code 的本機目錄)。

- **交件前跑一次 `pnpm format`**,未格式化的檔案 CI 會擋下來;`.ts` 的 import 排序由 `@trivago` 外掛統一處理,不要手排。
- 表格的分隔列與欄寬對齊一律交給 prettier:寫完跑 `pnpm format`,不要手動對齊、也不要為了省寬度刻意寫緊湊式 `|---|---|`(prettier 會展開,產生與內容無關的大 diff)。

只有兩種例外,都要附原因:

1. **清單編號是跨文件引用的穩定 ID**(如 `docs/tmp/dis.md` 二.B / 二.C 以「dis.md #27」被 ADR 指路)— prettier 會把非連續編號重排成連號,在該清單前一行放 `<!-- prettier-ignore -->`。
2. **不歸我們管的內容** — 外部安裝、由 `skills-lock.json` 以 hash 校驗的 `.agents/`,以及 Claude Code 的本機目錄,整目錄列在 `.prettierignore`。

**擴大檢查範圍(加副檔名)時,會冒出兩類「本來看不到」的檔案**(2026-09-22,#195 / #194):

1. **被 global gitignore 擋住、但 prettier 看得到的本機檔** —— prettier **不讀 `.gitignore`**,所以 `.claude/settings.local.json` 這種「不入版控卻真實存在於工作目錄」的檔會讓本機 `format:check` 紅、CI 卻綠(CI 的 checkout 沒有那個檔),很難自己想通。擴 glob 後在自己機器上跑一次 `pnpm run format:check`,冒出來的本機檔案加進 `.prettierignore`。
2. **外部工具產生、由上游決定長相的檔** —— `msw init` 產的 `apps/admin/mock-public/mockServiceWorker.js` 不合我們的 prettier 設定,重排會與 msw 上游漂移(下次 `msw init` 又被改回去)。這類檔案一律進 `.prettierignore` 並註明來源,不要手動改格式。

順帶:字面星號(例如 wildcard 權限「全部(\*)」)要寫成 `\*`,否則成對的 `*` 會被當成強調符號,prettier 會把它改寫成 `_` 讓問題浮現。

## STRUCT-10 `localeCompare` 一律明給 `zh-Hant`(2026-09-23,#372)

全 repo(api、admin、db-migrator 都算)排字串一律寫 `a.localeCompare(b, "zh-Hant")`,**不留給執行環境決定**。

```ts
✅ rows.toSorted((a, b) => a.name.localeCompare(b.name, COLLATION_LOCALE)); // const COLLATION_LOCALE = "zh-Hant"
❌ rows.toSorted((a, b) => a.name.localeCompare(b.name));
```

不給語言時 `localeCompare` 吃的是執行環境的預設語言:開發機通常是 `zh-TW`、**CI runner 通常退回 `en-US`**,中文字的先後跟著不一樣 —— 排序斷言於是「本機綠、CI 紅」,而且看起來像偶發。先例與理由註解在 `apps/admin/src/lib/role-options.ts`(`COLLATION_LOCALE`)。同一支檔案裡排多處時抽成模組層常數,不要逐處重打字串。
