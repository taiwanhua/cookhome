# 組織管理(技術)

- **模組 key**:`system.org-manager`
- **畫面**:Figma「Screen / Admin 組織管理」(根組織視角 87:3、租戶視角 92:694)+ 彈窗:開通租戶 88:146(含開放模組勾選區 202:351)、新增子組織 202:404、編輯組織 88:167、停用確認 88:200
- **相關 ADR**:[0005 多租戶隔離](../adr/0005-multi-tenant-isolation.md)、[0009 租戶開通](../adr/0009-tenant-provisioning.md)、[0010 儲存與寄信](../adr/0010-file-storage-and-email.md)、[0004 權限模型](../adr/0004-permission-model.md)
- **資料**:`orgs`(`ancestors` 物化路徑、`settings.visibility` 可見範圍、`logoPath` 商標、`ownerUserId` 租戶擁有者)、`core_relationships`(`org_user`)、`audit_logs`
- **使用者說明**:[system.org-manager.help.md](../../apps/admin/src/md/module-help/system.org-manager.help.md)

## 模組樹

| key                             | 名稱     | sidebarType                  | 自有權限 |
| ------------------------------- | -------- | ---------------------------- | -------- |
| `system.org-manager`            | 組織管理 | link(樹 + 表格頁)            | 見權限表 |
| `system.org-manager.tenant-ops` | 租戶作業 | hidden、`isRootOnly`、無路由 | 見權限表 |

**為什麼多一個「租戶作業」隱藏模組**:開通租戶、轉移擁有者、設定可見範圍是根組織專屬的動作(ADR-0009),但 wildcard 是同層語意(ADR-0004),租戶管理員模板拿到 `system.org-manager.*` 就會連同這一層的全部權限一起拿到。把根組織專屬的動作放進一個 `isRootOnly` 的隱藏模組,模板複製時整個模組被扣除(ADR-0009 第 3 步),租戶永遠拿不到,也不用在 wildcard 規則上開特例。它沒有路由、不在側欄出現,只是權限的容器;彈窗仍然開在組織管理頁上。

## 權限表(綁定原則:綁「按鈕 / 欄位所在的那一頁」,ADR-0004)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。

| 權限 key                                       | 它是哪一頁的什麼                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `system.org-manager.view`                      | 看組織樹與組織資料(名稱、描述、商標、狀態、擁有者);沒有它整頁進不去內容                     |
| `system.org-manager.create-child`              | 「新增子組織」按鈕 + API:在選中的組織下建一個子組織(名稱 + 描述)                            |
| `system.org-manager.edit`                      | 「編輯」按鈕 + API:名稱、描述、商標                                                         |
| `system.org-manager.toggle-enabled`            | 「停用 / 啟用」按鈕 + API:連動整棵子樹                                                      |
| `system.org-manager.move`                      | 「搬移」動作 + API:改上層組織,限同一租戶(以 `ancestors` 驗證),跨租戶拒                      |
| `system.org-manager.delete`                    | 「刪除」按鈕 + API:前置檢查通過才可(見流程)                                                 |
| `system.org-manager.tenant-ops.provision`      | 根組織:「開通租戶」按鈕 + API(ADR-0009 四步 + 擁有者 + 啟用信)                              |
| `system.org-manager.tenant-ops.transfer-owner` | 根組織:編輯租戶頂層時的「擁有者」欄位 + API(ADR-0009:v1 僅根組織可轉移)                     |
| `system.org-manager.tenant-ops.set-visibility` | 根組織:編輯租戶頂層時的「使用者可見下層組織資料」開關 + API(`settings.visibility`,ADR-0005) |

## 畫面與流程

**組織樹**:根組織視角以根為根、看得到全部租戶;租戶視角以租戶頂層為根(租戶眼中的根 = 自己的頂層組織)。操作者可見範圍(ADR-0005)外的節點顯示但不可選取(`OrgNode.outOfScope`)。選中節點後右側顯示該組織資料與可用動作;動作按鈕依權限顯示(ADR-0011「頁內判斷」)。

**開通租戶**(根組織專屬):表單欄位 = 租戶名稱、首任管理員的帳號(預設帶入 Email、可改)與 Email、商標(選填)、**開放模組勾選**(清單 = 租戶管理員模板綁的模組扣除根組織專屬模組,預設全勾;勾群組連動下層、勾下層連動上層,規則同角色管理的矩陣)。送出後由 API 一次完成 ADR-0009 的四步(建租戶 Org → 複製「租戶管理員」角色副本、只綁勾選的模組 → 建首任管理員帳號並綁 `org_user` / `user_role` → 寄啟用信)並設 `ownerUserId`。首任管理員不設初始密碼,由啟用信自行設定(`docs/modules/user-manager.md` 密碼流程)。

**新增子組織**:輕量入口,名稱 + 描述,掛在目前選中的組織下(限操作者可見範圍內);不觸發開通流程。

**編輯組織**:名稱、描述、商標(任何組織);租戶頂層另有兩個根組織專屬欄位:擁有者(轉移)與「使用者可見下層組織資料」開關,租戶管理員看不到這兩個欄位。

