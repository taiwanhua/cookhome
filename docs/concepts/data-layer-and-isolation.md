# 資料層與租戶隔離(現況說明)

回答「資料分幾類、誰看得到哪些、怎麼保證繞不過」。決策理由見 ADR-0001(核心關聯)、ADR-0002(種子與遷移)、ADR-0005(多租戶隔離)、ADR-0007(基礎欄位)、ADR-0008(資料範圍)。collection 一覽見 `docs/data-model.md`。

## 三類資料

| 類別         | 判定                              | 過濾                              | 例                                                                                                     |
| ------------ | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 租戶資料     | 有 `orgId`,掛 `tenantScopePlugin` | 自動過濾                          | `customers`、`fields`(租戶自訂)、`audit_logs`、`demo_items_*`、`form_submissions`;`orgs` 以 `_id` 判定 |
| 全域資料     | 不掛 plugin                       | 不過濾                            | `modules`、`permissions`、`field_categories`、`data_scope_targets`                                     |
| 關聯歸屬資料 | 沒有 `orgId`,歸屬走核心關聯       | 資料層不過濾;模組先查關聯再查本表 | `users`(經 `org_user`)、`roles`(經 `org_role`)                                                         |

- 哪些 schema 掛了 plugin 由測試鎖定。
- `fields` 掛 `allowGlobal`:`orgId = null` 的全域種子對所有人可見。
- **模組資料表**:schema 明確開 `tenantScopePlugin({ moduleData: true })` 的租戶資料(`demo_items_one`、`demo_items_two`、`form_submissions`),多兩個欄位 `moduleKey`(必填;固定欄位模組寫死自己的 key,表單提交寫綁的模組)與 `tenantId`(依 `orgId` 的祖先推導的租戶頂層,根組織資料為 null;前端不可指定、一般更新不可改)。`tenantId` 只用於租戶邊界、索引與日後分片,**不決定可見範圍**(仍看 `orgId`)。資料範圍規則只套模組資料表。
- **業務關聯**(`business_relationships`,目前只有 `org_form`)不掛 plugin:部門使用者的可見範圍不含租戶頂層,掛了就查不到本租戶的列。改以必填的 `tenantId` 為邊界,`BusinessRelationshipsRepository` 每個方法強制帶它(沒帶就拋錯;租戶內只能用自己的,根組織要明給)。

正本:`apps/api/src/database/plugins/tenant-scope.plugin.ts`、`apps/api/src/database/schemas/`

## 核心關聯

五個實體(Org / User / Role / Module / Permission)之間的多對多,集中在一張 `core_relationships`。

| type              | first → second | 意思                 |
| ----------------- | -------------- | -------------------- |
| `org_user`        | 組織 → 使用者  | 所屬組織             |
| `org_role`        | 組織 → 角色    | 擁有組織(每角色一筆) |
| `user_role`       | 使用者 → 角色  | 角色授予             |
| `role_module`     | 角色 → 模組    | 可進的頁             |
| `role_permission` | 角色 → 權限    | 頁裡能用的           |

- 唯一出口是 `RelationService` 的具名方法(如 `addUserToOrg`、`assignRoleToUser`)。BaseRepository 建構時拒收這張表。
- 讀不帶操作者上下文(權限解析要先讀關聯);寫帶上下文,填 `createdBy` / `updatedBy`。
- 移除 = 硬刪除。表只存現況,歷史在 `audit_logs`。
- 固定從屬用欄位,不進此表(如 `permissions.moduleId`)。
- 批次原語:`linkMany`(重複即拋錯)、`ensureLinks`(冪等)、`unlinkMany`。
- 業務域(如食譜)的關聯各自建具名 collection。

正本:`apps/api/src/database/relation.service.ts`、`apps/api/src/database/schemas/core-relationship.schema.ts`

## 基礎欄位、軟刪除、更新保護

- 每張表由 `baseFieldsPlugin` 掛上 `createdAt`、`updatedAt`、`createdBy`、`updatedBy`、`deletedAt`。schema class 不宣告。
- 刪除 = 寫 `deletedAt`。之後查詢預設排除;要看已刪除的明講 `includeDeleted`。
- 已刪除的不能再更新。
- 唯一的硬刪除 `hardDeleteById` 只給**補償刪除**用(本次請求剛建、尚未對外可見的文件)。其餘抹除走 cleanup migration。
- `updateById` / `updateMany` 碰到 `orgId`、`createdBy`、`createdAt`(含子路徑)→ 拋錯。
- 各表的偏好設定統一叫 `settings`,已知 key 在程式裡定義。
- 高敏個資(`nationalId`)欄位級加密(AES-256-GCM,金鑰 `FIELD_ENCRYPTION_KEY`),預設不投影。

