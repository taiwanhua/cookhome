# 權限查詢與判斷流程:從登入到畫面渲染的完整鏈路

本文把「查什麼表、組什麼結構、在哪裡判斷」一步步寫死,作為前後端實作與共識的唯一依據。

## 資料來源(誰決定什麼)

| 資料                             | 決定什麼                                                  |
| -------------------------------- | --------------------------------------------------------- |
| `role_module`(核心關聯)          | 角色綁模組 — **進得去哪些頁**(模組=頁面)                  |
| `role_permission`(核心關聯)      | 角色綁權限 — **頁面裡什麼能用**(權限=按鈕/欄位/跳窗/flag) |
| `permissions.moduleId`(直接欄位) | 每筆權限屬於哪個模組(唯一從屬)                            |
| `data_scope_rules`               | 查資料時**看得到哪些**(ADR-0008)                          |

## 登入後的查詢步驟(API 組「模組陣列」)

1. 驗 token,取 userId 與當前組織
2. `user_role`:查此人的角色 → roleIds;**停用的角色(`roles.enabled=false`)不計** — 授予仍在,只是不生效。持有 isSystem 超級管理員角色者到此即 bypass(ADR-0004)
3. `role_module`:roleIds → moduleIds(樹必然完整 — 權限矩陣 UI 強制「勾下層必勾上層」)
4. `role_permission`:roleIds → permissionIds → 查 permissions(每筆自帶 moduleId、key);**停用的權限(`permissions.enabled=false`,全域 kill switch)不算持有**,連超級管理員也不給
5. wildcard 展開:key 以 `.*` 結尾者 → **該模組自己這一層**(moduleId 等於它)的全部權限視為持有,不含子模組(同層語意,ADR-0004;`role_permission` 對該模組只存 `*` 一筆)
6. 組陣列:查 modules(_id ∈ moduleIds;enabled=false 者連子樹剔除)→ 每個模組物件塞 `permissions` = 有效權限中 moduleId 等於它的那些
7. 回傳**模組陣列**(GraphQL `me.modules`),每筆含:`id`、`key`、`name`、`parentId`、`sidebarType`、`order`、`route`、`permissions`
   - **`route` 是完整路徑**:`/` 開頭、父段累加(如 `/system/org-manager`、`/demo/sub/sample-one`);群組也有 route(它是側欄可展開的節點,不是頁面,但路徑要當前綴)。隱藏的 `api` 模組樹會出現在陣列裡但 `route: null`(不是頁面;側欄與路由防守都略過它)
   - **`permissions` 是完整權限 key 字串的陣列**(如 `demo.sub.sample-one.view`),只放 moduleId 等於這個模組的;持有 `X.*` 時陣列裡含 `X.*` 本身與展開後的同層各筆
   - 排序:祖先深度 → `order` → `key`;前端仍以 `parentId` 組樹

以上由 api 的 `PermissionResolver` 單一入口實作,`@RequirePermission(key)` 守門與 `me.modules` 都吃它的結果,兩邊永遠一致(模組子樹停用 → 該處權限也隨之 FORBIDDEN)。

## 前端判斷

