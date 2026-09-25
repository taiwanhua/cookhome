# 資料模型地圖

底座所有 collection 的**總覽與導航**。欄位、型別、索引的細節**正本在程式碼**:`apps/api/src/database/schemas/*.schema.ts`(每欄有註解),此檔不重複,只給地圖與跨檔約定。

## Collection 一覽

「概念」欄指向說明該表運作方式的 `docs/concepts/` 檔(省略目錄):帳號 = `accounts-and-tenants.md`、授權 = `authorization.md`、資料層 = `data-layer-and-isolation.md`、儲存 = `storage-and-mail.md`。

| collection                          | 種子/業務                                                            | 用途                                                                                                             | 概念                    | schema 檔                         |
| ----------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- |
| `orgs`                              | 業務(根組織為種子)                                                   | 組織樹;資料隔離邊界;租戶頂層另有短碼 `slug`                                                                      | 帳號、資料層            | `org.schema.ts`                   |
| `users`                             | 業務                                                                 | 後台使用者帳號                                                                                                   | 帳號                    | `user.schema.ts`                  |
| `customers`                         | 業務                                                                 | 前台會員帳號                                                                                                     | 帳號                    | `customer.schema.ts`              |
| `roles`                             | 業務(種子角色除外)                                                   | 角色(權限集合);租戶副本以 `settings.templateKey` 標記來源                                                        | 授權、帳號              | `role.schema.ts`                  |
| `modules`                           | 種子                                                                 | 模組樹(= 頁面/側欄);`engine` 標固定欄位模組 / 表單模組                                                           | 授權                    | `module.schema.ts`                |
| `permissions`                       | 種子(`source: seed`)+ 業務(`source: dynamic`,表單發布建的欄位級權限) | 權限(頁面裡的按鈕/欄位)                                                                                          | 授權                    | `permission.schema.ts`            |
| `core_relationships`                | 業務(種子亦寫入:種子角色的 org_role、模板綁定)                       | 五實體的關聯(org_user/org_role/user_role/role_module/role_permission)+ 組織主管 `org_manager`                    | 資料層                  | `core-relationship.schema.ts`     |
| `business_relationships`            | 業務                                                                 | 業務關聯(`org_form` 表單分派 / 啟用、`org_workflow` 流程分派、`org_form_workflow` 流程綁定);以 `tenantId` 為邊界 | 資料層                  | `business-relationship.schema.ts` |
| `data_scope_rules`                  | 業務                                                                 | 資料範圍規則(一個目標至多一份)                                                                                   | 資料層                  | `data-scope-rule.schema.ts`       |
| `data_scope_targets`                | 種子                                                                 | 資料範圍目標(頁面左側清單來源;一列 = 一個模組)                                                                   | 資料層                  | `data-scope-target.schema.ts`     |
| `field_categories`                  | 種子(全域)                                                           | 欄位類別                                                                                                         | 資料層                  | `field-category.schema.ts`        |
| `fields`                            | 種子(全域)+ 業務(租戶自訂)                                           | 欄位選項                                                                                                         | 資料層                  | `field.schema.ts`                 |
| `refresh_tokens`                    | 業務                                                                 | 登入 refresh token(存雜湊)                                                                                       | 帳號                    | `refresh-token.schema.ts`         |
| `action_tokens`                     | 業務                                                                 | 啟用信 / 重設密碼 token(單次、TTL)                                                                               | 帳號                    | `action-token.schema.ts`          |
| `audit_logs`                        | 業務                                                                 | 稽核日誌(只增不改)                                                                                               | 授權                    | `audit-log.schema.ts`             |
| `demo_items_one` / `demo_items_two` | 種子(宣告的幾筆)+ 業務                                               | 示範模組資料(模組資料表)                                                                                         | 各自的模組文件          | `demo-item-*.schema.ts`           |
| `forms`                             | 業務                                                                 | 表單(一種填報的身分;共用 `ownerOrgId = null`、客製 = 租戶頂層)                                                   | `docs/modules/forms.md` | `form.schema.ts`                  |
| `form_versions`                     | 業務                                                                 | 表單版本(草稿 / 發布中 / 已發布 / 已退役;欄位、版面、摘要槽、帶入規則)                                           | `docs/modules/forms.md` | `form-version.schema.ts`          |
| `form_submissions`                  | 業務                                                                 | 表單提交(所有表單模組共用的模組資料表;值、摘要、修訂快照;走過流程者另記目前實例、阻擋、作廢)                     | `docs/modules/forms.md` | `form-submission.schema.ts`       |
| `workflows`                         | 業務                                                                 | 審核流程(共用 `ownerOrgId = tenantId = null`、客製 = 租戶頂層);以 `tenantId` 為邊界                              | `@repo/domain/workflow` | `workflow.schema.ts`              |
| `workflow_versions`                 | 業務                                                                 | 流程版本(生命週期同表單版本;`steps[]` 節點 + `edges[]` 連線)                                                     | `@repo/domain/workflow` | `workflow-version.schema.ts`      |
| `workflow_instances`                | 業務                                                                 | 流程實例(一筆提交的一個修訂號送出一次;**唯一權威**:關卡狀態、派任計畫、已接受的決定)                             | `@repo/domain/workflow` | `workflow-instance.schema.ts`     |
| `workflow_tasks`                    | 業務                                                                 | 審核任務(實例派任計畫一項的投影;「待我審核」與讀取授權用);以 `tenantId` 為邊界                                   | `@repo/domain/workflow` | `workflow-task.schema.ts`         |

