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

| 權限 key                                       | 它是哪一頁的什麼                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.org-manager.view`                      | 看組織樹與組織資料(名稱、描述、商標、狀態、擁有者);沒有它整頁進不去內容                                                                                             |
| `system.org-manager.create-child`              | 「新增子組織」按鈕 + API:在選中的組織下建一個子組織(名稱 + 描述)                                                                                                    |
| `system.org-manager.edit`                      | 「編輯」按鈕 + API:名稱、描述、商標                                                                                                                                 |
| `system.org-manager.toggle-enabled`            | 「停用 / 啟用」按鈕 + API:連動整棵子樹                                                                                                                              |
| `system.org-manager.move`                      | 「搬移」動作 + API:改上層組織,限同一租戶(以 `ancestors` 驗證),跨租戶拒                                                                                              |
| `system.org-manager.delete`                    | 「刪除」按鈕 + API:前置檢查通過才可(見流程)                                                                                                                         |
| `system.org-manager.set-visibility`            | 編輯**自己租戶的頂層**時的「使用者可見下層組織資料」開關 + API(`settings.visibility`,ADR-0005);租戶管理員模板含此權限,根組織亦可(2026-09-19 從 tenant-ops 搬到這層) |
| `system.org-manager.tenant-ops.provision`      | 根組織:「開通租戶」按鈕 + API(ADR-0009 四步 + 擁有者 + 啟用信)                                                                                                      |
| `system.org-manager.tenant-ops.transfer-owner` | 根組織:編輯租戶頂層時的「擁有者」欄位 + API(ADR-0009:v1 僅根組織可轉移)                                                                                             |

## 畫面與流程

**組織樹**:根 = 操作者**管理範圍**(CONTEXT.md;持有角色的擁有組織)的各個頂點:根組織成員以根為根、看得到全部租戶;持租戶管理員副本者以租戶頂層為根;持「南港店管理員」者以南港店為根,可能有多個根。管理範圍外的組織**不出現**在樹上(不再有 `outOfScope` 節點;可見性開關與此無關)。選中節點後右側顯示該組織資料與可用動作;動作按鈕依權限顯示(ADR-0011「頁內判斷」)。

**開通租戶**(根組織專屬):表單欄位 = 租戶名稱、首任管理員的帳號(預設帶入 Email、可改)與 Email、商標(選填)、**開放模組勾選**(清單 = 租戶管理員模板綁的模組扣除根組織專屬模組,預設全勾;勾群組連動下層、勾下層連動上層,規則同角色管理的矩陣)。送出後由 API 一次完成 ADR-0009 的四步(建租戶 Org → 複製「租戶管理員」角色副本、只綁勾選的模組 → 建首任管理員帳號並綁 `org_user` / `user_role` → 寄啟用信)並設 `ownerUserId`。首任管理員不設初始密碼,由啟用信自行設定(`docs/modules/user-manager.md` 密碼流程)。

**新增子組織**:輕量入口,名稱 + 描述,掛在目前選中的組織下(限操作者管理範圍內);不觸發開通流程。

**編輯組織**:名稱、描述、商標(任何組織;既有商標要顯示預覽)、上層組織(搬移,見下);租戶頂層另有:「使用者可見下層組織資料」開關(持 `set-visibility` 者可設,租戶管理員預設有)與擁有者轉移(根組織專屬)。

**停用 / 啟用**:**租戶頂層只有根組織能停用**(租戶內的人對它的停用 / 刪除 / 搬移按鈕停用並提示);連動整棵子樹;停用的組織不再出現在使用者的可切換組織清單,其成員登入後若沒有其他啟用中的所屬組織則無法進入後台(ADR-0005)。啟用只啟用自己這一節,下層各自處理。

**搬移**:在編輯彈窗的「上層組織」下拉改上層;候選 = **管理範圍內、同租戶、且不在自己這棵子樹裡**的全部組織(租戶內的人管理範圍本來就在租戶內;根組織要另外擋跨租戶,ADR-0009);不能搬進自己的子樹是防環。租戶頂層不可搬。下拉文案用白話:「可以搬到你管理範圍內的任何組織底下,除了它自己和它底下的組織」。搬移後整棵子樹的 `ancestors` 重算。

**刪除**:租戶頂層只有根組織能刪;前置檢查全部通過才可:無子組織、無成員(`org_user`)、不是任何角色的擁有組織、無業務資料引用。任一不通過 → 提示改用停用。刪除 = 軟刪除(ADR-0007)。

## api 介面(#134 已實作,程式在 `apps/api/src/orgs/`)

```graphql
orgTree: [OrgNode!]!              # 管理範圍的森林;根 = 管理範圍的各頂點(可多根),範圍外不回傳
org(id: ID!): Org!                # 範圍外視為不存在(NOT_FOUND);logoUrl 為現簽的短效網址
createChildOrg(input: { parentId, name, description }): OrgPayload!
updateOrg(input: { id, name, description, logoPath }): OrgPayload!
setOrgEnabled(input: { id, enabled }): OrgPayload!
moveOrg(input: { id, newParentId }): OrgPayload!
setOrgVisibility(input: { orgId, visibility: OWN | SUBTREE }): OrgPayload!
deleteOrg(input: { id }): DeletePayload!
```

實作時定下的幾件事(spec 未寫、以本檔的規則推導):

- **`OrgNode.outOfScope` 自 #187 起恆為 false**:管理範圍外的組織根本不回傳(不再有「顯示但不可選」的灰節點),欄位保留是為了與使用者列的 `roles[].outOfScope`(#136)命名一致、且不必同步改前端。`enabled` 仍是組織自己的停用狀態,兩者無關。
- **每棵樹的樹根對外一律回 `parentId: null`**(它的上層不在樹上,給了前端也查不到),多根時每個根都是。因此前端**不能**拿 `parentId` 判斷「樹根是不是平台根組織」— 那件事由 `org(樹根).isSystem` 回答(#186 ④)。
- **`setOrgVisibility` 自 #187 搬到這一組**:權限 `system.org-manager.set-visibility`(不再是 `tenant-ops`),也不再要求「站在根組織」;能設哪些租戶頂層由**管理範圍**回答 —— 範圍外的 `orgId` 查不到即 `NOT_FOUND`,非租戶頂層 `VALIDATION_FAILED`。程式在 `orgs.service.ts`(原本在 `tenant-ops.service.ts`)。
- **`moveOrg` 的租戶頂層保護**:租戶頂層本身的停用 / 刪除 / 搬移只有根組織能做(ADR-0009),判斷點是 `OwnerProtectionService.assertTenantTopOperableBy(operator, org, action)` —— 與 #186 的停用 / 刪除共用同一個函式,不各寫一套。
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
```

