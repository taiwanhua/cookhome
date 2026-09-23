# 資料模型地圖

底座所有 collection 的**總覽與導航**。欄位、型別、索引的細節**正本在程式碼**:`apps/api/src/database/schemas/*.schema.ts`(每欄有註解),此檔不重複,只給地圖與跨檔約定。

## Collection 一覽

「概念」欄指向說明該表運作方式的 `docs/concepts/` 檔(省略目錄):帳號 = `accounts-and-tenants.md`、授權 = `authorization.md`、資料層 = `data-layer-and-isolation.md`、儲存 = `storage-and-mail.md`。

| collection                          | 種子/業務                                      | 用途                                                                  | 概念           | schema 檔                     |
| ----------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- | -------------- | ----------------------------- |
| `orgs`                              | 業務(根組織為種子)                             | 組織樹;資料隔離邊界                                                   | 帳號、資料層   | `org.schema.ts`               |
| `users`                             | 業務                                           | 後台使用者帳號                                                        | 帳號           | `user.schema.ts`              |
| `customers`                         | 業務                                           | 前台會員帳號                                                          | 帳號           | `customer.schema.ts`          |
| `roles`                             | 業務(種子角色除外)                             | 角色(權限集合);租戶副本以 `settings.templateKey` 標記來源             | 授權、帳號     | `role.schema.ts`              |
| `modules`                           | 種子                                           | 模組樹(= 頁面/側欄)                                                   | 授權           | `module.schema.ts`            |
| `permissions`                       | 種子                                           | 權限(頁面裡的按鈕/欄位)                                               | 授權           | `permission.schema.ts`        |
| `core_relationships`                | 業務(種子亦寫入:種子角色的 org_role、模板綁定) | 五實體的關聯(org_user/org_role/user_role/role_module/role_permission) | 資料層         | `core-relationship.schema.ts` |
| `data_scope_rules`                  | 業務                                           | 資料範圍規則                                                          | 資料層         | `data-scope-rule.schema.ts`   |
| `data_scope_targets`                | 種子                                           | 資料範圍目標(頁面左側清單來源)                                        | 資料層         | `data-scope-target.schema.ts` |
| `field_categories`                  | 種子(全域)                                     | 欄位類別                                                              | 資料層         | `field-category.schema.ts`    |
| `fields`                            | 種子(全域)+ 業務(租戶自訂)                     | 欄位選項                                                              | 資料層         | `field.schema.ts`             |
| `refresh_tokens`                    | 業務                                           | 登入 refresh token(存雜湊)                                            | 帳號           | `refresh-token.schema.ts`     |
| `action_tokens`                     | 業務                                           | 啟用信 / 重設密碼 token(單次、TTL)                                    | 帳號           | `action-token.schema.ts`      |
| `audit_logs`                        | 業務                                           | 稽核日誌(只增不改)                                                    | 授權           | `audit-log.schema.ts`         |
| `demo_items_one` / `demo_items_two` | 種子(宣告的幾筆)+ 業務                         | 示範模組資料                                                          | 各自的模組文件 | `demo-item-*.schema.ts`       |

## 全表共通

- **基礎欄位**:`createdAt` `updatedAt` `createdBy` `updatedBy` `deletedAt`(軟刪除)。五個欄位全部由 `baseFieldsPlugin` 掛上與自動填(timestamps 也是,schema class 不宣告);哪些 collection 受租戶過濾見 `docs/concepts/data-layer-and-isolation.md`「三類資料」。
- **租戶隔離**:業務 collection 掛 `orgId`,查詢一律經 BaseRepository 自動過濾,禁裸 `Model.find`。
- **種子 vs 業務**:種子由 seed 以 key 冪等 upsert(`apps/db-migrator/seeds/`);業務資料不做跨環境搬移。
- **索引**:各 schema 檔以 `.index(...)` 就地宣告(唯一鍵、orgId 複合、ancestors、TTL 等)。

## 跨檔約定(語意正本不在 schema 的幾處)

- **`fields` 的唯一索引是 `(categoryId, orgId, value)`**(`field.schema.ts`):全域種子那筆 `orgId = null`,所以「自訂選項與**同類別的全域選項**同 `value`」索引擋不到,由 service 的表單驗證擋(同回 `FIELD_VALUE_DUPLICATE`)。規則與種子內容的正本:`docs/modules/field-manager.md`。
- **`modules` 執行期只有兩個可變欄位**(`module.schema.ts`):`enabled`(停用 / 啟用,連動子樹)與 `icon`(側欄圖示 key)。兩者都是**初始 seed 值的欄位** —— seed 只在建立時、或既有文件**沒有這一欄**時寫初值,有值就不覆蓋(`docs/concepts/data-layer-and-isolation.md`「種子資料與遷移」)。`icon` 的白名單正本是 `@repo/domain/module-icon` 的 `MODULE_ICON_KEYS`(前後端共用,schema 刻意不寫成 mongoose `enum` 以免抄成第二份),`null` = 側欄用預設圖示;初值對照表與規則見 `docs/modules/module-manager.md`「側欄圖示」。
- **`demo_items_one` 的附件是四個平行欄位**(`demo-item-one.schema.ts`):`attachmentPath` + `attachmentName` / `attachmentSize` / `attachmentContentType`(原始檔名 / bytes / 檔型,前端申報、api 只驗形狀)。**四欄同生同滅**(換檔一起 `$set`、清空一起 `$unset`)。只有 `attachmentPath` 的資料,api 對後三者回 `null`、前端退回顯示路徑尾段,所以不需要 migration。選平行欄位而非巢狀 `attachment` 物件,就是為了不搬既有資料。對外形狀(`attachment { path, name, size, contentType }`)正本見 `docs/modules/demo.sub.sample-one.md`「api 介面」。
- **`data_scope_rules.rules[]` 的形狀**(`audience` + `filter` 條件樹的節點種類、型別 → 運算子 → 值來源、`RULE_INVALID` 的 `path` / `reason`)正本在 `docs/modules/data-scope.md`,schema 只把 `filter` 存成自由 JSON;機制見 `docs/concepts/data-layer-and-isolation.md`「資料範圍規則」。

## 種子清單

modules、permissions、field_categories、fields(全域)、種子 roles(super-admin、租戶管理員模板)與其綁定、根組織、root 初始帳號、data_scope_targets、示範資料。宣告正本是 `apps/db-migrator/seeds/registry.ts`;內容見 `docs/modules/*.md`(權限表)與 `docs/modules/field-manager.md`(欄位選項)。

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