## 全表共通

- **基礎欄位**:`createdAt` `updatedAt` `createdBy` `updatedBy` `deletedAt`(軟刪除)。五個欄位全部由 `baseFieldsPlugin` 掛上與自動填(timestamps 也是,schema class 不宣告);哪些 collection 受租戶過濾見 `docs/concepts/data-layer-and-isolation.md`「三類資料」。
- **租戶隔離**:業務 collection 掛 `orgId`,查詢一律經 BaseRepository 自動過濾,禁裸 `Model.find`。
- **模組資料表**(schema 明確開 `tenantScopePlugin({ moduleData: true })` 的表:`demo_items_one`、`demo_items_two`、`form_submissions`、`workflow_instances` 與之後每張模組資料表)另有兩欄,由 plugin 一併宣告並建索引 `(tenantId, moduleKey, createdAt)`、`(moduleKey, orgId)`:`moduleKey`(必填,這筆屬於哪個模組;固定欄位模組寫死自己的 key)與 `tenantId`(租戶頂層 `orgs` id,`BaseRepository.create` 依 `orgId` 的祖先推導,根組織的資料為 null,呼叫端給的值一律覆蓋;兩欄建立後不可經一般更新改動)。`tenantId` 只用於租戶邊界、索引與日後分片,**不決定可見範圍**(可見範圍仍看 `orgId`)。這個選項不綁 `kind: "business"`:`fields`、`audit_logs`、`customers` 也是業務類,但不是模組資料,沒有這兩欄。
- **種子 vs 業務**:種子由 seed 以 key 冪等 upsert(`apps/db-migrator/seeds/`);業務資料不做跨環境搬移。
- **索引**:各 schema 檔以 `.index(...)` 就地宣告(唯一鍵、orgId 複合、ancestors、TTL 等)。

## 跨檔約定(語意正本不在 schema 的幾處)

