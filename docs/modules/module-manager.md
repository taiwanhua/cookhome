# 模組與權限(技術)

- **模組 key**:`system.module-manager`(根組織專屬,租戶不可見)
- **畫面**:Figma「Admin 模組與權限」(左模組樹+右權限清單,除 enabled 外唯讀)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0004 權限模型](../adr/0004-permission-model.md)
- **資料**:`modules`(樹)、`permissions`(moduleId 指向擁有模組)
- **權限備忘**:seed 以 key 冪等 upsert;runtime 可變欄位只有 `enabled` 與 `icon`(兩者都是 ADR-0002 的「初始 seed 值的欄位」),停用父模組 API 連動子樹;新模組走 code+PR(未來 module-scaffold skill);隱藏 `api` 模組掛純 API 權限
- **使用者說明**:[system.module-manager.help.md](../../apps/admin/src/md/module-help/system.module-manager.help.md)

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                               | 它是哪一頁的什麼                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.module-manager.view`           | 看模組樹與各模組的權限清單(唯讀)                                                                                                                                 |
| `system.module-manager.toggle-enabled` | 模組 / 權限的 `enabled` 切換 + API(停用父模組連動整棵子樹;停用權限 = 全域 kill switch,連超級管理員也不給;停用確認彈窗 Figma「Overlay / 停用模組確認」)           |
| `system.module-manager.set-icon`       | 模組的側欄圖示選擇器 + API(#288)。**獨立於 `.toggle-enabled`**:換圖示只改側欄長相、隨時換得回來,停用卻會讓所有租戶少掉整塊功能,兩件事的後果差太遠,不共用一把鑰匙 |

模組本身 `isRootOnly`(seed 層),租戶模板不含;審計動作:`module.toggle-enabled` / `module.set-icon` / `permission.toggle-enabled`(`targetType` 分別為 `module` / `module` / `permission`)。

## 側欄圖示(#288)

`modules.icon` 是側欄圖示的 key,**正本是白名單** `@repo/domain/module-icon` 的 `MODULE_ICON_KEYS`(29 個 key)。
前後端共用同一份:api 用它擋輸入,`@repo/ui` 的圖示登錄表以它為型別來源 —— 少一個 key 就 `check-types` 紅,
不會出現「api 存得進去、側欄畫不出來」。`null` = 沒指定,側欄用預設圖示;前端認不得的 key 也一律退回預設圖示。

**seed 只給初值**(宣告正本 `apps/db-migrator/seeds/modules/*.ts`),之後由根組織在這一頁換:

| 模組                               | 初始 icon   | 模組                            | 初始 icon    |
| ---------------------------------- | ----------- | ------------------------------- | ------------ |
| `overview` 總覽                    | `dashboard` | `system.data-scope` 資料範圍    | `filter`     |
| `system` 系統管理                  | `settings`  | `demo` 示範群組                 | `extension`  |
| `system.org-manager` 組織管理      | `business`  | `demo.sub` 示範次群組           | `folder`     |
| `…org-manager.tenant-ops` 租戶作業 | `key`       | `demo.sub.sample-one` 示範模組1 | `grid`       |
| `system.user-manager` 使用者管理   | `people`    | `demo.sample-two` 示範模組2     | `list`       |
| `system.role-manager` 角色管理     | `shield`    | `api` API 能力                  | `tune`       |
| `system.module-manager` 模組與權限 | `apps`      | 其餘隱藏頁                      | 不給(`null`) |
| `system.field-manager` 欄位管理    | `label`     |                                 |              |

**seed 重跑不覆蓋人改過的值**:`icon` 與 `enabled` 同為 ADR-0002 的「初始 seed 值的欄位」
(`seeds/modules.ts` 的 `initialSeedValueFields: ["enabled", "icon"]`)。
唯一會寫入既有文件的情形是**這一欄根本不存在**(#288 之前種下的舊資料)—— 那時補初值,
否則已經種過的環境永遠拿不到圖示。所以 `setModuleIcon` 清空時寫的是 `icon: null` 而不是 `$unset`:
欄位留著才算「人改過的值」,下次部署不會把宣告的初值補回來。

## api 介面(#204 / #288;程式正本 `apps/api/src/modules/`)

```graphql
moduleTree: [ModuleAdminNode!]!                                  # 全樹(樹根陣列,子節點掛 children)
setModuleEnabled(input: { id, enabled }): ModuleAdminPayload!    # 停用連動子樹;啟用只啟用自己
setModuleIcon(input: { id, icon }): ModuleAdminPayload!          # 側欄圖示;icon 為白名單 key 或 null
setPermissionEnabled(input: { id, enabled }): PermissionAdminPayload!
```

四者皆**根組織專屬**:`@RequirePermission` 先守權限(`.view` / `.toggle-enabled` / `.set-icon`),
service 再守「當前組織是根組織」(判斷點 `OwnerProtectionService.isRootOperator`,
與租戶作業同一個)— 權限可能經角色被帶到別的組織,**站在哪裡**才是判準。
不是根組織 → `FORBIDDEN`;模組 / 權限 id 查無(含 id 格式不合法)→ `NOT_FOUND`。
**`setModuleEnabled` / `setPermissionEnabled` 的目標落在 `system.module-manager` 子樹內 → `FORBIDDEN` + `extensions.reason = "SELF_LOCK"`**(#261,見下方「自鎖保護」)。
沒有本模組專屬的新錯誤碼 —— `SELF_LOCK` 是既有 `FORBIDDEN` 的 `reason`,不是新的 `code`(GQL-04 的表只在 `FORBIDDEN` 那一列註明)。

`setModuleIcon` 的補充(#288):

- **不套自鎖保護**:換圖示不會讓任何人進不來,換錯了照樣能再換 —— `SELF_LOCK` 守的是「關掉就再也開不回來」,這裡沒有這個風險,所以這一頁自己的圖示也換得了。
- **`icon` 不在白名單內** → `VALIDATION_FAILED`,`extensions.fields = ["icon"]`(讓前端把錯標回圖示選擇器)。
- **`icon` 缺席與 `null` 同義**(GQL-06):兩者都是「清掉,側欄改用預設圖示」。這個 input 只有一個可寫欄位,沒有「部分更新」可言,所以不造第三種狀態。
- 冪等:送與現值相同的 `icon` 不報錯,照樣寫一筆稽核(與兩個切換同慣例)。

### 回傳欄位語意(GQL-07:正本在此,前端段只引用)

| 欄位                          | 語意                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `moduleTree`                  | **全樹**:含側欄看不到的 `hidden` 節點、隱藏的 `api` 權限樹,以及**已停用**的模組與權限。停用一律以 `enabled` 表示,不以「不回」表示(不然停用後就再也開不回來)。與 `me.modules`(「我能用什麼」,吃 enabled 當過濾)是兩種相反的讀法                                                                                                                                                             |
| `ModuleAdminNode.parentId`    | 上層模組 id;本樹的根為 `null`。`setModuleEnabled` 回的那一枝,其根節點的 `parentId` 仍是真實的上層 id(與 `OrgNode` 的樹根一律 `null` 不同)                                                                                                                                                                                                                                                  |
| `ModuleAdminNode.enabled`     | **這個節點自己的**停用狀態。停用連動子樹時子孫的值已一併落庫,所以樹上讀到什麼就是什麼,不必再回頭看祖先                                                                                                                                                                                                                                                                                     |
| `ModuleAdminNode.route`       | 路由**只有自己那一段**(不是完整路徑;完整路徑由各層的 route 串起來)。`null` = 這個節點不對應任何畫面 ⇒ **`sidebarType = HIDDEN` 且 `route` 為 `null` 就是「權限容器」**(`api` 權限樹、`system.org-manager.tenant-ops`),它存在的理由只是讓底下那幾條權限可以單獨授予 / 停用。前端據此把它標成「權限容器」而不是「隱藏頁」(#246;在那之前用「key 不以 `-page` 結尾」近似,靠的是 seed 命名規約) |
| `ModuleAdminNode.children`    | 下層模組(側欄順序:`order` → `key`);葉節點為空陣列                                                                                                                                                                                                                                                                                                                                          |
| `ModuleAdminNode.icon`        | 側欄圖示 key(白名單 `@repo/domain/module-icon`);`null` = 沒指定,側欄用預設圖示。`me.modules[].icon` 是同一個值、同一個語意                                                                                                                                                                                                                                                                 |
| `ModuleAdminNode.permissions` | 這個模組**這一層**宣告的全部權限(含已停用者);`<key>.*` 恆排最前,其餘依 key                                                                                                                                                                                                                                                                                                                 |
| `PermissionAdmin.enabled`     | 全域 kill switch:false 時任何人都不再持有它,連超級管理員也不給、`X.*` 也展不出它(ADR-0011 步驟 4)                                                                                                                                                                                                                                                                                          |
| `setModuleEnabled` 的回傳     | 被切換的模組**及其整棵子樹**的最新狀態(前端直接換掉樹上的這一枝)                                                                                                                                                                                                                                                                                                                           |

`isRootOnly` 只存在於 seed 宣告層、不落庫(`apps/db-migrator/seeds/module-declaration.ts`),
執行期無從得知,故不在回傳欄位內。

### 連動與稽核

- **停用**:自己 + 全部子孫(`modules.ancestors` 含自己者)一併寫成 `enabled=false`
- **啟用**:只啟用自己這一節(子樹當初為何被關掉,這裡沒有資訊可還原,一律由人逐層決定)
- 兩個切換都**冪等**:送與現值相同的 `enabled` 不報錯,照樣寫一筆稽核
- 稽核 `module.toggle-enabled` 的 `after.cascadedModuleKeys` 列出這一次被連動關掉的子孫 key(啟用時為空陣列)
- **換圖示不連動任何東西**(#288):稽核 `module.set-icon` 的 `before` / `after` 各帶 `{ key, icon }`,`targetType` 為 `module`

## admin 頁面(#209;程式正本 `apps/admin/src/pages/system/ModuleManagerPage/`)

左 `Tree`(治理面全樹)+ 右面板(所選模組的資料與它這一層的權限清單),Figma「模組與權限」89:2、停用確認 211:331。

| 行為       | 做法                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 樹上的標示 | 群組 / 隱藏頁 / 權限容器掛類型 `Tag`(連結是多數,不掛);`enabled=false` 另掛「停用」`Tag`。各類型的完整說法在右側「側欄類型」那一列,權限容器見下節                                                                                                                                             |
| 停用模組   | 先開確認彈窗(文案說明連動整棵子樹、重新啟用只開自己)→ `SetModuleEnabled` → invalidate `ModuleTree` + `me`                                                                                                                                                                                    |
| 啟用模組   | 不確認,直接送出(只影響自己這一節,可逆)                                                                                                                                                                                                                                                       |
| 權限開關   | 不確認,直接 `SetPermissionEnabled`;清單上方固定一句話說明「停用 = 所有持有者立即失去」                                                                                                                                                                                                       |
| 換圖示     | 右面板「圖示」欄位選一個白名單 key → 不確認、直接 `SetModuleIcon` → invalidate `ModuleTree` + `me`(側欄立即更新);依 `system.module-manager.set-icon` 顯示:有權限給 `@repo/ui/module-icon-picker`,沒有只顯示目前圖示與名稱。清空 = 送 `icon: null`(回預設圖示),初值與對照表見上方「側欄圖示」 |
| 唯讀       | 除兩種 `enabled` 與 `icon` 外全部唯讀(ADR-0002:結構異動走 code + PR)                                                                                                                                                                                                                         |
| 動作的顯示 | 依 `system.module-manager.toggle-enabled`;沒有這筆權限時開關不渲染,改以狀態 `Tag` 呈現                                                                                                                                                                                                       |
| 非根組織   | 不在頁面判斷 — 本模組 `isRootOnly`,租戶的 `me.modules` 裡沒有它,路由層就擋掉了(ADR-0011)                                                                                                                                                                                                     |

### 「權限容器」節點(#260 第 6 點;文案正本)

樹上有一種節點**只掛權限、沒有畫面**:`sidebarType = hidden` 且沒有 route,例如 `system.org-manager.tenant-ops`(根組織專屬動作)與整棵 `api` 樹。
它們不是頁面,不受隱藏頁 `-page` 命名規則約束(ADR-0004「頁面(模組)的進入權」),`me.modules` 對它們回 `route: null`。

| 落點             | 文案                                                      |
| ---------------- | --------------------------------------------------------- |
| 樹上的類型 `Tag` | 「權限容器」(不是「隱藏頁」)                              |
| 右面板的描述     | 「這一層只掛權限、沒有畫面,讓這些權限可以單獨授予或停用」 |

判準以 seed 的 `route` 為準。`moduleAdminTree` 沒有回 `route`(`apps/api/schema.gql` 的 `ModuleAdminNode`),
所以前端改看 key 結尾 —— 這與看 `route` **等價,不是近似**:seed 的命名規約
(`apps/db-migrator/src/seed/seed-key-convention.ts`)把「`-page` 結尾 ⇔ hidden 且有 route」寫成硬規則,
違規在種資料時就被擋下。判斷函式:`ModuleManagerPage/module-admin-tree.ts` 的 `isPermissionContainer`(#260)。
`help.md` 同步一句相同白話。

**自鎖保護(#261 / #233,api 已擋)**:停用 `system.module-manager` 自己,一旦關掉就沒有任何畫面能把它開回來 —
與角色的「不可停用自己正持有的角色」是同一條原則,只是主體換成模組樹。

- **api(把關)**:`setModuleEnabled` / `setPermissionEnabled` 的目標落在 `system.module-manager` 子樹內(模組本身、其子模組、以及它們的權限)→ `FORBIDDEN` + `extensions.reason = "SELF_LOCK"`。
  子樹判定走**物化路徑**(`modules.ancestors`),不切 key 字串(ADR-0004「反向歸屬不解析字串」);程式正本 `apps/api/src/modules/module-manager.service.ts` 的 `assertNotSelfLock`。
- **admin(防呆)**:這一枝的開關 `disabled` 並附說明「此模組用於管理模組本身,不可停用」(#209),不等送出才吃錯。