**停用 / 啟用**:連動整棵子樹;停用的組織不再出現在使用者的可切換組織清單,其成員登入後若沒有其他啟用中的所屬組織則無法進入後台(ADR-0005)。啟用只啟用自己這一節,下層各自處理。

**搬移**:改上層組織;新上層必須在同一租戶(`ancestors` 含同一個租戶頂層),且不能搬到自己的子樹底下。搬移後整棵子樹的 `ancestors` 重算。

**刪除**:前置檢查全部通過才可:無子組織、無成員(`org_user`)、不是任何角色的擁有組織、無業務資料引用。任一不通過 → 提示改用停用。刪除 = 軟刪除(ADR-0007)。

## api 介面(#134 已實作,程式在 `apps/api/src/orgs/`)

```graphql
orgTree: [OrgNode!]!              # 可見範圍內的樹;租戶視角以租戶頂層為根,範圍外節點標 outOfScope
org(id: ID!): Org!                # 範圍外視為不存在(NOT_FOUND);logoUrl 為現簽的短效網址
createChildOrg(input: { parentId, name, description }): OrgPayload!
updateOrg(input: { id, name, description, logoPath }): OrgPayload!
setOrgEnabled(input: { id, enabled }): OrgPayload!
moveOrg(input: { id, newParentId }): OrgPayload!
deleteOrg(input: { id }): DeletePayload!
```

實作時定下的幾件事(spec 未寫、以本檔的規則推導):

