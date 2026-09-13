# 底座 Schema 總表(建模定案彙整,2026-09-06)

依 CONTEXT.md 與 ADR-0001~0011 彙整。⊕ = 建模過程新增(非使用者原始清單)。
**全表共通 base 欄位**(plugin 繼承,ADR-0007):`createdAt` `updatedAt` `createdBy` `updatedBy` `deletedAt`(軟刪除)。`settings` 為受控 JSON。

## orgs(組織)

| 欄位 | 型別 | 備註 |
|---|---|---|
| name | string | |
| parentId | ObjectId? | 根組織為 null |
| ancestors ⊕ | ObjectId[] | 物化路徑(ADR-0005) |
| key ⊕ | string? | 僅根組織需要,seed 冪等用 |
| isSystem ⊕ | boolean | 保護根組織 |
| enabled ⊕ | boolean | 停用租戶 |
| description | string? | |
| logoPath ⊕ | string? | 組織商標的 GCS 物件路徑(存路徑非 URL — ADR-0010 私有優先):SideNav 頂部有圖顯圖、無圖顯組織名稱文字;見 docs/branding.md |
| ownerUserId ⊕ | ObjectId? | 租戶擁有者(僅租戶頂層有值,ADR-0009):開通時 = 首任租戶管理員;保護 — 其「租戶管理員」授予不可被解除、不可被移出租戶、不可被停用(根組織可,處理例外);v1 轉移僅根組織可執行 |
| settings | object | 含租戶頂層「子孫可見性」開關 |

## users(使用者)/ customers(會員)

兩表欄位相同、完全分離(ADR-0003):

| 欄位 | 型別 | 備註 |
|---|---|---|
| name / gender / nickname | string | gender 選項來自欄位管理 |
| nationalId | string? | **身分證字號**,非必填;欄位級加密存放、API 預設投影不回傳、特權查詢才解密(ADR-0007)。底座目前無功能使用 — 作為加密機制的驗證載體保留 |
| phone / address | string | |
| email | string | **unique(全庫)** — 啟用信、忘記密碼等信件流程以此定位帳號(ADR-0003/0009);不作登入識別 |
| account | string | **登入帳號,unique(全庫)** — users 與 customers 皆以 account 登入;與 auth_identities.accountId(文件 `_id`)是兩回事 |
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
| sidebarType | enum | group(可展開)/ link / hidden(隱藏頁,key 一律 `-page` 結尾) |
| order ⊕ | number | 側欄排序 |
| enabled | boolean | 停用連動整棵子樹 |
| isSystem ⊕ / description / settings | | |

## permissions(權限)— 全表種子資料

| 欄位 | 型別 | 備註 |
|---|---|---|
| key ⊕ | string | unique,`擁有模組key.動作`(動作可多段,全 kebab-case 無例外);每模組含一筆 `模組key.*`(ADR-0004) |
| moduleId ⊕ | ObjectId | 擁有模組(固定從屬用直接欄位,ADR-0001/0004);綁定原則:綁「按鈕/欄位所在的那一頁」 |
| name | string | 顯示名(矩陣與權限清單) |
| description | string? | 補充說明(矩陣 hover / 權限清單) |
| enabled | boolean | 全域 kill switch |
| isSystem ⊕ / settings | | |

資料範圍不在權限體系內,見 `data_scope_rules` 與 ADR-0008。

## core_relationships(核心關聯,ADR-0001)

| 欄位 | 型別 | 備註 |
|---|---|---|
| type | enum | `org_user` `org_role` `user_role` `role_module` `role_permission`(封閉,程式碼定義,完整清單見 ADR-0001) |
| firstId / secondId | ObjectId | 命名順序 Org>User>Role>Module>Permission |
| thirdId | ObjectId? | 保留不使用 |
| meta | object? | 授權人/時間等 |
| description | string? | |

索引:unique(type, firstId, secondId, thirdId);`org_role` 另於 second 側唯一(單一擁有組織)。

## data_scope_rules ⊕(資料範圍規則,ADR-0008)

| 欄位 | 型別 | 備註 |
|---|---|---|
| collection | string | unique,資料目標(seed 的 dataScopeTarget 宣告) |
| combineOp | enum | AND / OR — 命中規則的頂層合成(預設 OR) |
| rules | array | `{ audience:{type: all\|role\|org\|user, ids[]}, filter: 巢狀樹{op, children[{field, cond, value{kind: static\|dynamic, …}}]} }` |

