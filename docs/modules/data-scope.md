# 資料範圍(技術)

- **模組 key**:`system.data-scope`(掛系統管理群組,**根組織專屬**,租戶不可見)
- **畫面**:Figma「Screen / Admin 資料範圍」— 左資料目標清單、右規則編輯器;合成規則說明見畫布旁註記卡
- **相關 ADR**:[0008 資料範圍](../adr/0008-data-scope.md)(機制本體)、[0011 查詢與判斷流程](../adr/0011-permission-resolution-flow.md)
- **資料**:`data_scope_rules`(collection unique、combineOp、rules[{audience, filter}])
- **資料目標來源**:各模組 seed 的 `dataScopeTarget` 宣告(collection、中文名、描述、可篩欄位);基礎欄位由底座自動掛進欄位目錄
- **執行**:BaseRepository 查詢時套用 — 命中規則依 combineOp 合成,最外層恆 AND 租戶隔離保底;設定記憶體快取、儲存時作廢
- **UI 規則**:條件列 = 欄位(依目錄)→ 運算子(依型別)→ 值(依值來源,含動態值【操作者本人】【操作者的所屬組織】);巢狀群組任意深、UI 呈現建議 3 層;每層與頂層各有 AND/OR 切換
- **權限備忘**:整頁根組織專屬;未來若開放租戶,套用對象與值選擇器已天然受可見範圍限制,保底不可關
- **使用者說明**:[system.data-scope.help.md](../../apps/admin/src/md/module-help/system.data-scope.help.md)(根組織專屬模組 — help 讀者即系統管理員,可用平台詞彙)

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                 | 它是哪一頁的什麼                                                           |
| ------------------------ | -------------------------------------------------------------------------- |
| `system.data-scope.view` | 看資料目標清單與各目標的規則                                               |
| `system.data-scope.edit` | 規則編輯器「儲存」+ API(整份 `data_scope_rules` 覆蓋;儲存即作廢記憶體快取) |

執行面(第 4 段做):BaseRepository 對**業務類** collection(`tenantScopePlugin({ kind: "business" })`)套規則;第一個目標是示範模組1 的 `demo_items_one`;`users` / `orgs` 這類底座資料不做資料範圍。審計動作:`data-scope.edit`(`targetType = "data_scope_rule"`,`targetId` 為該 collection 的規則文件)。

## api 介面(#205;程式正本 `apps/api/src/data-scope/`)

```graphql
dataScopeTargets: DataScopeTargetsPayload!                          # { targets: [DataScopeTarget!]! }
dataScopeRule(collection: String!): DataScopeRulePayload!           # { rule: DataScopeRule }(rule = null → 尚無規則)
saveDataScopeRule(input: SaveDataScopeRuleInput!): SaveDataScopeRulePayload!   # { rule: DataScopeRule! }

type DataScopeTarget {
  collection: String! # 識別鍵(如 demo_items_one)
  name: String!
  description: String
  fields: [DataScopeTargetField!]! # seed 宣告的業務欄位在前、基礎欄位殿後
}

type DataScopeTargetField {
  name: String!
  label: String!
  type: DataScopeFieldType! # ORG / USER / DATE / ENUM
  options: [DataScopeFieldOption!]! # 只有 ENUM 非空
  isBase: Boolean! # 底座自動掛入的基礎欄位(非模組 seed 宣告)
}

type DataScopeRule {
  collection: String!
  combineOp: DataScopeCombineOp! # AND / OR
  rules: [DataScopeRuleEntry!]!
  updatedAt: DateTime!
}

type DataScopeRuleEntry {
  audience: DataScopeAudience! # { type: ALL | ROLE | ORG | USER, ids: [ID!]! }
  filter: JSONObject! # 條件樹(形狀見下)
}

input SaveDataScopeRuleInput {
  collection: String!
  combineOp: DataScopeCombineOp! = OR
  rules: [DataScopeRuleEntryInput!]! # 整份覆蓋;[] = 刪掉這個目標的規則
}
```

三者皆**根組織專屬**:`@RequirePermission` 先守權限(`.view` / `.edit`),service 再守「當前組織是根組織」
(判斷點 `OwnerProtectionService.isRootOperator`,與租戶作業、模組與權限同一個)— 權限可能經角色被帶到別的組織,
**站在哪裡**才是判準。不是根組織 → `FORBIDDEN`;不是 seed 宣告的資料目標 → `NOT_FOUND`;
規則不合法 → `RULE_INVALID`(GQL-04 已追加該列)。

