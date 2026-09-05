# 底座 Schema 總表(建模定案彙整,2026-09-06)

依 CONTEXT.md 與 ADR-0001~0007 彙整。⊕ = 建模過程新增(非使用者原始清單)。
**全表共通 base 欄位**(plugin 繼承,ADR-0007):`createdAt` `updatedAt` `createdBy` `updatedBy` `deletedAt`(軟刪除)。`settings` 為受控 JSON。

## orgs(組織)

| 欄位 | 型別 | 備註 |
|---|---|---|
| name | string | |
| parentId | ObjectId? | 根組織為 null |
| ancestors ⊕ | ObjectId[] | 物化路徑(ADR-0005) |
| key ⊕ | string? | 僅系統組織(root)需要,seed 冪等用 |
| isSystem ⊕ | boolean | 保護 root |
| enabled ⊕ | boolean | 停用租戶 |
| description | string? | |
| settings | object | 含租戶頂層「子孫可見性」開關 |

## users(使用者)/ customers(會員)

兩表欄位相同、完全分離(ADR-0003):

| 欄位 | 型別 | 備註 |
|---|---|---|
| name / gender / nickname | string | gender 選項來自欄位管理 |
| nationalId | string? | 非必填;收取時欄位級加密、API 預設不回傳(ADR-0007) |
| phone / email / address | string | |
| account | string | 登入帳號,unique |
| passwordHash | string | argon2id,禁明文(ADR-0003) |
| enabled | boolean | |
| settings | object | |
| orgId | ObjectId | **僅 customers**:註冊預設根組織、可指定為某租戶(該租戶的會員);users 走 org_user 關聯(可多組織) |

## roles(角色)

| 欄位 | 型別 | 備註 |
|---|---|---|
| key ⊕ | string? | 種子角色用(super-admin);租戶自建可空 |
| name / description | string | |
| enabled | boolean | |
| isSystem ⊕ | boolean | 保護種子角色 |
| settings | object | |

擁有組織走 `org_role` 關聯(role 側唯一)。

## modules(模組)— 全表種子資料

| 欄位 | 型別 | 備註 |
|---|---|---|
| key ⊕ | string | unique,kebab-case |
| name | string | 顯示名,與 key 分離 |
| parentId / ancestors ⊕ | | 樹 |
| route | string | 只有自己那段(前綴父路由已移除,由 API 組合) |
| sidebarType | enum | group(可展開)/ link / hidden |
| order ⊕ | number | 側欄排序 |
| enabled | boolean | 停用連動整棵子樹 |
| isSystem ⊕ / description / settings | | |

## permissions(權限)— 全表種子資料

| 欄位 | 型別 | 備註 |
|---|---|---|
| key ⊕ | string | unique,`模組樹.動作` 全 kebab-case;每模組含一筆 `模組key.*`(ADR-0004) |
| name / description | string | |
| enabled | boolean | 全域 kill switch |
| isSystem ⊕ / settings | | |

隸屬模組走 `module_permission` 關聯(permission 側唯一)。

## core_relationships(核心關聯,ADR-0001)

| 欄位 | 型別 | 備註 |
|---|---|---|
| type | enum | `org_user` `org_role` `user_role` `role_permission` `module_permission`(封閉,程式碼定義) |
| firstId / secondId | ObjectId | 命名順序 Org>User>Role>Module>Permission |
| thirdId | ObjectId? | 保留不使用 |
| meta | object? | 授權人/時間等 |
| description | string? | |

索引:unique(type, firstId, secondId, thirdId);`org_role`/`module_permission` 另於 second 側唯一(單一擁有)。

## field_categories(欄位類別)— 全域種子,租戶不可自訂

| 欄位 | 型別 |
|---|---|
| key | string(unique) |
| name / description | string |
| isSystem ⊕ | boolean |

## fields(欄位選項)

| 欄位 | 型別 | 備註 |
|---|---|---|
| categoryId | ObjectId | |
| orgId | ObjectId? | null=全域種子;有值=租戶自訂(ADR-0005) |
| label / value | string | |
| order / enabled | | 下架不刪(舊資料仍引用) |
| isSystem ⊕ / description | | |

## refresh_tokens ⊕(ADR-0003)

accountId、accountType(user|customer)、tokenHash、expiresAt、revokedAt、deviceInfo、createdAt。

## audit_logs ⊕(ADR-0004)

actorId、actorType、orgId、action、targetType、targetId、before、after、createdAt。只增不改,v1 僅記授權相關變更。

## 預留(不建,ADR-0006)

oauth_clients、scope 目錄(種子)— 第一個串接方出現時隨 node-oidc-provider 建。

## 種子 vs 業務分類(ADR-0002)

- 種子:modules、permissions、field_categories、fields(orgId=null 者)、種子 roles、root org、scope 目錄
- 業務:orgs(租戶)、users、customers、fields(租戶自訂)、關聯、refresh_tokens、audit_logs