執行:BaseRepository 查詢時套用,外層恆 AND 租戶隔離保底;設定記憶體快取、儲存時作廢。

## data_scope_targets ⊕(資料範圍目標,ADR-0008)— 全表種子資料

「資料範圍」頁左側清單的來源;各模組 seed 的 `dataScopeTarget` 宣告落庫於此。

| 欄位 | 型別 | 備註 |
|---|---|---|
| collection | string | unique(如 `demo_items_one`) |
| name / description | string | 中文名與說明(頁面顯示) |
| fields | array | 可篩**業務**欄位目錄:`{ field, name, type: org\|user\|date\|enum, options? }`;基礎欄位(orgId/createdBy/…)由程式自動附加,不入庫 |
| isSystem ⊕ | boolean | 種子保護 |

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

## demo_items_one / demo_items_two ⊕(示範模組,docs/modules/demo.sub.sample-one.md、demo.sample-two.md)

**demo_items_one**(示範模組1):name、category(欄位管理「示範分類」選項)、note、internalNote(欄位級權限控)、coverPath(公開 bucket)、attachmentPath(私有 bucket)、enabled + 基礎欄位(ADR-0007)。
**demo_items_two**(示範模組2,不宣告資料範圍目標的對照組):name、note、enabled + 基礎欄位。

## refresh_tokens ⊕(ADR-0003)

accountId、accountType(user|customer)、tokenHash、expiresAt、revokedAt、deviceInfo、createdAt。

## action_tokens ⊕(ADR-0009/0010)

userId、type(activation|password-reset)、tokenHash、expiresAt(TTL index;啟用 7 天、重設 30 分鐘,env 可調)、usedAt、createdAt。單次使用。

## audit_logs ⊕(ADR-0004)

actorId、actorType、orgId、action、targetType、targetId、before、after、createdAt。只增不改,v1 僅記授權相關變更。

## 索引總表 ⊕

| collection | 索引 |
|---|---|
| orgs | unique(key, sparse);(parentId);(ancestors) |
| users / customers | unique(account);unique(email) |
| roles | unique(key, sparse) |
| modules | unique(key);(ancestors) |
| permissions | unique(key);(moduleId) |
| core_relationships | unique(type, firstId, secondId, thirdId);org_role 另於 second 側唯一;各 type 查詢用 (type, firstId) / (type, secondId) |
| data_scope_rules | unique(collection) |
| data_scope_targets | unique(collection) |
| field_categories | unique(key) |
| fields | (categoryId, orgId) |
| refresh_tokens | (accountType, accountId);TTL(expiresAt) |
| action_tokens | (userId);TTL(expiresAt) |
| audit_logs | (orgId, createdAt);(targetType, targetId) |
| demo_items_one / two | (orgId, createdAt) |

## 預留(不建)

- **oauth_clients、scope 目錄**(ADR-0006)— 第一個串接方出現時隨 node-oidc-provider 建。
- **auth_identities**(第三方登入綁定;會員線開發時啟用):

| 欄位 | 型別 | 備註 |
|---|---|---|
| accountType | enum:`user` \| `customer` | 固定從屬:指向哪張帳號表 |
| accountId | ObjectId | **= 該帳號文件的 `_id`(主鍵),不是 account 登入欄位** |
| provider | enum(封閉,程式碼定義,如 `google`) | `password` 不進此表 — 密碼留在帳號表 passwordHash |
| providerUserId | string | 第三方使用者識別(Google = `sub`) |
| email | string? | 第三方回傳,僅記錄與綁定比對輔助,不作登入識別 |
| meta | object? | 顯示名、頭像 URL 等 |

索引:unique(provider, providerUserId)/ unique(accountType, accountId, provider)/(accountType, accountId)。不掛 orgId、不進租戶過濾(帳號為平台級)。

## 種子 vs 業務分類(ADR-0002)

- 種子:modules、permissions、field_categories、fields(orgId=null 者)、種子 roles、根組織、scope 目錄
- 業務:orgs(租戶)、users、customers、fields(租戶自訂)、關聯、refresh_tokens、action_tokens、audit_logs
