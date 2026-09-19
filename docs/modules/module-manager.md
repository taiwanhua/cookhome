# 模組與權限(技術)

- **模組 key**:`system.module-manager`(根組織專屬,租戶不可見)
- **畫面**:Figma「Admin 模組與權限」(左模組樹+右權限清單,除 enabled 外唯讀)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0004 權限模型](../adr/0004-permission-model.md)
- **資料**:`modules`(樹)、`permissions`(moduleId 指向擁有模組)
- **權限備忘**:seed 以 key 冪等 upsert;`enabled` 是唯一 runtime 可變欄位,停用父模組 API 連動子樹;新模組走 code+PR(未來 module-scaffold skill);隱藏 `api` 模組掛純 API 權限
- **使用者說明**:[system.module-manager.help.md](../../apps/admin/src/md/module-help/system.module-manager.help.md)

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                               | 它是哪一頁的什麼                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `system.module-manager.view`           | 看模組樹與各模組的權限清單(唯讀)                                                                                                                       |
| `system.module-manager.toggle-enabled` | 模組 / 權限的 `enabled` 切換 + API(停用父模組連動整棵子樹;停用權限 = 全域 kill switch,連超級管理員也不給;停用確認彈窗 Figma「Overlay / 停用模組確認」) |

模組本身 `isRootOnly`(seed 層),租戶模板不含;審計動作:`module.toggle-enabled` / `permission.toggle-enabled`(`targetType` 分別為 `module` / `permission`)。

## api 介面(#204;程式正本 `apps/api/src/modules/`)

```graphql
moduleTree: [ModuleAdminNode!]!                                  # 全樹(樹根陣列,子節點掛 children)
setModuleEnabled(input: { id, enabled }): ModuleAdminPayload!    # 停用連動子樹;啟用只啟用自己
setPermissionEnabled(input: { id, enabled }): PermissionAdminPayload!
```

三者皆**根組織專屬**:`@RequirePermission` 先守權限(`.view` / `.toggle-enabled`),
service 再守「當前組織是根組織」(判斷點 `OwnerProtectionService.isRootOperator`,
與租戶作業同一個)— 權限可能經角色被帶到別的組織,**站在哪裡**才是判準。
不是根組織 → `FORBIDDEN`;模組 / 權限 id 查無(含 id 格式不合法)→ `NOT_FOUND`。
沒有本模組專屬的新錯誤碼(GQL-04 的表不必追加)。

### 回傳欄位語意(GQL-07:正本在此,前端段只引用)

| 欄位                          | 語意                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `moduleTree`                  | **全樹**:含側欄看不到的 `hidden` 節點、隱藏的 `api` 權限樹,以及**已停用**的模組與權限。停用一律以 `enabled` 表示,不以「不回」表示(不然停用後就再也開不回來)。與 `me.modules`(「我能用什麼」,吃 enabled 當過濾)是兩種相反的讀法 |
| `ModuleAdminNode.parentId`    | 上層模組 id;本樹的根為 `null`。`setModuleEnabled` 回的那一枝,其根節點的 `parentId` 仍是真實的上層 id(與 `OrgNode` 的樹根一律 `null` 不同)                                                                                      |
| `ModuleAdminNode.enabled`     | **這個節點自己的**停用狀態。停用連動子樹時子孫的值已一併落庫,所以樹上讀到什麼就是什麼,不必再回頭看祖先                                                                                                                         |
| `ModuleAdminNode.children`    | 下層模組(側欄順序:`order` → `key`);葉節點為空陣列                                                                                                                                                                              |
| `ModuleAdminNode.permissions` | 這個模組**這一層**宣告的全部權限(含已停用者);`<key>.*` 恆排最前,其餘依 key                                                                                                                                                     |
| `PermissionAdmin.enabled`     | 全域 kill switch:false 時任何人都不再持有它,連超級管理員也不給、`X.*` 也展不出它(ADR-0011 步驟 4)                                                                                                                              |
| `setModuleEnabled` 的回傳     | 被切換的模組**及其整棵子樹**的最新狀態(前端直接換掉樹上的這一枝)                                                                                                                                                               |

`isRootOnly` 只存在於 seed 宣告層、不落庫(`apps/db-migrator/seeds/module-declaration.ts`),
執行期無從得知,故不在回傳欄位內。

### 連動與稽核

- **停用**:自己 + 全部子孫(`modules.ancestors` 含自己者)一併寫成 `enabled=false`
- **啟用**:只啟用自己這一節(子樹當初為何被關掉,這裡沒有資訊可還原,一律由人逐層決定)
- 兩個切換都**冪等**:送與現值相同的 `enabled` 不報錯,照樣寫一筆稽核
- 稽核 `module.toggle-enabled` 的 `after.cascadedModuleKeys` 列出這一次被連動關掉的子孫 key(啟用時為空陣列)
