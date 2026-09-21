# 欄位管理(技術)

- **模組 key**:`system.field-manager`
- **畫面**:Figma「Admin 欄位管理」(左類別清單+右選項表格,種子資料標示)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0005 多租戶隔離](../adr/0005-multi-tenant-isolation.md)
- **資料**:`field_categories`(全域 seed)、`fields`(orgId nullable:null=全域 seed、有值=租戶自訂)
- **UI 規格**:「來源」欄顯示「全域」或「<組織名稱> 自訂」(2026-09-09 定案;不用「租戶自訂」— 下層組織也可能自訂,且租戶為平台詞彙)。**組織名稱由 api 逐列帶回**(`Field.ownerOrg`),不是前端拿 session 的當前組織組字串(#264)
- **權限備忘**:新增類別走 code+PR(seed 冪等 upsert);seed 選項僅 `enabled` 可改;自訂選項沿組織樹向下繼承(見下方規則表);選項不可刪(舊資料對照),僅停用
- **使用者說明**:[system.field-manager.help.md](../../apps/admin/src/md/module-help/system.field-manager.help.md)

## 自訂選項的可見範圍與可編輯範圍(正本,2026-09-21 使用者裁決 / #264)

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

- **上層(祖先)不受可見性開關影響**:開關管的是「看不看得到下層」(ADR-0005),往上繼承是欄位選項自己的語意 — 上層加的選項對下層是「發下來的設定」,關掉開關不該讓表單少一半選項。
- 祖先由當前組織的 `orgs.ancestors` 取(物化路徑,ADR-0005);兄弟 / 旁支看不到彼此。
- 實作上這代表**合併清單的讀取要提升範圍**(祖先不在 `visibleOrgIds` 裡,`tenantScopePlugin` 會濾掉),所以 `fields` 的讀取一律用 `field-visibility.ts` 的 `fieldReadContext` + 明列 orgId 的條件 — 範圍由該檔依本表算出,不是把過濾關掉。
- 種子選項的 `enabled` 仍限根組織(全域生效,#206 決定)。
- 合併清單排序:先 `order`,同 `order` 再依**組織深度**(全域最前、下層最後),同深度依建立順序。

## 種子內容(正本)

全域類別與選項(orgId=null),seed 依 key 冪等 upsert:

| 類別 key        | 類別名   | 選項 value    | 選項 label | order |
| --------------- | -------- | ------------- | ---------- | ----- |
| `gender`        | 性別     | `male`        | 男         | 1     |
|                 |          | `female`      | 女         | 2     |
|                 |          | `other`       | 其他       | 3     |
|                 |          | `undisclosed` | 不透露     | 4     |
| `demo-category` | 示範分類 | `staple`      | 主食       | 1     |
|                 |          | `side-dish`   | 小菜       | 2     |
|                 |          | `drink`       | 飲品       | 3     |

示範畫面上的「甜點」是租戶自訂選項的示意(orgId=租戶A),**不是種子**。

**種子選項的 key**:`<類別 key>.<value>`(如 `gender.male`、`demo-category.side-dish`),只給冪等識別用;租戶自訂選項沒有 key、以 `_id` 識別(`fields.key` 選填、sparse unique)。production 第一次 seed 後不可改。
同一類別、同一組織下 `value` 不可重複 — `(categoryId, orgId, value)` 唯一索引(`field.schema.ts`)+ 表單驗證(#206 完成)。
**自訂選項也不可與同類別的「上層繼承鏈」(全域 + 祖先組織的自訂 + 自己)同 `value`**:那些筆的 `orgId` 不同,唯一索引擋不到,由 service 的表單驗證擋,一樣回 `FIELD_VALUE_DUPLICATE`(合併清單是給表單下拉用的,同一個 `value` 出現兩次,存進業務資料後分不出是哪一筆)。
**旁支 / 下層的同 `value` 不算重複**(#264):下層看不看得到上層以外的東西由可見性開關決定,拿它當唯一性判準會讓「同一個新增動作因為別人切了開關就失敗」。**已知取捨**:開關為子樹時,上層的合併清單可能同時出現自己與下層的同一個 `value`(兩筆都看得到、`ownerOrg` 不同),表單下拉要靠 `ownerOrg` 分辨 — 真的造成困擾時再開票收斂。

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                              | 它是哪一頁的什麼                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `system.field-manager.view`           | 看類別與選項(來源欄:全域 / <組織名稱> 自訂)                                                                                                                                                                                                                                          |
| `system.field-manager.create`         | 「新增選項」+ API(本組織自訂,`orgId` = 當前組織;`(categoryId, orgId, value)` 唯一,且**不可與同類別的全域選項同 `value`**;Figma「Overlay / 新增選項」)                                                                                                                                |
| `system.field-manager.edit`           | 編輯自訂選項的 label / order / description + API(種子選項只能改 `enabled`;`value` 建立後不可改)                                                                                                                                                                                      |
| `system.field-manager.toggle-enabled` | 停用 / 啟用選項 + API(選項不可刪,舊資料要對照)。**自訂選項只有加它的那一層切得動**(上層 / 下層看得到但 `FORBIDDEN` + `reason: NOT_OWNER`,2026-09-21 / #264);**種子選項限根組織操作者**(那一筆 `orgId = null`,切下去是全域生效),租戶操作者切種子選項 → `FORBIDDEN`(2026-09-20 / #206) |

審計動作:`field.create` / `field.edit` / `field.toggle-enabled`(`targetType = "field"`)。

## admin 畫面(#211)

`apps/admin/src/pages/system/FieldManagerPage/`(Figma「欄位管理」90:2、新增選項 211:176)。
左類別清單唯讀,右邊是所選類別的合併清單:顯示名稱、值、排序、**來源**、啟用開關、操作。

- **來源欄與「這一列能做什麼」集中在 `field-source.ts`**(`isSeedOption` / `fieldSourceView` /
  `canToggleOption` / `canEditOption` / `managedByOrgOf`),表格與彈窗不自己解讀 `ownerOrg`。
  規則本身在 api(`canEdit` / `canToggleEnabled`),這個檔只做「與權限取交集 + 文案」。
- **停用 / 啟用直接送**,不另開確認彈窗:可逆,而且只影響新填寫(既有資料不受影響)。
- **編輯彈窗只給自訂選項**;種子選項連彈窗都不開,操作欄改顯示「由系統管理員維護」。
- **`FIELD_VALUE_DUPLICATE` 標在「值」欄位上**(不是頁面 Alert),彈窗留著讓人改值。
- **改不動的列反灰不隱藏**:上層 / 下層組織加的選項整列以 `text.disabled` 呈現、開關 disabled,
  操作欄顯示「由 <組織名> 管理」並以 `title` 說明原因(`@repo/ui` 尚無 Tooltip 元件,#260 進 main 後換掉)。
  看得到但動不了,跟「這個動作我沒有權限」是兩回事。
- **前端不再推「根組織視角」**(2026-09-21 / #264、#252 一併解決):第 4 段用 `me.modules` 裡有沒有
  根組織專屬模組來近似(`isRootPerspective`),偏保守且與 api 判準不同源。現在 api 逐列回
  `canToggleEnabled`,那個函式已移除,前端只讀 api 的答案。

## api 介面(#206;正本,前端引用不另寫解釋 — GQL-07)

```graphql
fieldCategories: FieldCategoriesPayload!           # 全域種子類別,依 seed 宣告順序
fields(categoryId: ID!): FieldsPayload!            # 合併清單,依 order 再依建立順序
createField(input: CreateFieldInput!): FieldPayload!
updateField(input: UpdateFieldInput!): FieldPayload!
setFieldEnabled(input: SetFieldEnabledInput!): FieldPayload!
```

兩個 query 回 GQL-03 的列表形狀 `{ items, totalCount }`(不分頁,`totalCount` 即 `items` 長度);三個 mutation 回 `FieldPayload { field: Field! }`(GQL-02)。#201 Interface design 寫的裸回 `[Field!]!` / `Field!` 是簡寫,主流程 2026-09-20 裁決:第 4 段四票一律照 GQL-02 / GQL-03 用 payload type。

**欄位語意**(2026-09-21 / #264 改版:`FieldSource` enum 已移除)

- `Field.ownerOrg`:加這筆的組織 `{ id, name }`;**`null` = 全域種子**(`orgId = null`)。畫面「來源」欄的文案由前端組(`null` → 「全域」、有值 → 「<ownerOrg.name> 自訂」)。**組織名稱一律由 api 給** — 合併清單含上層 / 下層組織加的選項,前端拿 session 的當前組織名會把別人的標成自己的。
- `Field.isOwn`:這筆是不是**當前組織**這一層加的(`orgId = 操作者的當前組織`)。
- `Field.canEdit` / `Field.canToggleEnabled`:api **依操作者算好**的「這一列能不能動」,前端只讀、再與自己的權限(`edit` / `toggle-enabled`)取交集,不自己推組織關係、也不推「是不是根組織視角」(#252 的 `isRootPerspective` 近似法已退場)。規則:`canEdit` = 自訂選項且 `isOwn`;`canToggleEnabled` = 自訂選項看 `isOwn`、種子選項看操作者是不是根組織。
- **合併清單的範圍**見本檔「自訂選項的可見範圍與可編輯範圍」;排序先 `order`、同 `order` 再依組織深度。
- `Field.enabled`:停用僅影響新填寫,既有資料不受影響;選項不可刪。

**缺席 / null 語意(GQL-06)**

- `CreateFieldInput.order` 缺席 / null = `0`;`description` 缺席 / null = 不寫。
- `UpdateFieldInput.label` / `order` 缺席 = 不動;`description` 缺席 = 不動、`null` = 清空。`value` 不在 input 內 — 建立後不可改。

**錯誤**

- `FIELD_VALUE_DUPLICATE`:同一類別下 `value` 與**上層繼承鏈**重複 — 自己這一層已有、該類別的全域選項、或看得到的上層組織自訂(後兩者唯一索引擋不到,由 service 的表單驗證擋)。
- `FORBIDDEN`:帶 `extensions.reason` 分三種(#264;前端據此換文案) —
  - `SEED_READ_ONLY`:`updateField` 碰種子選項(種子只能 `setFieldEnabled`)
  - `SEED_GLOBAL_SWITCH`:`setFieldEnabled` 碰**種子**選項而操作者不是根組織
  - `NOT_OWNER`:mutation 碰**看得到但不是自己這一層加的**自訂選項(上層或下層組織加的)
- `NOT_FOUND`:類別或選項不在合併清單 / 可見範圍內(看不到的一律 `NOT_FOUND`,不透露它存在)。`VALIDATION_FAILED`:id 格式不對、`label` / `value` 空白。

**種子選項的 `enabled` 是全域開關(2026-09-20,#206 定案)**:`fields` 的全域種子只有一筆文件(`orgId = null`),切它等於對全平台生效,沒有「本組織生效」的覆寫資料結構(ADR-0002:`enabled` 是初始 seed 值欄位、由人在系統內管理,與模組 / 權限的 kill switch 同一模型)。因此 `setFieldEnabled` 對種子選項**限根組織操作者**;租戶操作者切種子選項回 `FORBIDDEN`(自訂選項照常可切)。這件事現在由 api 直接寫進每一列的 `canToggleEnabled`,前端不再自己判斷視角(#264)。
