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

**組織樹**:根組織視角以根為根、看得到全部租戶;租戶視角以租戶頂層為根(租戶眼中的根 = 自己的頂層組織)。操作者可見範圍(ADR-0005)外的節點顯示但 disabled。選中節點後右側顯示該組織資料與可用動作;動作按鈕依權限顯示(ADR-0011「頁內判斷」)。

**開通租戶**(根組織專屬):表單欄位 = 租戶名稱、首任管理員的帳號(預設帶入 Email、可改)與 Email、商標(選填)、**開放模組勾選**(清單 = 租戶管理員模板綁的模組扣除根組織專屬模組,預設全勾;勾群組連動下層、勾下層連動上層,規則同角色管理的矩陣)。送出後由 API 一次完成 ADR-0009 的四步(建租戶 Org → 複製「租戶管理員」角色副本、只綁勾選的模組 → 建首任管理員帳號並綁 `org_user` / `user_role` → 寄啟用信)並設 `ownerUserId`。首任管理員不設初始密碼,由啟用信自行設定(`docs/modules/user-manager.md` 密碼流程)。

**新增子組織**:輕量入口,名稱 + 描述,掛在目前選中的組織下(限操作者可見範圍內);不觸發開通流程。

**編輯組織**:名稱、描述、商標(任何組織);租戶頂層另有兩個根組織專屬欄位:擁有者(轉移)與「使用者可見下層組織資料」開關,租戶管理員看不到這兩個欄位。

**停用 / 啟用**:連動整棵子樹;停用的組織不再出現在使用者的可切換組織清單,其成員登入後若沒有其他啟用中的所屬組織則無法進入後台(ADR-0005)。啟用只啟用自己這一節,下層各自處理。

**搬移**:改上層組織;新上層必須在同一租戶(`ancestors` 含同一個租戶頂層),且不能搬到自己的子樹底下。搬移後整棵子樹的 `ancestors` 重算。

**刪除**:前置檢查全部通過才可:無子組織、無成員(`org_user`)、不是任何角色的擁有組織、無業務資料引用。任一不通過 → 提示改用停用。刪除 = 軟刪除(ADR-0007)。

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