(`setOrgVisibility` 原本也在這一組,2026-09-19 搬到上一節,#187。)

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
- **擁有者只存在於租戶頂層**:`transferOrgOwner` 的 `orgId` 不是租戶頂層一律 `VALIDATION_FAILED`;
  新擁有者必須啟用中、且所屬組織落在該租戶(含下層)內。可見範圍開關同樣只掛租戶頂層,
  但守門的是管理範圍而不是「站在根組織」(見上一節)。

**商標上傳**(ADR-0010,本段建立 StorageService 的第一條線):前端向 API 要簽名上傳 URL → 直傳私有 bucket → 把物件路徑存進 `logoPath`;顯示時 API 發簽名讀取 URL。開通與編輯兩個彈窗共用同一個 `Draft/UploadField`。

介面(#137 已實作,程式在 `apps/api/src/storage/`):`createUploadUrl(input: { purpose: ORG_LOGO, contentType, size })` 回 `{ uploadUrl, objectPath, expiresAt }` — 檔型限 png / jpg / webp、大小 ≤ 2MB(不合回 `UPLOAD_REJECTED`),上傳網址效期 10 分鐘,`objectPath` 為 `org-logos/<uuid>.<副檔名>`(簽票時組織可能還不存在,所以不含 orgId);持 `system.org-manager.edit` 或 `system.org-manager.tenant-ops.provision` 任一即可要票。**寫 `logoPath` 前必須以 `isOwnedUploadPath(path)`(`apps/api/src/storage/storage.service.ts`)驗歸屬**,不讓呼叫端塞任意路徑進 DB。讀取端:`me.currentOrg.logoUrl` 現簽短效網址(TTL `GCS_SIGNED_URL_TTL`,預設 1h),無商標或路徑不合為 null。

## admin 頁面(#138 已實作,程式在 `apps/admin/src/pages/system/OrgManagerPage/`)

左樹 + 右資料區,所有動作都是這一頁上的彈窗;登記在 `app/module-pages.tsx`。實作時定下的幾件事:

- **兩種視角不做兩套頁,全由資料決定**:樹根的 `parentId` 為 null = 操作者站在根組織(根組織視角),
  有值 = 樹根就是租戶頂層(租戶視角)。加上手上有沒有 `tenant-ops` 那三筆權限,已足以決定畫面,
  不需要「我是不是超級管理員」這種旗標。Figma 87:3 / 92:694 只是同一支頁面的兩組資料。
- **「是不是租戶頂層」讀 `org.visibility !== null`**:api 只讓租戶頂層有 `visibility` 與 `ownerUserId`
  (`orgs/org-mapper.ts`),前端不必自己數 `ancestors` 或比對樹的層數。樹上的「租戶」標籤則是另一回事 —
  那是「根組織的直接子組織」,租戶視角看不到那一層,標籤自然不出現(判斷方式見 #186 ④)。
- **搬移是編輯彈窗裡的「上層組織」下拉,不是動作列上的按鈕**(Figma 88:182、help.md 沿用此說法);
  候選人在前端先照三條規則濾過(管理範圍內、同租戶、不含自己的子樹),api 仍會再驗一次。
  樹上有的就是管理範圍(#187),所以「管理範圍內」= 在樹上走得到;「同租戶」的上限是
  **含自己的那一棵樹根**(管理範圍多根時 `orgTrail` 會找出是哪一棵),根組織視角要再往下一層
  取租戶頂層(`useMoveTargets.ts`,視角由 `org(樹根).isSystem` 判,#186 ④)。
  租戶頂層自己的候選是空的 = 搬不動,與 api 的租戶頂層保護一致。
- **編輯彈窗最多打四個 mutation**,依序 `updateOrg` → `moveOrg` → `transferOrgOwner` → `setOrgVisibility`,
  **只送有變動的那幾個**(`UpdateOrgInput` 本來就沒有後三者的欄位)。任何一步失敗就停在那裡,
  前面已成功的不回滾 — 它們各自是完整的動作、各自留了審計;重新送出只會補上還沒做的那幾步。
- **擁有者欄位要靠 `users`**:`orgs` 只存 `ownerUserId`,顯示姓名與列出可轉移的候選人都得查使用者,
  而 `users` 掛在 `system.user-manager.view` 底下。沒有那個權限時,資料區的擁有者欄位仍然出現
  (那是組織的事實),只是顯示不出是誰;轉移欄位則不給。
- **刪除不在前端預判**:前置四項全在 api,送出後收到 `ORG_NOT_DELETABLE` 才把 `extensions.reasons`
  攤成清單並提示改用停用。根組織保護(`isSystem`)則是**按鈕出現但停用** —
  「我做不到這個動作」(無權限,不給按鈕)與「這個組織不准被這樣動」(給按鈕、停用並說明)是兩回事。
- **`@repo/ui/tree` 為此加了 `TreeNode.labelSuffix`**(Figma Draft/OrgTreeItem 的 ShowTag 槽位):
  停用的組織掛「停用」標籤、`parentId` 等於平台根組織的節點掛「租戶」標籤。`label` 仍是純文字,
  搜尋與無障礙名稱不受影響。`OrgTreePicker`(#139 起共用)多一個 `labelSuffixOf` 把它接出來。
- **成功後失效三把**:`orgTree`、被改到的那一筆 `org(id)`、以及 `me` — 側欄的租戶識別讀
  `me.currentOrg.logoUrl`(有商標顯示商標圖、沒有才顯示組織名),改完商標不重取 `me` 就不會更新。
- **設計稿差異**:Figma 的資料區有「建立時間」一列,`org(id)` 沒有這個欄位,故未做;
  可見範圍在 Figma 是核取方塊,依本檔與 ADR-0005 的說法改用開關(`Switch`)。

## 審計(ADR-0004:由模組層寫 `audit_logs`)

本模組每個會改資料的動作都寫一筆:`action` = 權限 key 的動作段前加模組簡稱(`org.provision`、`org.create-child`、`org.edit`、`org.toggle-enabled`、`org.move`、`org.delete`、`org.transfer-owner`、`org.set-visibility`),`targetType = "org"`,`targetId` = 被操作的組織,`before` / `after` 只放有變的欄位;`orgId` = 動作發生的組織脈絡(操作者的當前組織)。

## 平台視角(不進 help)

- 整體結構:平台(根組織)> 各租戶 > 部門 / 分店;開通流程與 token 規則見 ADR-0009
- 搬移僅限同租戶,跨租戶禁止
- 「使用者可見下層組織資料」開關實際掛在租戶頂層、套用整個租戶;help 對租戶只說「頂層組織」「整個組織」

## help 邊界

[system.org-manager.help.md](../../apps/admin/src/md/module-help/system.org-manager.help.md)(build 時打包進說明彈窗)讀者是租戶使用者:不得出現 根組織 / 租戶 / 開通 / 跨租戶 等平台視角詞彙;租戶眼中的根 = 自己的頂層組織。

## 管理範圍與租戶標示(2026-09-19,#140 驗收後修正;#187 實作)

- 本頁與使用者管理、角色管理的範圍都是**管理範圍**(CONTEXT.md),不是可見範圍;api 的 `orgTree` / `org` / 各 mutation 都以 `managedOrgIds` 守門。落實點只有一個:`orgs` 這張 collection 在 schema 上宣告成**治理類**(`tenantScopePlugin({ kind: "governance" })`),租戶過濾就自動吃管理範圍;業務 collection 維持吃可見範圍。個別 service 不自己選範圍,凡查組織就經 `OrgsRepository`,反查 `org_user` 得到的使用者清單自然也對。
- 「租戶」標籤只標**父節點是平台根組織**的節點,不是「父節點是樹根」— 租戶視角的樹根是租戶頂層,它的子組織不是租戶。實作上不能看 `OrgNode.parentId`(樹根一律回 null),而是先以 `org(樹根).isSystem` 判斷「樹根就是平台根組織」,是的話它的直接子組織才掛標籤(#186 ④)。
- 側欄商標:當前組織自己的,沒有就繼承最近有商標的上層(ADR-0010)。

## 實作細節(#186:#140 驗收的六項修正)

- **「這棵樹的根是不是平台根組織」不能看 `OrgNode.parentId`**:`buildForest`
  把本棵樹的根一律對外回 `parentId: null`(租戶視角的租戶頂層也是),拿它判斷會把
  租戶頂層當成平台根組織、把租戶的子組織標成「租戶」。admin 改讀 `org(樹根).isSystem`
  (樹根沒被點掉時跟選中的那一筆同一把 query key,不多發一次請求)。
- **租戶頂層保護的判斷點是 `OwnerProtectionService.assertTenantTopOperableBy(operator, org)`**
  (`orgs/owner-protection.service.ts`):不是租戶頂層就放行,是的話只有根組織的操作者能做
  (`isRootOperator`,與擁有者保護、租戶作業同一個判準),否則 `FORBIDDEN`。
  `setOrgEnabled` / `deleteOrg` / `moveOrg` 各呼叫一次;**排在 `CYCLIC_MOVE` / `CROSS_TENANT` 與
  刪除前置四項之前**,不透露租戶內部狀態。admin 那邊停用 / 刪除按鈕與編輯彈窗的
  「上層組織」下拉都 `disabled` 加 `title` 提示(同根組織保護:給按鈕、停用、說明為什麼)。
- **`updateOrg` 沒碰商標欄就不送 `logoPath`**:`UpdateOrgInput.logoPath` 給 `null` 在 api 是「清空商標」,
  欄位缺席才是「不動它」— 前端以「使用者有沒有碰過商標欄」決定要不要送。
  既有商標的預覽走 `@repo/ui/upload-field` 的 `initialPreviewUrl`(選新檔即取代、按移除回空狀態)。
- **樹的葉節點在 admin 歸一化成 `children: undefined`**(`lib/org-tree.ts` 的 `toTreeNodes`):
  api 對葉節點回 `children: []`,而 `TreeNode.children` 的語意是「有沒有下一層」—
  不把「能不能展開」交給樹元件自己解讀。
- **彈窗裡的表單欄位**:MUI 有一條 `.MuiDialogTitle-root + .MuiDialogContent-root { padding-top: 0 }`,
  特異度贏過 `sx` 的單一 class,第一個 `TextField` 的浮動標籤會被標題壓住;
  `@repo/ui/dialog` 以 `&&` 拉高特異度修好,四個彈窗一次到位。