正本:`apps/api/src/database/plugins/base-fields.plugin.ts`、`apps/api/src/database/base.repository.ts`、`apps/api/src/database/plugins/field-encryption.plugin.ts`

## 租戶隔離怎麼繞不過

```
service 呼叫 BaseRepository.xxx(operator, …)
  → scopeQuery 把操作者上下文掛到 Query
  → tenantScopePlugin 中介層:
       沒有上下文 → 拋錯(fail-closed)
       $and { orgId ∈ 範圍 }          ← 租戶保底
       $and { 資料範圍規則的條件 }    ← 只對模組資料表,依 moduleKey 拼 $or
```

- 讀、寫、刪的查詢中介層都套(`find`、`updateOne`、`deleteMany`…)。
- 條件以 `$and` 追加,呼叫端自己的條件只能再收窄。
- 範圍是 `"all"`(根組織)時不加租戶條件。
- `create` 自動寫入當前組織;寫到範圍外 → 拋錯。
- api 內裸 `Model.find` 由 ESLint 規則 `@repo/no-raw-model-query` 擋下。
- 已知限制:`populate()` 的子查詢不帶上下文,關聯資料分兩次查。
- **兩個登記在案的例外出口**(ADR-0005 / ADR-0008):
  - `BaseRepository.findOwnById` / `findOwnOne` / `findOwnAndUpdate`:只給表單提交用 —— 建立者讀自己的單、寫自己的草稿。可見範圍照套、條件加 `createdBy = 操作者`,**不套資料範圍規則**(否則規則把草稿擋掉時,建立者連自己的草稿都送不出去)。列表不放寬。
  - `apps/api/src/database/form-submission-usage.ts`:退役欄位級權限清理的三層檢查要**跨全部租戶**計數提交(少算一筆草稿就會把還在用的權限刪掉),不經 BaseRepository;只回筆數與版本號,不回內容。

正本:`apps/api/src/database/base.repository.ts`、`apps/api/src/database/operator-context.ts`、`apps/api/src/database/plugins/tenant-scope.plugin.ts`

## 操作者上下文的四個集合

BaseRepository 每個方法的第一個參數。四個集合各有用途,不可互相代用:

| 集合            | 內容                                   | 誰用                                                |
| --------------- | -------------------------------------- | --------------------------------------------------- |
| `managedOrgIds` | 啟用中角色的擁有組織子樹聯集(管理範圍) | 治理類過濾(`orgs`)、角色 / 使用者候選               |
| `visibleOrgIds` | 所屬組織,開關 ON 時各含下層(可見範圍)  | 業務類的租戶保底                                    |
| `memberOrgIds`  | `org_user` 直接關聯,不含下層           | 資料範圍:套用對象「指定組織」、【操作者的所屬組織】 |
| `roleIds`       | 啟用中角色                             | 資料範圍:套用對象「指定角色」                       |

- 另有 `actorId`(操作者)與 `currentOrgId`(當前組織)。
- 根組織成員的可見範圍 = `"all"`;持超級管理員或擁有組織為根的角色,管理範圍 = `"all"`。
- 治理類 / 業務類寫在 schema 上(`kind: "governance" | "business"`),不在呼叫端選。

正本:`apps/api/src/auth/operator-context.service.ts`、`apps/api/src/database/operator-context.ts`

## 管理範圍 vs 可見範圍

| 範圍     | 誰決定                          | 管什麼                                              | 受可見性開關影響 |
| -------- | ------------------------------- | --------------------------------------------------- | ---------------- |
| 管理範圍 | 持有角色的擁有組織              | 治理模組:組織樹的根、使用者清單、角色候選、搬移候選 | 否               |
| 可見範圍 | 所屬組織 + 租戶頂層的可見性開關 | 業務資料看多少(資料範圍規則在其中再縮小)            | 是               |

- 可見性開關:租戶頂層的 `settings.visibility`,`"own"`(預設)或 `"subtree"`。只看租戶頂層的值,套整棵租戶。
- 開關不影響治理頁、角色資格、管理範圍,切換不觸發重算。
- 治理頁攤開整個管理範圍;業務頁慣例上預設篩當前組織,新資料寫入當前組織。
- 要給不同管理範圍就建不同擁有組織的角色。

正本:`apps/api/src/auth/operator-context.service.ts`、`docs/testing/permission-scenarios.md` 劇本 12 / 14

## 資料範圍規則

權限管「能做什麼」,資料範圍管「看得到哪些資料的上限」。兩者分離;`*` 不影響資料範圍。