- **側欄**:以 parentId 組樹;sidebarType 決定呈現(group=可展開群組、link=連結、hidden=不顯示)
- **路由防守**:每個模組的 route 與上層 route 組合 → 「可進入路由集合」;手打網址不在集合內 → 擋。**可進 = 有那個模組路由**,僅此一條
  - **尾端動態參數的退路(2026-09-22 補,#320 / #321;正本 `apps/admin/src/lib/module-tree.ts` 的 `matchModuleRoute`)**:詳情 / 編輯這類隱藏頁的**模組路由本身不含識別碼**(seed 宣告的 route 是 `view-page` / `edit-page`),實際網址卻是 `/demo/sub/sample-one/view-page/<id>`。所以精準比對落空時**只對 `hidden` 模組**再試一次「去掉最後一段」,解出來的那一段以 `routeParam` 傳給頁面;**`link` 模組不允許** —— 列表頁後面多接一段就是打錯網址,仍然是無權限頁。退路只放寬「網址長相」,沒有放寬「可進 = 有那個模組路由」:沒綁那個隱藏頁模組的人,去掉最後一段之後查不到模組,一樣被擋
- **`abilities` 的兩種語意**(2026-09-22 定案,#318 / #319 / #321):兩種都是「api 依操作者算好、前端只讀不重算」,但**含不含權限判斷不同,用法因此相反**
  - **業務模組的 `item.abilities`**(`DemoItemOne` / `DemoItemTwo` 的 `canEdit` / `canDelete` / `canEditInternalNote`…)**已經含權限判斷**:前端**直接讀**,顯示按鈕的條件就是 `item.abilities.canEdit`,**不與 `usePermissions` 相乘**。同一條規則兩邊各算一次,對不起來就是畫面與 API 不一致
  - **治理模組的 `Role.abilities`**(`canEdit` / `canEditMatrix` / `canToggleEnabled` / `canDelete`)**刻意不含權限 key**:它表達的是**角色種類規則**(種子角色不可改、預設角色只有 root 能動、不可停用自己正持有的角色)。「有沒有 `system.role-manager.edit`」由 `@RequirePermission` 與前端的 `usePermissions` 各守一層,所以顯示按鈕的條件是**兩者相乘**(`rowAbilityOf`,見 `docs/modules/role-manager.md`)
  - 新模組**預設選第一種**(業務模組的作法):把權限判斷收進 api,前端少一份會走樣的複本。只有在「同一個權限之下、每一筆還有各自的可不可以」時才需要第二種,而那時要在模組文件的「api 介面」節寫明它不含權限判斷
- **頁內功能**:登入時把模組陣列組成全域權限結構(模組 key + 動作 = 完整權限 key),放全域快取(react-query/全域 state),所有頁面共用;判斷 = 「key 在集合中,或該權限的擁有模組 key + `.*` 在集合中」(一次查表,不掃前綴)
- **key 切分共識**:最後一段 = 權限動作(恆為單段;`*` 是唯一特殊動作),其餘 = 擁有模組 key(= 路由層級累加)。歸屬的真相仍以 `moduleId` 欄位為準,切字串僅供人讀與前端組 key

## API 防守

- controller 標註所需權限 key(重用頁面權限 key,ADR-0004);後端同樣以「聯集 + 擁有模組的 `*`」判斷
- 資料查詢一律經 BaseRepository:租戶隔離保底 + 資料範圍規則(ADR-0008)

## 快取

- 後端 v1 不快取,每次現查(單一入口 PermissionResolver,ADR-0003)
- 前端以 react-query 快取模組陣列;角色/授權異動後重新登入或重新整理取得新結構(主動失效未來再加)

## 路由與導向規則(admin 殼;2026-09-18 定案,#66)

「可進入路由集合」= 模組陣列中有 route 的 link 與 hidden 模組(群組是側欄節點與路徑前綴、api 樹無路由,兩者都不在集合內)。網址與集合比對後的行為:

| 網址                       | 行為                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **模組路由**(在集合內)     | 顯示該模組頁面(未實作者為佔位頁,顯示模組名)                                                                                                                      |
| **群組路由**(如 `/system`) | 群組不是頁面 → 轉到該群組底下**側欄順序深度優先第一個 link** 的路由;一個都沒有 → 無權限頁                                                                        |
| **`/`**                    | 「帶我去側欄第一個能進的頁」→ 整棵側欄樹深度優先第一個 link(有總覽權限即 `/overview`);一個都沒有 → 無權限頁                                                      |
| **隱藏頁路由 + 尾端一段**  | `/…/view-page/<id>`、`/…/edit-page/<id>`:去掉最後一段後對得上**隱藏頁**模組才放行,那一段以 `routeParam` 傳給頁面(見上方「尾端動態參數的退路」);`link` 模組不適用 |
| 其餘                       | 無權限頁(明確提示是權限問題,不是壞掉);公開路由(`/login` 等)不經此判斷                                                                                            |

群組路由與 `/` 是同一條規則、同一個函式(admin `firstLinkRoute`,只差起點是群組的子樹或整棵樹)。「總覽」是正式模組(key `overview`,`docs/modules/overview.md`),進權限體系、由角色授權;側欄沒有固定列。

**頁籤兩種**(2026-09-23 補,#428):admin 有兩種頁籤,判準是「**它是不是一個網址**」。

- **路由頁籤**(殼的 `RouteTabs`):網址進得去(上表的「模組路由」與「隱藏頁路由 + 尾端一段」,與路由防守是**同一個比對** `matchModuleRoute`)就生成一個,以**完整網址**去重、關閉切相鄰、sessionStorage 以使用者分 key 保留。帶識別碼的詳情 / 編輯頁是**詳情子頁籤**:每一筆各一個,標籤「所屬模組名 — 項目名」,項目名由頁面拿到資料後提供(`hooks/useRouteTabItemLabel`),殼不查業務資料;所屬模組 = 隱藏頁的父模組。權限變了、進不去的子頁籤與一般頁籤一樣被剔除。
- **頁內頁籤**(`@repo/ui/tabs`):同一個網址裡切換區塊(組織詳情的「組織資料 / 成員」、角色管理的頁內頁籤)。不是路由、不進路由頁籤列,狀態不進 URL(REACT-02 第 2 點的 admin 例外)。

新頁面要「能分享、重整後回得來、會出現在頁籤列」就做成(隱藏頁)路由;只是同一筆資料的不同面向就用頁內頁籤。