- **`fields` 的唯一索引是 `(categoryId, orgId, value)`**(`field.schema.ts`):全域種子那筆 `orgId = null`,所以「自訂選項與**同類別的全域選項**同 `value`」索引擋不到,由 service 的表單驗證擋(同回 `FIELD_VALUE_DUPLICATE`)。規則與種子內容的正本:`docs/modules/field-manager.md`。
- **`modules` 執行期只有兩個可變欄位**(`module.schema.ts`):`enabled`(停用 / 啟用,連動子樹)與 `icon`(側欄圖示 key)。兩者都是**初始 seed 值的欄位** —— seed 只在建立時、或既有文件**沒有這一欄**時寫初值,有值就不覆蓋(`docs/concepts/data-layer-and-isolation.md`「種子資料與遷移」)。`icon` 的白名單正本是 `@repo/domain/module-icon` 的 `MODULE_ICON_KEYS`(前後端共用,schema 刻意不寫成 mongoose `enum` 以免抄成第二份),`null` = 側欄用預設圖示;初值對照表與規則見 `docs/modules/module-manager.md`「側欄圖示」。
- **`demo_items_one` 的附件是四個平行欄位**(`demo-item-one.schema.ts`):`attachmentPath` + `attachmentName` / `attachmentSize` / `attachmentContentType`(原始檔名 / bytes / 檔型,前端申報、api 只驗形狀)。**四欄同生同滅**(換檔一起 `$set`、清空一起 `$unset`)。只有 `attachmentPath` 的資料,api 對後三者回 `null`、前端退回顯示路徑尾段,所以不需要 migration。選平行欄位而非巢狀 `attachment` 物件,就是為了不搬既有資料。對外形狀(`attachment { path, name, size, contentType }`)正本見 `docs/modules/demo.sub.sample-one.md`「api 介面」。
- **`data_scope_targets` / `data_scope_rules` 的識別鍵是 `(collection, moduleKey)`**(兩張表各一個唯一索引):同一張表可以有多個模組各一個目標、各一份規則(所有表單模組共用 `form_submissions`)。目標由 seed 依模組宣告登記,`moduleKey` 由 seed runner 填宣告檔所在的模組;查詢時的依模組 `$or` 見 `docs/modules/data-scope.md`「依模組」。
- **`business_relationships` 不掛 `tenantScopePlugin`**(`business-relationship.schema.ts`):部門使用者的可見範圍不含租戶頂層,掛了就查不到本租戶的列。邊界改成必填的 `tenantId`,存取只經 `BusinessRelationshipsRepository`(每個方法強制帶 `tenantId`,沒帶就拋錯;租戶內的操作者只能用自己的租戶、根組織操作者要明給目標租戶)。`type` 是封閉 enum,`tenantId` = `firstId` = 租戶頂層:`org_form`(`secondId` = 表單、`meta = { enabled }`)、`org_workflow`(`secondId` = 流程、`meta = {}`)、`org_form_workflow`(三方:`secondId` = 表單、`thirdId` = 流程、`meta = {}`;沒有這筆 = 不走流程、換流程 = 改 `thirdId`)。唯一索引 `(tenantId, type, firstId, secondId)`:同租戶同表單最多綁一個流程,`thirdId` 不在鍵裡,所以多張表單可以綁同一個流程,不另加索引。
- **`permissions.source`**(`permission.schema.ts`):`seed` = 模組 seed 宣告、`dynamic` = 執行期產生(表單發布建的欄位級權限)。seed runner 只比對 / 更新 `source` 不是 `dynamic` 的文件,不刪不認識的;`retiredAt` 是 `dynamic` 權限退役時間(`null` = 使用中)。
- **`modules.engine`**(`module.schema.ts`):`fixed`(固定欄位模組,預設)/ `form`(表單模組);由 seed 宣告 `engine: "form"`,每次 seed 都同步宣告值,不在系統內改。
- **`orgs.slug`**(`org.schema.ts`):只有租戶頂層有;格式 `^[a-z][a-z0-9_]{1,19}$`(正本 `@repo/domain/form` 的 `ORG_SLUG_PATTERN`)、唯一稀疏索引;開通時填,根組織可在組織編輯改。
- **`forms` / `form_versions` 不掛 `tenantScopePlugin`**(`form.schema.ts` / `form-version.schema.ts`):表單沒有 `orgId`,誰看得到哪一張由 `forms.ownerOrgId` + `org_form` 決定(`apps/api/src/forms/form-access.service.ts`),版本跟著表單走。`forms.key` 全域唯一且建立後不可改;`currentVersion` 是填寫者唯一看的指標(發布步驟 4 的最後一筆寫入)。
- **`form_versions` 的兩條部分唯一索引**:`(formKey, version)` 只在 `version` 是數字時唯一(草稿的 `null` 不算,正式版號在發布步驟 2 搶鎖時配);`(formKey, status)` 限 `draft` 與 `publishing` 各一筆(拆成兩條只用等值條件的部分索引,key 方向不同以免同形索引互撞)。定義四塊(`fields` / `layout` / `summaryMap` / `prefills`)存自由 JSON,形狀正本是 `@repo/domain/form` 的型別。
- **`form_submissions` 的值與修訂**(`form-submission.schema.ts`):`values` 依欄位型別存(正本 Spec 6a §5「值的存法」與 `docs/modules/forms.md`),受保護欄位原值照存、讀取時投影為 `"[redacted]"`;`revisions[]` 每筆 `{ revision, values, ctx: { at, timezone, userId, orgId } }` 是**完整值快照**;`editVersion` 是每次寫入的樂觀鎖;`(createdBy, clientRequestId)` 唯一(含已軟刪除的,重用 id 一律拒絕)。`moduleKey` = 綁的表單所屬模組。
- **欄位級權限的 key**:`<moduleKey>.show-<formKey>-<fieldKey>` / `<moduleKey>.edit-<formKey>-<fieldKey>`(`source: dynamic`,`name` =「<表單名> / <欄位 label> 可見 / 可改」),發布步驟 3 建 / 復活 / 退役;退役的只由「模組與權限」頁的清理刪除(硬刪權限列與 `role_permission` 綁定)。權限矩陣與模組樹不列 `retiredAt` 有值的權限。
- **`core_relationships` 的 `org_manager`**(`core-relationship.schema.ts`):`firstId` = 組織、`secondId` = 使用者,一個組織多筆 = 多位主管,唯一沿用 `(type, firstId, secondId, thirdId)`。第二方是 users 但語意是「主管」而不是成員(命名規約的例外,見 ADR-0001),與 `org_user` 分開存:主管不必是該組織的直接成員,但必須是本租戶的使用者。組織管理頁整組取代(`setOrgManagers`,稽核 `org.set-managers`)。審核流程的主管解析從**提交的 `orgId`** 往上、上界是提交的 `tenantId`,剔除申請人、只算啟用中且仍在本租戶的人(`OrgManagersService.resolveManagers`)。
- **`form_submissions` 的 6b 欄位**(`form-submission.schema.ts`):`status` 七值(`draft` / `reviewing` / `returned` / `withdrawn` / `completed` / `rejected` / `voided`,正本 `@repo/domain/workflow` 的 `SUBMISSION_STATUSES`);`currentInstanceId` 為 null = 沒走過流程(`completed` 後可修改),有值 = 走過(`completed` 後鎖定、只能作廢);`blocked` = 實例被阻擋;`voidedAt` / `voidedBy` / `voidReason` / `replacedById` 是作廢資訊。
- **`workflows` / `workflow_tasks` 不掛 `tenantScopePlugin`**(`workflow.schema.ts` / `workflow-task.schema.ts`):兩者都沒有 `orgId`,而審核者不一定在申請人組織的可見範圍內;邊界是 `tenantId`,存取只經 `WorkflowsRepository` / `WorkflowTasksRepository`(兩者都不准經 `BaseRepository` 建)。`workflows` 的 `tenantId` = `ownerOrgId`,共用流程是 `null` —— 查共用要**明給 `null`**,沒給(`undefined`)一律拋錯;租戶看得到的流程 = 自己的客製 + `org_workflow` 分派來的共用。`workflows.key` 全域唯一、建立後不可改。`workflow_tasks` 的 `tenantId` 必填,唯一 `(instanceId, taskKey)`,另有 `(assigneeId, status)`、`(tenantId, moduleKey, status)`、`(previousAssigneeIds)`。
- **`workflow_versions`** 與 `form_versions` 同一套部分唯一索引(版號只在是數字時唯一、`draft` / `publishing` 各至多一筆);`steps[]` / `edges[]` 存自由 JSON,形狀正本是 `@repo/domain/workflow` 的 `StepDef` / `WorkflowEdge`(沒有 `edges` = 直線,依 `steps[]` 順序)。
- **`workflow_instances` 是唯一權威**(`workflow-instance.schema.ts`):`steps[]` 每關一筆 `StepState`(`stepKey` / `status` / `blocked` / `plan[]` 派任計畫 / `decisions[]` 已接受的決定,陣列順序 = 接受順序)、`activeStepKeys[]`、`editVersion`(每次狀態改變 +1,CAS 用)、`outcome`(全案終局採用的那筆決定,只能從 null 寫一次)、`history[]`(`notified` 事件帶 `result` 當通知標記)、`linkSource`(送出時依據的草稿與流程版本)、`summary`(該修訂的摘要槽快照,任務列表 / 通知讀它)。唯一 `(submissionId, revision)`、索引 `(tenantId, status)`;模組資料表的四個基礎欄位抄自提交,資料範圍規則不套(沒有宣告目標)。任務只是投影,狀態由 `@repo/domain/workflow` 的 `advance` 判斷表依實例同步。
- **`data_scope_rules.rules[]` 的形狀**(`audience` + `filter` 條件樹的節點種類、型別 → 運算子 → 值來源、`RULE_INVALID` 的 `path` / `reason`)正本在 `docs/modules/data-scope.md`,schema 只把 `filter` 存成自由 JSON;機制見 `docs/concepts/data-layer-and-isolation.md`「資料範圍規則」。

