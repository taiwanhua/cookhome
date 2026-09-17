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

| 類別 key | 類別名 | 選項 value | 選項 label | order |
|---|---|---|---|---|
| `gender` | 性別 | `male` | 男 | 1 |
| | | `female` | 女 | 2 |
| | | `other` | 其他 | 3 |
| | | `undisclosed` | 不透露 | 4 |
| `demo-category` | 示範分類 | `staple` | 主食 | 1 |
| | | `side-dish` | 小菜 | 2 |
| | | `drink` | 飲品 | 3 |

示範畫面上的「甜點」是租戶自訂選項的示意(orgId=租戶A),**不是種子**。

**種子選項的 key**:`<類別 key>.<value>`(如 `gender.male`、`demo-category.side-dish`),只給冪等識別用;租戶自訂選項沒有 key、以 `_id` 識別(`fields.key` 選填、sparse unique)。production 第一次 seed 後不可改。
**待辦(本模組實作時)**:同一類別、同一組織下 `value` 不可重複 — `(categoryId, orgId, value)` 唯一索引 + 表單驗證。
