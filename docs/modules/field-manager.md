# 欄位管理(技術)

## 用途

管理表單下拉的選項:全域的種子類別與選項(如「性別」「示範分類」)由系統提供,各組織可在同一類別下加自己的「自訂選項」,並沿組織樹往下繼承給下層。選項不可刪(舊資料要對照),只能停用;停用只影響新填寫。業務模組(如示範模組1 的分類欄)從這裡讀合併後的選項清單。

正本:`docs/adr/0002-seed-data-vs-business-data.md`、`docs/adr/0005-multi-tenant-isolation.md`

## 模組 key 與畫面

| key                    | 名稱     | sidebarType | 路由                    | 備註                                      |
| ---------------------- | -------- | ----------- | ----------------------- | ----------------------------------------- |
| `system.field-manager` | 欄位管理 | link        | `/system/field-manager` | 掛「系統管理」群組;租戶管理員模板含本模組 |

- 畫面:Figma「Screen / 欄位管理」90:2(左類別清單 + 右選項表格,標示種子資料)、新增選項 211:176。
- 側欄初始圖示 `label`。

正本:`apps/db-migrator/seeds/modules/system.ts`、`docs/standards/general/figma.md`(FIGMA-09 節點表)

## 權限表

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                              | 它是哪一頁的什麼                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.field-manager.view`           | 看類別與選項(來源欄:全域 / <組織名稱> 自訂)                                                                                                                                                                                |
| `system.field-manager.create`         | 「新增選項」+ API(本組織自訂,`orgId` = 當前組織;不可與上層繼承鏈同 `value`,見「規則」;Figma「Overlay / 新增選項」)                                                                                                         |
| `system.field-manager.edit`           | 編輯自訂選項的 label / order / description + API(種子選項只能改 `enabled`;`value` 建立後不可改)                                                                                                                            |
| `system.field-manager.toggle-enabled` | 停用 / 啟用選項 + API(選項不可刪)。**自訂選項只有加它的那一層切得動**(上層 / 下層看得到但 `FORBIDDEN` + `reason: NOT_OWNER`);**種子選項限根組織操作者**(那一筆 `orgId = null`,切下去是全域生效),租戶操作者切 → `FORBIDDEN` |

正本:`apps/db-migrator/seeds/modules/system.ts`

## 資料

- **`field_categories`**:全域種子類別,依 seed 宣告順序;新增類別走 code + PR(seed 依 key 冪等 upsert)。
- **`fields`**:選項。`orgId` nullable —— `null` = 全域種子、有值 = 該組織的自訂選項。`(categoryId, orgId, value)` 唯一索引;`key` 選填、sparse unique。
- **種子選項的 key**:`<類別 key>.<value>`(如 `gender.male`、`demo-category.side-dish`),只給冪等識別用;自訂選項沒有 key、以 `_id` 識別。production 第一次 seed 後不可改。
- `enabled` 是 ADR-0002 的「初始 seed 值的欄位」:由人在系統內管理,seed 重跑不覆蓋。

**種子內容**(全域類別與選項,`orgId = null`;order 依宣告順序 1 起算):

| 類別 key        | 類別名   | 選項 value    | 選項 label | order |
| --------------- | -------- | ------------- | ---------- | ----- |
| `gender`        | 性別     | `male`        | 男         | 1     |
|                 |          | `female`      | 女         | 2     |
|                 |          | `other`       | 其他       | 3     |
|                 |          | `undisclosed` | 不透露     | 4     |
| `demo-category` | 示範分類 | `staple`      | 主食       | 1     |
|                 |          | `side-dish`   | 小菜       | 2     |
|                 |          | `drink`       | 飲品       | 3     |

示範畫面上的「甜點」是租戶自訂選項的示意,**不是種子**。

正本:`apps/api/src/database/schemas/field-category.schema.ts`、`apps/api/src/database/schemas/field.schema.ts`、`apps/db-migrator/seeds/field-categories.ts`、`apps/db-migrator/seeds/fields.ts`

## 規則

### 自訂選項的可見範圍與可編輯範圍

**看得到 = 全域 + 我的上層(一路到租戶頂層,不受可見性開關影響)+ 自己 + 我可見範圍內的下層;只能編輯 / 停用自己這一層加的。**

以好食公司(租戶頂層)→ 南港店 → 子南港店,另有信義店為例:

| 誰在看                      | 看得到的自訂                          | 可編輯       |
| --------------------------- | ------------------------------------- | ------------ |
| root                        | 全部租戶的                            | 根組織加的   |
| 好食公司(可見範圍 = 子樹)   | 好食公司 + 南港店 + 子南港店 + 信義店 | 好食公司加的 |
| 南港店(可見範圍 = 子樹)     | 好食公司 + 南港店 + 子南港店          | 南港店加的   |
| 南港店(可見範圍 = 僅本組織) | 好食公司 + 南港店                     | 南港店加的   |
| 子南港店                    | 好食公司 + 南港店 + 子南港店          | 子南港店加的 |
| 信義店                      | 好食公司 + 信義店                     | 信義店加的   |

- **上層(祖先)不受可見性開關影響**:開關管的是「看不看得到下層」(ADR-0005),往上繼承是欄位選項自己的語意 —— 上層加的選項對下層是「發下來的設定」,關掉開關不該讓表單少一半選項。
- 祖先由當前組織的 `orgs.ancestors` 取(物化路徑,ADR-0005);兄弟 / 旁支看不到彼此。
- 這代表**合併清單的讀取要提升範圍**(祖先不在 `visibleOrgIds` 裡,`tenantScopePlugin` 會濾掉),所以 `fields` 的讀取一律用 `field-visibility.ts` 的 `fieldReadContext` + 明列 orgId 的條件 —— 範圍由該檔依本表算出,不是把過濾關掉。
- 合併清單排序:先 `order`,同 `order` 再依**組織深度**(全域最前、下層最後),同深度依建立順序。

### value 的唯一性

- 同一類別、同一組織下 `value` 不可重複 —— 唯一索引 + 表單驗證。
- **自訂選項也不可與同類別的「上層繼承鏈」(全域 + 祖先組織的自訂 + 自己)同 `value`**:那些筆的 `orgId` 不同,唯一索引擋不到,由 service 的表單驗證擋,一樣回 `FIELD_VALUE_DUPLICATE`。理由:合併清單是給表單下拉用的,同一個 `value` 出現兩次,存進業務資料後分不出是哪一筆。
- **旁支 / 下層的同 `value` 不算重複**:下層看不看得到由可見性開關決定,拿它當唯一性判準會讓「同一個新增動作因為別人切了開關就失敗」。**已知取捨**:開關為子樹時,上層的合併清單可能同時出現自己與下層的同一個 `value`(`ownerOrg` 不同),表單下拉靠 `ownerOrg` 分辨;真的造成困擾時再收斂。

### 種子選項的 `enabled` 是全域開關

`fields` 的全域種子只有一筆文件(`orgId = null`),切它等於對全平台生效,沒有「本組織生效」的覆寫資料結構(ADR-0002:`enabled` 是初始 seed 值欄位,與模組 / 權限的 kill switch 同一模型)。因此 `setFieldEnabled` 對種子選項**限根組織操作者**;租戶操作者切種子選項回 `FORBIDDEN`(自訂選項照常可切)。這由 api 直接寫進每一列的 `canToggleEnabled`,前端不自己判斷視角。

### 其他

- 種子選項僅 `enabled` 可改;自訂選項的 `value` 建立後不可改。
- 選項不可刪,僅停用;停用只影響新填寫,既有資料不受影響。

正本:`apps/api/src/fields/fields.service.ts`、`apps/api/src/fields/field-visibility.ts`

## api 介面

```graphql
fieldCategories: FieldCategoriesPayload!           # 全域種子類別,依 seed 宣告順序
fields(categoryId: ID!): FieldsPayload!            # 合併清單(範圍與排序見「規則」)
createField(input: CreateFieldInput!): FieldPayload!
updateField(input: UpdateFieldInput!): FieldPayload!
setFieldEnabled(input: SetFieldEnabledInput!): FieldPayload!
```

兩個 query 回 GQL-03 的列表形狀 `{ items, totalCount }`(不分頁,`totalCount` 即 `items` 長度);三個 mutation 回 `FieldPayload { field: Field! }`(GQL-02)。

**欄位語意**(GQL-07:正本在此,前端引用不另寫解釋)

- `Field.ownerOrg`:加這筆的組織 `{ id, name }`;**`null` = 全域種子**(`orgId = null`)。畫面「來源」欄的文案由前端組(`null` → 「全域」、有值 → 「<ownerOrg.name> 自訂」)。**組織名稱一律由 api 給** —— 合併清單含上層 / 下層組織加的選項,前端拿 session 的當前組織名會把別人的標成自己的。
- `Field.isOwn`:這筆是不是**當前組織**這一層加的(`orgId = 操作者的當前組織`)。
- `Field.canEdit` / `Field.canToggleEnabled`:api **依操作者算好**的「這一列能不能動」,前端只讀、再與自己的權限(`edit` / `toggle-enabled`)取交集,不自己推組織關係、也不推「是不是根組織視角」。規則:`canEdit` = 自訂選項且 `isOwn`;`canToggleEnabled` = 自訂選項看 `isOwn`、種子選項看操作者是不是根組織。
- `Field.enabled`:停用僅影響新填寫,既有資料不受影響;選項不可刪。

**缺席 / null 語意(GQL-06)**

- `CreateFieldInput.order` 缺席 / null = `0`;`description` 缺席 / null = 不寫。
- `UpdateFieldInput.label` / `order` 缺席 = 不動;`description` 缺席 = 不動、`null` = 清空。`value` 不在 input 內 —— 建立後不可改。

正本:`apps/api/src/fields/`(`fields.resolver.ts`、`fields.service.ts`、`models/`、`dto/`)、`apps/api/schema.gql`

## admin 頁面

`apps/admin/src/pages/system/FieldManagerPage/`。左類別清單(`CategoryListPanel.tsx`)唯讀,右邊是所選類別的合併清單(`FieldOptionsPanel/`):顯示名稱、值、排序、**來源**、啟用開關、操作;新增 / 編輯彈窗在 `FieldFormDialog/`。

- **來源欄與「這一列能做什麼」集中在 `field-source.ts`**(`isSeedOption` / `fieldSourceView` / `canToggleOption` / `canEditOption` / `managedByOrgOf`),表格與彈窗不自己解讀 `ownerOrg`。規則本身在 api(`canEdit` / `canToggleEnabled`),這個檔只做「與權限取交集 + 文案」。
- **「來源」欄文案**:「全域」或「<組織名稱> 自訂」。不用「租戶自訂」—— 下層組織也可能自訂,且「租戶」是平台詞彙。
- **停用 / 啟用直接送**,不另開確認彈窗:可逆,而且只影響新填寫。列表的啟用欄是 Switch;無權限或改不動時退回唯讀。
- **編輯彈窗只給自訂選項**;種子選項連彈窗都不開,操作欄改顯示「由系統管理員維護」。
- **`FIELD_VALUE_DUPLICATE` 標在「值」欄位上**(不是頁面 Alert),彈窗留著讓人改值。
- **改不動的列反灰不隱藏**:上層 / 下層組織加的選項整列以 `text.disabled` 呈現、開關 disabled,操作欄顯示「由 <組織名> 管理」並以原生 `title` 說明原因。看得到但動不了,跟「這個動作我沒有權限」是兩回事。
- 前端不推「根組織視角」:每一列能不能切由 api 的 `canToggleEnabled` 決定。

正本:`apps/admin/src/pages/system/FieldManagerPage/`(`field-source.ts`、`FieldOptionsPanel/FieldOptionsTable.tsx`、`field-manager-error.ts`)

## 錯誤碼

| 情況                                                                                    | 回什麼                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 同一類別下 `value` 與**上層繼承鏈**重複(自己這一層已有、全域選項、看得到的上層組織自訂) | `FIELD_VALUE_DUPLICATE`                                  |
| `updateField` 碰種子選項(種子只能 `setFieldEnabled`)                                    | `FORBIDDEN` + `extensions.reason = "SEED_READ_ONLY"`     |
| `setFieldEnabled` 碰**種子**選項而操作者不是根組織                                      | `FORBIDDEN` + `extensions.reason = "SEED_GLOBAL_SWITCH"` |
| mutation 碰**看得到但不是自己這一層加的**自訂選項(上層或下層組織加的)                   | `FORBIDDEN` + `extensions.reason = "NOT_OWNER"`          |
| 類別或選項不在合併清單 / 可見範圍內(不透露它存在)                                       | `NOT_FOUND`                                              |
| id 格式不對、`label` / `value` 空白                                                     | `VALIDATION_FAILED`                                      |

前端依 `reason` 換文案,解讀集中在 `FieldManagerPage/field-manager-error.ts`。

正本:`apps/api/src/fields/fields-error.ts`、`apps/admin/src/pages/system/FieldManagerPage/field-manager-error.ts`

## 稽核

動作 `field.create` / `field.edit` / `field.toggle-enabled`,`targetType` 一律 `field`。

正本:`apps/api/src/fields/fields.service.ts`

## 測試

- api:`apps/api/src/fields/fields.test.ts`(端點、錯誤、種子開關)、`apps/api/src/fields/field-visibility.test.ts`(可見 / 可編輯範圍表);夾具 `apps/api/src/fields/test-support/fixtures.ts`
- admin:`apps/admin/src/pages/system/FieldManagerPage/` 的 `FieldManagerPage.test.tsx`、`FieldManagerFeedback.test.tsx`、`FieldManagerSeed.test.tsx`、`FieldManagerVisibility.test.tsx`;共用 harness `field-manager-test-support.ts`
- 劇本 E2E(`docs/testing/permission-scenarios.md`):劇本 2 / 12 確認沒有 `system.field-manager.view` 時示範模組1 的分類欄退化(`scenario-02-data-scope-rule.spec.ts`、`scenario-12-visibility-toggle.spec.ts`)、劇本 16 租戶視角的種子選項唯讀(`scenario-16-tenant-perspective.spec.ts`)

正本:上列檔案、`docs/testing/permission-scenarios.md`

## 使用者說明(help.md)

[system.field-manager.help.md](../../apps/admin/src/md/module-help/system.field-manager.help.md)

正本:`apps/admin/src/md/module-help/system.field-manager.help.md`

## 平台視角備註

- 種子類別與選項是平台層的設定:新增類別走 code + PR,種子選項的啟停是全平台生效、只有根組織能切 —— 租戶在畫面上只會看到「由系統管理員維護」。
- root 看得到全部租戶的自訂選項,但只能編輯 / 停用根組織自己加的。

正本:`apps/db-migrator/seeds/field-categories.ts`、`apps/db-migrator/seeds/fields.ts`、`apps/api/src/fields/field-visibility.ts`
