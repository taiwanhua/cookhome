# 前端架構(現況說明)

回答「admin 的程式怎麼分層、殼長什麼樣、頁面怎麼接上權限與資料」。決策理由見 ADR-0012(程式碼風格與分層)與 ADR-0011(路由與判斷)。條文在 `docs/standards/`(GEN-01、STRUCT-03、REACT-01 / 02 / 07、DATA-01 起)。

## 程式碼風格(admin / front / ui 同一套)

| 項目           | 規則                                                          |
| -------------- | ------------------------------------------------------------- |
| 跨元件狀態     | zustand(`stores/`);context 只做注入(theme、QueryClient、Intl) |
| 伺服器資料     | 只走 TanStack Query(`@repo/graphql` 的 codegen hooks)         |
| URL 表達得了的 | 放 URL(admin 例外見 REACT-02)                                 |
| 檔名           | 元件 `PascalCase.tsx`、hook `useXxx.ts`、其餘 kebab-case      |
| 一檔一元件     | 有子元件才開同名資料夾;不用 `index.ts` barrel                 |
| 寫法           | 箭頭函數;props 用 `export interface XxxProps`                 |
| 檔案大小       | 目標 300 行,lint 上限 400                                     |

- lint 規則集中在 `@repo/eslint-config/frontend-style`。
- 框架強制的例外:Next.js `app/` 路由檔、ui 的 story 三件套。

正本:`docs/standards/general/naming.md` GEN-01、`docs/standards/react/components.md`、`packages/config-eslint/frontend-style.js`

## admin 的分層

```
app/        組裝層:路由、守門、殼、providers(不含業務內容)
pages/      一個頁面 = 一個模組;目錄照側欄樹長
components/ 跨頁共用元件
hooks/      跨頁共用 hook
stores/     zustand store
lib/        純函式與基礎設施(auth、module-tree、route-tabs…)
test/       測試支援
```

- import 只能往下。
- 殼(`AdminShell`)不是頁面,住 `app/`。

正本:`apps/admin/src/`、`docs/standards/general/structure.md` STRUCT-03

## 殼

| 區塊      | 做什麼                                                                                                           | 程式                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SideNav   | `me.modules` 以 `parentId` 組樹;`group` 可展開、`link` 可點、`hidden` 不顯示;可收成 64px 圖示列(存 localStorage) | `app/AdminShell/SideNav/`、`stores/useSideNavStore.ts`     |
| AppBar    | 組織切換器(改當前組織)、語系切換、「?」模組說明、使用者選單                                                      | `app/AdminShell/AppBar/`                                   |
| RouteTabs | 開過的路由各一個頁籤;可關閉、可拖曳排序、鍵盤可操作                                                              | `app/AdminShell/RouteTabs/`、`stores/useRouteTabsStore.ts` |
| 側欄商標  | 當前組織的商標,沒有就繼承上層                                                                                    | `me.currentOrg.logoUrl`                                    |

- 「?」說明的內容是 `apps/admin/src/md/module-help/<key>.help.md`,build 時打包;彈窗動態載入。
- 殼的設計稿節點登記在 `docs/branding.md`。

正本:`apps/admin/src/app/AdminShell/`、`apps/admin/src/lib/module-tree.ts` 的 `buildNavTree`

## 守門與路由

```
/login、/forgot-password、/set-password      公開
/change-password                             RequireAuth
/ 與其餘路徑                                  RequireAuth → AdminShell → ModuleRoute
```

- `RequireAuth`:未登入回登入頁;`me.mustChangePassword` 導去改密碼頁。
- `ModuleRoute`:把網址對上 `me.modules`,決定顯示哪一頁。
- 模組 key → 頁面元件登記在 `app/module-pages.tsx`;沒登記的模組顯示佔位頁。

正本:`apps/admin/src/app/routes.tsx`、`apps/admin/src/app/guards/`、`apps/admin/src/app/module-pages.tsx`

## 路由與導向

可進入路由集合 = `me.modules` 中有 route 的 `link` 與 `hidden` 模組。可進 = 有那個模組路由,僅此一條。

| 網址                   | 行為                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| 模組路由               | 顯示該模組頁面                                                                             |
| 群組路由(如 `/system`) | 轉到該群組下側欄順序深度優先第一個 `link`;沒有 → 無權限頁                                  |
| `/`                    | 整棵側欄樹第一個 `link`(有總覽權限即 `/overview`);沒有 → 無權限頁                          |
| 隱藏頁路由 + 尾端一段  | 如 `/…/edit-page/<id>`:去掉最後一段後對上 `hidden` 模組才放行,那段以 `routeParam` 傳給頁面 |
| 其餘                   | 無權限頁(明示是權限問題)                                                                   |

- 尾端一段的退路只給 `hidden`;`link` 後面多一段就是打錯網址。
- 群組路由與 `/` 是同一個函式 `firstLinkRoute`,只差起點。
- 「總覽」是正式模組(`overview`),由角色授權。

正本:`apps/admin/src/lib/module-tree.ts` 的 `enterableRouteMap` / `matchModuleRoute` / `firstLinkRoute`、`docs/testing/permission-scenarios.md` 劇本 7 / 13