## 種子清單

modules(含表單模組範例「購物清單」`shopping-list`(不綁流程的對照組)與「請假」`leave`、表單管理 `system.forms`、流程管理 `system.workflows`(隱藏頁 `blocked-page` 自有改派權限)、申請中心 `apply-center`(隱藏頁 `view-page`))、permissions(`source: seed`)、field_categories、fields(全域)、種子 roles(super-admin、租戶管理員模板)與其綁定、根組織、root 初始帳號、data_scope_targets、示範資料。宣告正本是 `apps/db-migrator/seeds/registry.ts`;內容見 `docs/modules/*.md`(權限表)與 `docs/modules/field-manager.md`(欄位選項)。

## 預留(尚未建,程式碼無)

### `auth_identities`(第三方登入綁定;會員線開發時啟用)

| 欄位           | 型別                    | 備註                                                 |
| -------------- | ----------------------- | ---------------------------------------------------- |
| accountType    | enum:`user`\|`customer` | 固定從屬:指向哪張帳號表                              |
| accountId      | ObjectId                | = 該帳號文件的 `_id`(主鍵),**不是** account 登入欄位 |
| provider       | enum(如 `google`)       | `password` 不進此表(密碼留帳號表 passwordHash)       |
| providerUserId | string                  | 第三方使用者識別(Google=`sub`)                       |
| email          | string?                 | 第三方回傳,綁定比對輔助,不作登入識別                 |
| meta           | object?                 | 顯示名、頭像 URL 等                                  |

索引:unique(provider, providerUserId)/ unique(accountType, accountId, provider)/(accountType, accountId)。不掛 orgId、不進租戶過濾(帳號為平台級)。決策見 ADR-0003。

### `oauth_clients` + scope 目錄

第一個串接方出現時隨 node-oidc-provider 建(ADR-0006)。