### `rules[].filter` 的 JSON 形狀(admin #210 的條件樹編輯器照這份產)

節點只有兩種,靠欄位判別:**群組**有 `op` + `children`(任意深,UI 建議 3 層),**條件列**有 `field` + `cond` + `value`。

```jsonc
{
  "op": "AND", // 或 "OR";每一層各自可切
  "children": [
    {
      "field": "createdBy", // 必須在該目標的 fields 目錄內(含 isBase 的基礎欄位)
      "cond": "in", // 必須是該欄位型別允許的運算子
      "value": { "kind": "dynamic", "ref": "current-user" }, // 【操作者本人】
    },
    {
      "op": "OR",
      "children": [
        {
          "field": "orgId",
          "cond": "in",
          "value": { "kind": "dynamic", "ref": "current-user-orgs" }, // 【操作者的所屬組織】
        },
        {
          "field": "orgId",
          "cond": "not-in",
          "value": { "kind": "static", "values": ["66f0a1b2c3d4e5f60718293a"] },
        },
        {
          "field": "createdAt",
          "cond": "between",
          "value": { "kind": "static", "values": ["2026-01-01", "2026-12-31"] },
        },
      ],
    },
  ],
}
```

型別 → 運算子 → 值來源(ADR-0008 的表的執行期正本 `apps/api/src/data-scope/data-scope-rule.ts`):

| 型別   | `cond`                         | `value`                                                                                    |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `ORG`  | `in` / `not-in`                | `{ kind: "static", values: [組織 id] }` 或 `{ kind: "dynamic", ref: "current-user-orgs" }` |
| `USER` | `in` / `not-in`                | `{ kind: "static", values: [使用者 id] }` 或 `{ kind: "dynamic", ref: "current-user" }`    |
| `DATE` | `between` / `before` / `after` | `{ kind: "static", values: [ISO 日期] }`(`between` 剛好兩個,其餘一個);**無動態值**         |
| `ENUM` | `in` / `not-in`                | `{ kind: "static", values: [seed 宣告的選項 value] }`;**無動態值**                         |

`value.values` 一律是**字串陣列**(id、ISO 日期、enum value 都以字串送),型別轉換在 api 內完成。

### `RULE_INVALID` 的 `extensions`

`path` 指到條件樹裡出問題的位置(如 `rules[0].filter.children[1].value.values[0]`),
`reason` 是原因列舉;前端依 `reason` 顯示中文、把錯誤標在 `path` 指到的那一列。
一次只回第一個違規(整份覆蓋,修掉再送)。

| `reason`                   | 什麼情況                                                                    |
| -------------------------- | --------------------------------------------------------------------------- |
| `MALFORMED_RULE`           | `rules` 不是陣列、單筆不是物件、缺 `audience` / `filter`                    |
| `MALFORMED_NODE`           | 節點既不是群組也不是條件列,或 `op` / `field` 型別不對                       |
| `EMPTY_GROUP`              | 群組的 `children` 是空的                                                    |
| `UNKNOWN_FIELD`            | `field` 不在該目標的欄位目錄內                                              |
| `CONDITION_NOT_ALLOWED`    | `cond` 不是該欄位型別允許的                                                 |
| `VALUE_SOURCE_NOT_ALLOWED` | `value.kind` 不是 static / dynamic,或該型別不支援這個動態值                 |
| `VALUE_INVALID`            | 空清單、id 不是 ObjectId、日期解析不了、`between` 不是兩個、enum 不在選項內 |
| `AUDIENCE_INVALID`         | `audience.type` 不認得,或 `ALL` 以外沒給 `ids` / `ids` 不是 id              |

### 執行面的回傳語意(GQL-07:正本在此)

- **沒有規則命中操作者 = 不過濾**(只剩租戶保底),不是「什麼都看不到」
- 規則永遠以 `$and` 疊在租戶保底之內 — 規則只會讓看到的**變少**,保底不可關
- 動態值在**查詢當下**代入正在查的人:`current-user` → 操作者 id、`current-user-orgs` → 操作者的**所屬組織**
  (`org_user` 的直接關聯,**不含**可見性開關展開的下層);代入後若是空集合,該條件命中不到任何資料(fail-closed)
- 規則只套**業務類** collection(`tenantScopePlugin({ kind: "business" })`);治理類(`orgs`)完全不受影響