## 頁籤兩種

判準:它是不是一個網址。

| 種類     | 是什麼                             | 規則                                                                                             |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| 路由頁籤 | 殼的 `RouteTabs`;一個網址一個      | 與路由防守同一個比對;以完整網址去重;關閉切相鄰;sessionStorage 以使用者分 key 保留;進不去的被剔除 |
| 頁內頁籤 | `@repo/ui/tabs`;同一網址內切換區塊 | 不是路由、不進頁籤列、狀態不進 URL                                                               |

- 帶識別碼的詳情 / 編輯頁是**詳情子頁籤**:每筆一個,標籤「所屬模組名 — 項目名」。項目名由頁面拿到資料後經 `useRouteTabItemLabel` 提供,殼不查業務資料。
- 要能分享、重整回得來、出現在頁籤列 → 做成(隱藏頁)路由。只是同一筆資料的不同面向 → 頁內頁籤。

正本:`apps/admin/src/lib/route-tabs.ts`、`apps/admin/src/app/AdminShell/RouteTabs/useRouteTabs.ts`、`apps/admin/src/hooks/useRouteTabItemLabel.ts`

## 頁內權限判斷

- `usePermissions().hasPermission(key)`:`me.modules` 的 permissions 組成集合,判斷規則來自 `@repo/domain/permission`。
- 業務模組的 `item.abilities` 直接讀,不與 `usePermissions` 相乘;治理模組的 `Role.abilities` 要相乘。見 `docs/concepts/authorization.md`「abilities 的兩種語意」。

正本:`apps/admin/src/hooks/usePermissions.ts`、`packages/domain/src/permission/keys.ts`

## 共版型(CRUD 模組的前端藍本)

一個 CRUD 模組 = 一份 `DemoModuleConfig`。列表、詳情、表單三頁是共用元件,不用改。

| 誰負責   | 內容                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| 共用元件 | 版型、兩層權限判斷、分頁、未儲存離開、刪除確認、錯誤擺放                               |
| 設定物件 | 模組 key、權限 key、欄位定義、`useRows` / `useItem` / `useSave` 三個 hook、slot 與開關 |

- 共用元件不認得任何模組的 GraphQL 型別。
- 兩個實例:`SampleOneModule.tsx`(全選配)、`SampleTwoModule.tsx`(最小可行)。
- 新增模組的完整步驟見 `docs/agents/module-scaffold.md`。

正本:`apps/admin/src/pages/demo/shared/demo-module-config.ts`、`apps/admin/src/pages/demo/shared/`

## 操作結果提示(Snackbar)

- 每支 mutation 都經 `useMutationFeedback`:成功或失敗各跳一則。
- 狀態在 `stores/useSnackbarStore`;`AppProviders` 裡的 `SnackbarProvider` 是全站唯一出口。
- 長度 1 的佇列:只顯示最新一則,舊的直接被取代。
- 一次操作只跳一則;多步流程自己在最後呼叫一次。
- 成功文案 key:`<ns>.feedback.<action>Success`。失敗文案用該頁的錯誤解讀(回 `AdminError`)。
- 彈窗開著時 Snackbar 被 `aria-hidden`,由 `SnackbarAnnouncer` 以 `role="status"` 補念。

正本:`apps/admin/src/hooks/useMutationFeedback.ts`、`apps/admin/src/app/providers/SnackbarProvider.tsx`、`apps/admin/src/lib/errors.ts`、`docs/standards/react/data-fetching.md` DATA-06

## 快取規則

| 資料           | 規則                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| `me`           | `staleTime: Infinity`、`retryOnMount: false`;要更新一律主動 invalidate       |
| 模組陣列與權限 | 在 `me` 裡;角色或授權異動後,自己的改動主動失效 `me`,別人的改動重新整理才看到 |
| mutation 之後  | 先用回傳 payload `setQueryData`,再精準 invalidate 清單與單筆                 |
| query key      | 一律用 codegen 的 `getKey`,不自創字串                                        |

- 禁止整站 refetch 或重新整理頁面來同步資料。
- 登出或換人:清 react-query 快取(見 `docs/concepts/accounts-and-tenants.md`「多分頁」)。

正本:`apps/admin/src/hooks/useMe.ts`、`docs/standards/react/data-fetching.md` DATA-02 / DATA-04

## 其他 zustand store

| store               | 內容                     | 保存位置                       |
| ------------------- | ------------------------ | ------------------------------ |
| `useSessionStore`   | access token(只在記憶體) | 記憶體                         |
| `useLocaleStore`    | 語系                     | localStorage                   |
| `useSideNavStore`   | 側欄收合                 | localStorage(不分使用者)       |
| `useRouteTabsStore` | 路由頁籤                 | sessionStorage(以使用者分 key) |
| `useSnackbarStore`  | 目前那一則提示           | 記憶體                         |

- 儲存鍵一律 `cookhome-admin-*`,登記在 `docs/branding.md`。

正本:`apps/admin/src/stores/`
