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
  hasRule: Boolean! # 已設規則(見下)
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

**回傳欄位的語意**(GQL-07):

- `DataScopeTarget.hasRule`(#246):這個目標**已設規則** = 有規則文件**且 `rules` 非空**。
  整份覆蓋時送 `rules: []` 等於刪掉規則,之後留下的空文件**不算**已設 —— 判準與執行面一致
  (`DataScopeService.load`:`rules` 為空即視為沒有規則,查詢只剩租戶保底)。
  左清單的「已設規則」讀它,不必對每個目標各查一次 `dataScopeRule`。

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

### admin 頁面(#210;程式正本 `apps/admin/src/pages/system/DataScopePage/`)

- 純函式在 `apps/admin/src/lib/`:`data-scope-rule.ts`(型別目錄、編輯器狀態 ↔ api JSON、條件樹增刪改)
  與 `data-scope-issues.ts`(本地驗證、`RULE_INVALID` 的 `path` → 標在哪一格)。
  **型別 → 運算子 → 值來源那張表在 admin 重寫了一份**(STRUCT-01 不能 import api),改動時兩邊一起改。
- 條件樹節點**不帶自產 id**:位置(`rules[n]` + 往下的 `children[i]`)就是身分,與 api 回的 `path` 同一套座標。
- **UI 上限三層**(ADR-0008「任意深、UI 建議 3 層」):第三層的群組不再給「+ 群組」;資料結構本身不設限,
  更深的規則若由 api 回來仍讀得回、顯示得出來,只是不能再往下加。
- 新群組**一定帶一條條件列**(空群組會被 `EMPTY_GROUP` 拒絕,不讓它先出現在畫面上)。
- 動態值與靜態值在同一個「值」下拉裡(動態值排在最前面):選了動態值就取代整份靜態值,反之亦然。
- **「有沒有規則」沒有現成欄位**:左清單的「已設規則」目前是對每個目標各查一次 `dataScopeRule`
  (目標是 seed 宣告的小清單,成本可接受)。目標變多時的正解是 `DataScopeTarget` 上補 `hasRule`(待 #246)。
- **`demo_items_one` 的 seed 目前宣告 `fields: []`**,所以 enum 型別的條件在 dev 上驗不到
  (只有底座自動掛入的 org / user / date 基礎欄位);seed 補一個 enum 欄位待 #246。
- 未儲存就切換資料目標 → 放棄變更確認;`saveDataScopeRule` 成功後失效該 collection 的 `dataScopeRule`
  與 `dataScopeTargets`。動作按鈕依 `system.data-scope.edit`,只有 `.view` 時整個編輯器唯讀。

### 執行面的回傳語意(GQL-07:正本在此)

- **沒有規則命中操作者 = 不過濾**(只剩租戶保底),不是「什麼都看不到」
- 規則永遠以 `$and` 疊在租戶保底之內 — 規則只會讓看到的**變少**,保底不可關
- 規則套在 `SCOPED_QUERY_MIDDLEWARE` **整組**(與租戶保底同一組),**含寫入與刪除的查詢** — 看不到的資料也改不到 / 刪不到
- **`combineOp` 只作用在「命中同一個人的那幾條規則」之間**:`OR` = 聯集、`AND` = 交集;**只命中一條的人就只受那一條限制**,沒命中的規則不參與合成
- 套用對象比對的兩份事實:「指定組織」比 `memberOrgIds`(`org_user` 直接關聯)、「指定角色」比 `roleIds`(**啟用中**的角色 — 停用角色後規則立刻不再命中,與管理範圍同一條規則)
- **`rules: []` 不等於「從來沒設定過」**:整份覆蓋成空陣列 = 這個目標沒有規則(執行面只剩租戶保底),但 `dataScopeRule` 仍回一份 `rules: []` 的文件;`rule = null` 專指從來沒設定過
- 動態值在**查詢當下**代入正在查的人:`current-user` → 操作者 id、`current-user-orgs` → 操作者的**所屬組織**
  (`org_user` 的直接關聯,**不含**可見性開關展開的下層);代入後若是空集合,該條件命中不到任何資料(fail-closed)
- 規則只套**業務類** collection(`tenantScopePlugin({ kind: "business" })`);治理類(`orgs`)完全不受影響