- **`OrgNode.outOfScope` 與 `enabled` 是兩件事**:`enabled` 是組織自己的停用狀態,`outOfScope` 是「在操作者可見範圍外」(樹上照樣顯示、但不可選不可操作)。兩個欄位同時存在;命名與使用者列的 `outOfScope`(#136)一致。
- **停用連動、搬移的 `ancestors` 重算、刪除前置的「有沒有子組織」以整棵子樹為準**,不受操作者可見範圍裁切(可見範圍決定「看得到誰的資料」,不該讓連動只做一半)。程式上是 `orgs.service.ts` 的 `subtreeContext()`,只准搭配把查詢釘在該子樹內的條件。
- **根組織保護**:不可停用、不可搬移、不可刪除(刪除的 reasons 多一項 `SYSTEM_ORG`)。
- **`updateOrg` 動不到擁有者與可見範圍開關**:`UpdateOrgInput` 根本沒有這兩個欄位(租戶作業 #135 另開 mutation),不是靠執行期判斷。
- **`updateOrg` 沒有任何欄位真的變動時不寫入、也不留審計**(審計的 before / after 只放有變的欄位,空紀錄是雜訊)。
- **讀取類的兩個端點(`orgTree` / `org(id)`)是多選一守門**:持 `system.org-manager.view` **或**
  `system.user-manager.view` 任一即可(2026-09-19 加,#139 回饋)。組織樹不只組織管理頁在用 —
  使用者管理頁的左樹與「選擇所屬組織」彈窗也要它,那些人未必持有組織管理的檢視權;
  可見範圍(ADR-0005)照樣決定看得到誰,這一條只決定進不進得了端點。寫法同 `storage.resolver.ts`
  的多選一判斷(`@RequirePermission` 只能守單一 key)。寫入類的端點維持單一 `@RequirePermission`。
- **`OrgNode` 也帶 `ownerUserId`**(僅租戶頂層有值,其餘 null;同 `Org`):使用者管理頁靠它標出
  受擁有者保護的列,不必為了一個欄位再逐筆查 `org(id)`(#139 回饋)。
- **「無業務資料引用」的清單**= 目前有 `orgId` 的業務 collection:`customers`、`demo_items_one`、`demo_items_two`、`fields`(租戶自訂欄位選項)。`audit_logs` 不算(只增不改的歷史紀錄)。第 5 段示範模組長出新 collection 時在 `orgs.service.ts` 的 `hasBusinessData()` 加一項。
- 錯誤碼:`ORG_NOT_DELETABLE`(`extensions.reasons`:`HAS_CHILDREN` / `HAS_MEMBERS` / `OWNS_ROLES` / `HAS_BUSINESS_DATA` / `SYSTEM_ORG`)、`CROSS_TENANT`、`CYCLIC_MOVE`、`NOT_FOUND`、`VALIDATION_FAILED`、`FORBIDDEN`(GQL-04 表)。

## api 介面:租戶作業(#135 已實作,程式在 `apps/api/src/orgs/tenant-ops.*.ts`)

```graphql
tenantModuleOptions: [ModuleOption!]!                  # 開通彈窗的模組勾選清單
provisionTenant(input: { name, adminAccount, adminEmail, logoPath, moduleKeys }): ProvisionTenantPayload!
transferOrgOwner(input: { orgId, newOwnerUserId }): OrgPayload!
setOrgVisibility(input: { orgId, visibility: OWN | SUBTREE }): OrgPayload!
```

實作時定下的幾件事(spec 未寫、以本檔與 ADR-0009 / 0005 的規則推導):

- **「根組織專屬」是執行期的第二道門**:三個 mutation 與 `tenantModuleOptions` 都先過 `@RequirePermission`,
  再由 service 確認**操作者的當前組織是根組織**,否則 `FORBIDDEN`。權限可能經角色被帶到別的組織,
  「站在哪裡」才是判準;判斷點是 `OwnerProtectionService.isRootOperator`(與擁有者保護的根組織例外同一個)。
- **`OwnerProtectionService` 住在 `orgs/`**(#136 原本放 `users/`,#135 抽出):判斷的主體是組織
  (`orgs.ownerUserId`、根組織例外),由 `OrgsModule` 匯出給 `UsersModule` 用,兩個模組不各寫一套。
- **`tenantModuleOptions` 的判準是「模板有沒有綁」**,不是重算 `isRootOnly` — `isRootOnly` 只存在於 seed 宣告層、
  不落庫(ADR-0004),種子在造模板綁定時已扣除根組織專屬模組(`seeds/role-bindings.ts`)。
- **勾選的模組會自動補上仍在選項內的上層模組**:模組樹就是側欄的樹,只綁下層不綁群組會讓側欄斷成孤兒
  (ADR-0004「勾下層模組必連動勾上層」)。前端矩陣本來就這樣送,API 這層不依賴前端做對。
  選項外的 key(含根組織專屬模組)或一個都沒勾 → `VALIDATION_FAILED`(`extensions.fields` 指出欄位)。
- **副本的權限取自模板的 `role_permission`**(每模組一筆該模組的 `*`)再與勾選的模組取交集,
  不在這裡自己組 key — 模板日後多綁 / 少綁什麼,副本自動跟著。
- **開通的回滾是補償刪除**:Mongo 單節點沒有 transaction,失敗時把已建立的關聯、使用者、角色副本、
  租戶組織逐一抹掉(`BaseRepository.hardDeleteById`,**不是軟刪除** — `users` 的 account / email 唯一索引
  含已軟刪除的文件,留殭屍會讓同一組帳號永遠再也開不了)。補償範圍不含 `audit_logs`(只增不改,ADR-0004):
  極端情況下會留一筆 `org.provision` 但資料已回滾,寧可多一筆稽核痕跡也不漏記特權動作。寄信排在最後。
- **首任管理員的姓名**暫用帳號字串(開通表單沒有姓名欄,ADR-0009);本人啟用後可自行在使用者管理改。
- **擁有者與可見範圍只存在於租戶頂層**:兩個 mutation 的 `orgId` 不是租戶頂層一律 `VALIDATION_FAILED`;
  轉移的新擁有者必須啟用中、且所屬組織落在該租戶(含下層)內。

**商標上傳**(ADR-0010,本段建立 StorageService 的第一條線):前端向 API 要簽名上傳 URL → 直傳私有 bucket → 把物件路徑存進 `logoPath`;顯示時 API 發簽名讀取 URL。開通與編輯兩個彈窗共用同一個 `Draft/UploadField`。

介面(#137 已實作,程式在 `apps/api/src/storage/`):`createUploadUrl(input: { purpose: ORG_LOGO, contentType, size })` 回 `{ uploadUrl, objectPath, expiresAt }` — 檔型限 png / jpg / webp、大小 ≤ 2MB(不合回 `UPLOAD_REJECTED`),上傳網址效期 10 分鐘,`objectPath` 為 `org-logos/<uuid>.<副檔名>`(簽票時組織可能還不存在,所以不含 orgId);持 `system.org-manager.edit` 或 `system.org-manager.tenant-ops.provision` 任一即可要票。**寫 `logoPath` 前必須以 `isOwnedUploadPath(path)`(`apps/api/src/storage/storage.service.ts`)驗歸屬**,不讓呼叫端塞任意路徑進 DB。讀取端:`me.currentOrg.logoUrl` 現簽短效網址(TTL `GCS_SIGNED_URL_TTL`,預設 1h),無商標或路徑不合為 null。

## 審計(ADR-0004:由模組層寫 `audit_logs`)

本模組每個會改資料的動作都寫一筆:`action` = 權限 key 的動作段前加模組簡稱(`org.provision`、`org.create-child`、`org.edit`、`org.toggle-enabled`、`org.move`、`org.delete`、`org.transfer-owner`、`org.set-visibility`),`targetType = "org"`,`targetId` = 被操作的組織,`before` / `after` 只放有變的欄位;`orgId` = 動作發生的組織脈絡(操作者的當前組織)。

## 平台視角(不進 help)

- 整體結構:平台(根組織)> 各租戶 > 部門 / 分店;開通流程與 token 規則見 ADR-0009
- 搬移僅限同租戶,跨租戶禁止
- 「使用者可見下層組織資料」開關實際掛在租戶頂層、套用整個租戶;help 對租戶只說「頂層組織」「整個組織」

## help 邊界

[system.org-manager.help.md](../../apps/admin/src/md/module-help/system.org-manager.help.md)(build 時打包進說明彈窗)讀者是租戶使用者:不得出現 根組織 / 租戶 / 開通 / 跨租戶 等平台視角詞彙;租戶眼中的根 = 自己的頂層組織。
