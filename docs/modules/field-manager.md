# 欄位管理(技術)

- **模組 key**:`system.field-manager`
- **畫面**:Figma「Admin 欄位管理」(左類別清單+右選項表格,種子資料標示)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0005 多租戶隔離](../adr/0005-multi-tenant-isolation.md)
- **資料**:`field_categories`(全域 seed)、`fields`(orgId nullable:null=全域 seed、有值=租戶自訂)
- **UI 規格**:「來源」欄顯示「全域」或「<組織名稱> 自訂」(2026-09-09 定案;不用「租戶自訂」— 下層組織也可能自訂,且租戶為平台詞彙)
- **權限備忘**:新增類別走 code+PR(seed 冪等 upsert);seed 選項僅 `enabled` 可改;租戶自訂選項限本租戶可見;選項不可刪(舊資料對照),僅停用
- **使用者說明**:[system.field-manager.help.md](../../apps/admin/src/md/module-help/system.field-manager.help.md)

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

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                              | 它是哪一頁的什麼                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `system.field-manager.view`           | 看類別與選項(來源欄:全域 / <組織名稱> 自訂)                                                                    |
| `system.field-manager.create`         | 「新增選項」+ API(本組織自訂,`orgId` = 當前組織;`(categoryId, orgId, value)` 唯一;Figma「Overlay / 新增選項」) |
| `system.field-manager.edit`           | 編輯自訂選項的 label / order / description + API(種子選項只能改 `enabled`;`value` 建立後不可改)                |
| `system.field-manager.toggle-enabled` | 停用 / 啟用選項 + API(種子與自訂皆可;選項不可刪,舊資料要對照)                                                  |

審計動作:`field.create` / `field.edit` / `field.toggle-enabled`(`targetType = "field"`)。

## admin 畫面(#211)

`apps/admin/src/pages/system/FieldManagerPage/`(Figma「欄位管理」90:2、新增選項 211:176)。
左類別清單唯讀,右邊是所選類別的合併清單:顯示名稱、值、排序、**來源**、啟用開關、操作。

- **來源欄與「這一列能做什麼」集中在 `field-source.ts`**(`isSeedOption` / `fieldSourceView` /
  `canToggleOption` / `canEditOption`),表格與彈窗不自己解讀 `source`。可見範圍語意若之後改成
  向下繼承(看得到上層組織的自訂選項),要動的只有這個檔。
- **停用 / 啟用直接送**,不另開確認彈窗:可逆,而且只影響新填寫(既有資料不受影響)。
- **編輯彈窗只給自訂選項**;種子選項連彈窗都不開,操作欄改顯示「由系統管理員維護」。
- **`FIELD_VALUE_DUPLICATE` 標在「值」欄位上**(不是頁面 Alert),彈窗留著讓人改值。
- **根組織視角的判定是個暫時的近似**:種子選項的 `enabled` 是全域開關、api 限根組織,
  但 `me` 目前沒有「當前組織是不是根組織」的旗標,而查 `org(id)` 要 `system.org-manager.view`
  (欄位管理的操作者未必有)。前端改以「`me.modules` 裡有沒有根組織專屬模組
  (`system.module-manager` / `system.data-scope` / `system.org-manager.tenant-ops`)」判斷
  (`field-manager-permissions.ts` 的 `isRootPerspective`)。**它偏保守**:根組織裡只被授予
  欄位管理的人會看到唯讀的種子開關(api 其實會放行)。api 補上正式旗標後換掉那個函式即可。

## api 介面(#206;正本,前端引用不另寫解釋 — GQL-07)

```graphql
fieldCategories: FieldCategoriesPayload!           # 全域種子類別,依 seed 宣告順序
fields(categoryId: ID!): FieldsPayload!            # 合併清單,依 order 再依建立順序
createField(input: CreateFieldInput!): FieldPayload!
updateField(input: UpdateFieldInput!): FieldPayload!
setFieldEnabled(input: SetFieldEnabledInput!): FieldPayload!
```

兩個 query 回 GQL-03 的列表形狀 `{ items, totalCount }`(不分頁,`totalCount` 即 `items` 長度);三個 mutation 回 `FieldPayload { field: Field! }`(GQL-02)。#201 Interface design 寫的裸回 `[Field!]!` / `Field!` 是簡寫,主流程 2026-09-20 裁決:第 4 段四票一律照 GQL-02 / GQL-03 用 payload type。

**欄位語意**

- `Field.source`:`GLOBAL` = 全域種子(`orgId = null`)、`OWN` = **當前組織**自訂(`orgId = 操作者的當前組織`)。畫面「來源」欄的文案由前端依 `source` 組(`GLOBAL` → 「全域」、`OWN` → 「<組織名稱> 自訂」,組織名稱取自 session 的當前組織),api 不傳組織名。
- **合併清單的範圍 = 全域 + 當前組織,不是整個可見範圍**:下層組織 / 其他組織的自訂選項不會出現(所以根組織操作者也只看得到全域 + 根組織自己的)。
- `Field.enabled`:停用僅影響新填寫,既有資料不受影響;選項不可刪。

**缺席 / null 語意(GQL-06)**

- `CreateFieldInput.order` 缺席 / null = `0`;`description` 缺席 / null = 不寫。
- `UpdateFieldInput.label` / `order` 缺席 = 不動;`description` 缺席 = 不動、`null` = 清空。`value` 不在 input 內 — 建立後不可改。

**錯誤**

- `FIELD_VALUE_DUPLICATE`:同一類別下 `value` 重複 — 本組織已有,或與該類別的**全域**選項同 value(後者唯一索引擋不到,由 service 的表單驗證擋)。
- `FORBIDDEN`:`updateField` 碰種子選項(種子只能 `setFieldEnabled`);`setFieldEnabled` 碰**種子**選項而操作者不是根組織;任何 mutation 碰別的組織的自訂選項(不在合併清單內者一律 `NOT_FOUND`)。
- `NOT_FOUND`:類別或選項不在合併清單 / 可見範圍內。`VALIDATION_FAILED`:id 格式不對、`label` / `value` 空白。

**種子選項的 `enabled` 是全域開關(2026-09-20,#206 定案)**:`fields` 的全域種子只有一筆文件(`orgId = null`),切它等於對全平台生效,沒有「本組織生效」的覆寫資料結構(ADR-0002:`enabled` 是初始 seed 值欄位、由人在系統內管理,與模組 / 權限的 kill switch 同一模型)。因此 `setFieldEnabled` 對種子選項**限根組織操作者**;租戶操作者切種子選項回 `FORBIDDEN`(自訂選項照常可切)。前端據此把 `source = GLOBAL` 的列在非根組織視角下設為唯讀。