- 資料目標以 `(collection, moduleKey)` 為鍵:**一個模組一個目標**,同一張表可以有多個模組各一份(所有表單模組共用 `form_submissions`)。每個資料目標一份設定:`combineOp` + `rules[]`。
- 一條規則 = 套用對象(`all` / `role` / `org` / `user`)+ 過濾條件(巢狀 AND / OR 樹)。
- 沒有規則命中操作者 → 不過濾(= 可見範圍內)。
- 多條命中:`OR`(預設)取聯集;`AND` 取交集。沒命中的規則不影響他。
- 動態值:`current-user`(【操作者本人】)、`current-user-orgs`(【操作者的所屬組織】)。算不出對象 → 命中不到任何資料(fail-closed)。
- 套在整組查詢中介層,含寫入與刪除:看不到的也改不到。
- 只套模組資料表(`moduleData`);治理類與非模組資料的業務類(`fields`、`audit_logs`、`customers`)不套。未宣告資料目標的模組不會有規則。
- 執行面:查某 collection 時,把該 collection 下命中操作者的規則依模組拼成 `$or`(沒規則的模組 `moduleKey ∉ [有規則的模組]` 只看可見範圍;有規則的 `moduleKey = M` 且套 M 的規則),再與租戶保底 `$and`。固定欄位表只有一個 `moduleKey`,等於單一規則。
- 設定快取在記憶體(外層 collection、內層 moduleKey),儲存時作廢該 collection;多實例之間不同步。
- 欄位目錄:seed 宣告的業務欄位 + 底座自動掛的六個基礎欄位(`orgId`、`createdBy`、`updatedBy`、三個時間)。

| 欄位型別 | 運算子                   | 值來源                            |
| -------- | ------------------------ | --------------------------------- |
| org      | in / not-in              | 組織選擇器,或【操作者的所屬組織】 |
| user     | in / not-in              | 使用者選擇器,或【操作者本人】     |
| date     | between / before / after | 日期                              |
| enum     | in / not-in              | seed 宣告的選項                   |

正本:`apps/api/src/data-scope/data-scope-rule.ts`、`apps/api/src/data-scope/data-scope.service.ts`、`apps/api/src/database/plugins/data-scope-provider.ts`、`docs/modules/data-scope.md`「執行面的回傳語意」

## 種子資料與遷移

| 種類     | 是什麼                                                     | 怎麼同步                                          |
| -------- | ---------------------------------------------------------- | ------------------------------------------------- |
| 種子資料 | 模組、權限、種子角色、欄位管理、根組織、資料目標、示範資料 | 以 kebab-case `key` 冪等 upsert,id 各環境各自生成 |
| 業務資料 | 帳號、角色副本、租戶資料                                   | 不跨環境搬;要重現用整庫 dump / restore            |
| 遷移     | 索引、結構、回填、清理                                     | migrate-mongo,一次性,記在 `changelog`             |

- 部署 api 後依序跑 `migrate` → `seed`。不在 server 啟動時跑。
- 種子欄位兩種:**每次都 seed**(預設,人改的會被拉回);**初始 seed 值**(欄位存在就不覆寫,預設 `enabled`,`modules` 另加 `icon`)。
- 可變欄位清空寫 `null`,不要 `$unset`。
- key 是識別不是欄位;改 key = 新種一筆,要配 cleanup migration。
- seed 不分環境;seed 以原生 driver 寫,不 import api。
- root 初始帳號從 `ROOT_ADMIN_*` 環境變數建立,只在不存在時建。
- 遷移檔名 `<14 位時間戳>_<schema|data|cleanup>_<kebab 描述>.js`,由測試強制。

| reset 模式 | 做什麼                                       | 人調過的 `enabled` / `icon` |
| ---------- | -------------------------------------------- | --------------------------- |
| `full`     | drop → migrate → seed                        | 回到宣告值                  |
| `data`     | 刪人建的資料(判準:識別鍵不在 registry)→ seed | 保留                        |

- 只給 dev / staging;production 永遠拒絕。安全閥三道:`--confirm` = 資料庫名、資料庫名推得環境、`RESET_ALLOW_ENV` 含該環境。
- 用法與 workflow 見 `docs/deployment.md`「資料庫還原(reset)」。

正本:`apps/db-migrator/src/seed/seed-runner.ts`、`apps/db-migrator/seeds/registry.ts`、`apps/db-migrator/src/reset/reset-plan.ts`、`apps/db-migrator/src/reset/reset-safety.ts`、`apps/db-migrator/src/migration-filename.ts`
