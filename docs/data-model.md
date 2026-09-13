# 資料模型地圖

底座所有 collection 的**總覽與導航**。欄位、型別、索引的細節**正本在程式碼**:`apps/api/src/database/schemas/*.schema.ts`(每欄有註解),此檔不重複,只給地圖與跨檔約定。

## Collection 一覽

| collection | 種子/業務 | 用途 | ADR | schema 檔 |
|---|---|---|---|---|
| `orgs` | 業務(根組織為種子) | 組織樹;資料隔離邊界 | 0005 | `org.schema.ts` |
| `users` | 業務 | 後台使用者帳號 | 0003 | `user.schema.ts` |
| `customers` | 業務 | 前台會員帳號 | 0003 | `customer.schema.ts` |
| `roles` | 業務(種子角色除外) | 角色(權限集合) | 0004 | `role.schema.ts` |
| `modules` | 種子 | 模組樹(= 頁面/側欄) | 0004 | `module.schema.ts` |
| `permissions` | 種子 | 權限(頁面裡的按鈕/欄位) | 0004 | `permission.schema.ts` |
| `core_relationships` | 業務 | 五實體的關聯(org_user/org_role/user_role/role_module/role_permission) | 0001 | `core-relationship.schema.ts` |
| `data_scope_rules` | 業務 | 資料範圍規則 | 0008 | `data-scope-rule.schema.ts` |
| `data_scope_targets` | 種子 | 資料範圍目標(頁面左側清單來源) | 0008 | `data-scope-target.schema.ts` |
| `field_categories` | 種子(全域) | 欄位類別 | 0005 | `field-category.schema.ts` |
| `fields` | 種子(全域)+ 業務(租戶自訂) | 欄位選項 | 0005 | `field.schema.ts` |
| `refresh_tokens` | 業務 | 登入 refresh token(存雜湊) | 0003 | `refresh-token.schema.ts` |
| `action_tokens` | 業務 | 啟用信 / 重設密碼 token(單次、TTL) | 0009/0010 | `action-token.schema.ts` |
| `audit_logs` | 業務 | 稽核日誌(只增不改) | 0004 | `audit-log.schema.ts` |
| `demo_items_one` / `demo_items_two` | 業務 | 示範模組資料 | demo 模組文件 | `demo-item-*.schema.ts` |

## 全表共通

- **基礎欄位**(ADR-0007):`createdAt` `updatedAt` `createdBy` `updatedBy` `deletedAt`(軟刪除)。timestamps 由 schema `timestamps:true` 提供;createdBy/updatedBy/deletedAt 由 base-fields plugin(#26)自動填。
- **租戶隔離**:業務 collection 掛 `orgId`,查詢一律經 BaseRepository 自動過濾(ADR-0005),禁裸 `Model.find`。
- **種子 vs 業務**:種子由 seed 以 key 冪等 upsert(`apps/db-migrator/seeds/`,ADR-0002);業務資料不做跨環境搬移。
- **索引**:各 schema 檔以 `.index(...)` 就地宣告(唯一鍵、orgId 複合、ancestors、TTL 等)。

## 種子清單

modules、permissions、field_categories、fields(全域)、種子 roles(super-admin、租戶管理員模板)、根組織、data_scope_targets、scope 目錄。內容正本見 `docs/modules/*.md`(權限表)與 `docs/modules/field-manager.md`(欄位選項)。

## 預留(尚未建,程式碼無)

### `auth_identities`(第三方登入綁定,ADR-0003;會員線開發時啟用)

| 欄位 | 型別 | 備註 |
|---|---|---|
| accountType | enum:`user`\|`customer` | 固定從屬:指向哪張帳號表 |
| accountId | ObjectId | = 該帳號文件的 `_id`(主鍵),**不是** account 登入欄位 |
| provider | enum(如 `google`) | `password` 不進此表(密碼留帳號表 passwordHash) |
| providerUserId | string | 第三方使用者識別(Google=`sub`) |
| email | string? | 第三方回傳,綁定比對輔助,不作登入識別 |
| meta | object? | 顯示名、頭像 URL 等 |

索引:unique(provider, providerUserId)/ unique(accountType, accountId, provider)/(accountType, accountId)。不掛 orgId、不進租戶過濾(帳號為平台級)。

### `oauth_clients` + scope 目錄(ADR-0006)

第一個串接方出現時隨 node-oidc-provider 建。
