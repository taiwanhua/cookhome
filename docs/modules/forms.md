# 表單引擎(技術)

表單引擎的 api 端:**表單設計**(`apps/api/src/forms/form-design/`:表單、版本、四步發布、分派 / 啟用、欄位級權限的產生與退役清理)與**表單執行**(`apps/api/src/forms/form-runtime/`:草稿 / 送出 / 修訂、欄位級投影、顯示名、lookup)。兩邊共用的判準與寫入規則在 `apps/api/src/forms/` 根目錄。定義的形狀、表達式、檢查器、值的正規化與規則驗證是前後端共用的純邏輯,在 `@repo/domain/form`。

規格正本是 Spec 6a(表單引擎);本文件寫 api 怎麼落地、選了哪些做法與為什麼。

## 用途

- 業務模組的**骨架**(路由、頁面節點、權限、資料範圍目標)由 seed 宣告(`engine: "form"`,範例 `shopping-list`);**表單**(欄位、版面、版本、分派、啟用)由 root 與租戶在「表單管理」(`system.forms`)管理。
- 所有表單模組的資料共用 `form_submissions`(模組資料表,`moduleKey` = 綁的表單所屬模組)。
- 6a 的提交「送出即完成」;審核流程另案。

## 模組 key 與權限表

「表單管理」是治理群組底下的一般模組(**不是**根組織專屬 —— 租戶管理員要管自己的客製表單);分派 / 收回另由 api 以「站在根組織」守。

| 權限 key                                          | moduleId 指向 | 它是哪一頁的什麼                                                                    |
| ------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `system.forms.*`                                  | 表單管理      | wildcard(同層語意);seed 自動產生                                                    |
| `system.forms.view`                               | 表單管理      | 表單清單、版本、定義;設計器的檢查器與預覽                                           |
| `system.forms.create`                             | 表單管理      | 建共用表單(只有根組織)、以某版本為基底建新表單                                      |
| `system.forms.edit`                               | 表單管理      | 改名稱 / 頁籤模板、開草稿、存草稿、發布(含重試)、退役目前版本(只能動自己擁有的表單) |
| `system.forms.assign`                             | 表單管理      | 分派 / 收回共用表單(只有站在根組織)                                                 |
| `system.forms.set-enabled`                        | 表單管理      | 租戶內開關分派來的或自己的表單                                                      |
| `system.module-manager.delete-retired-permission` | 模組與權限    | 刪除已退役的欄位級權限(三層檢查;根組織專屬模組)                                     |
| `<moduleKey>.view / create / edit / delete`       | 各表單模組    | 列表與單筆 / 新增 / 修改已完成 / 刪除已完成(seed 宣告,端點在執行期判)               |
| `<moduleKey>.show-<formKey>-<fieldKey>`           | 各表單模組    | 欄位級:讀受保護欄位(`source: dynamic`,發布時建)                                     |
| `<moduleKey>.edit-<formKey>-<fieldKey>`           | 各表單模組    | 欄位級:改設了 `permission.edit` 的欄位(同上)                                        |

正本:`apps/db-migrator/seeds/modules/system.ts`、`apps/api/src/forms/form-permission-keys.ts`

## 資料

`forms`、`form_versions`、`form_submissions` 三張表(欄位與索引見 `docs/data-model.md` 與各 schema 檔),加上 `business_relationships` 的 `org_form`(分派 / 啟用)與 `permissions` 的 `source: dynamic`(欄位級權限)。

## 可見、可改、可新增

判準只有一份:`apps/api/src/forms/form-access.service.ts`。

| 操作者     | 設計端看得到                        | 設計端改得動         | 可以新增(`moduleForms`)                    |
| ---------- | ----------------------------------- | -------------------- | ------------------------------------------ |
| 站在根組織 | 全部表單                            | 共用表單(owner null) | 全部共用表單(有發布版本)                   |
| 站在租戶內 | 分派來的(有 `org_form`)+ 自己的客製 | 自己的客製表單       | 本租戶 `org_form` 啟用中的表單(有發布版本) |

- `org_form` 以租戶為邊界讀(`BusinessRelationshipsRepository`),所以部門使用者(可見範圍不含租戶頂層)也查得到本租戶的列。
- 設計端讀不到一律 `NOT_FOUND`(不透露別的租戶有這張表單);讀得到但不是自己的 → `FORBIDDEN`(`NOT_FORM_OWNER`)。
- 租戶只能以 `forkForm` 建表單(以分派來的或自己的某一版為基底);客製表單建立時自動建本租戶的 `org_form`(預設啟用)。
- 停用(`org_form.meta.enabled = false`)、收回分派(刪 `org_form`)、退役目前版本都只擋新增;已存在的提交有模組 `view` 就照常看。

## 版本狀態與四步發布

| 狀態         | 意思                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| `draft`      | 設計中、可改,`version = null`;一張表單同時最多一份(部分唯一索引)             |
| `publishing` | 發布步驟 2 搶到鎖、還沒切換完;存在時禁止開草稿 / 退役 / 再發布               |
| `published`  | 凍結、供新增;`forms.currentVersion` 指它                                     |
| `retired`    | 發布下一版時前一版自動變成,或「退役目前版本」;既有草稿仍可送出、歷史照常顯示 |

發布(`form-design/form-publish.service.ts`)**不用 Mongo 交易**(本機與 CI 單節點測不到交易;一致性靠冪等重試):

1. 跑檢查器(`@repo/domain/form` 的 `validateDefinition` + api 端的登錄表),有錯就停,什麼都沒改。
2. 條件更新 `{ _id, status: "draft", draftRevision: 預期 } → publishing`,同時配正式版號(最大 + 1)、記 changelog。沒更新到 → `CONFLICT`。兩個發布同時送出只有一個命中。
3. 欄位級權限:這一版要的缺的建、有 `retiredAt` 的清掉、不再宣告的標 `retiredAt`、`name` 隨表單名與欄位 label 更新。同 key 欄位沿用同一筆權限(`_id` 不變,角色的授予跟著留下)。
4. 切換三筆,依序逐筆寫:這一版 `publishing → published` → 其餘 `published → retired` → `forms.currentVersion` 指向新版。填寫者只看 `currentVersion`,最後一筆寫完前看到的仍是舊版。

**中斷**:有 `publishing` 版本,或有 `published` 版本但它不是 `currentVersion`,就是發布中斷(`FormModel.publishInterrupted`)。`retryPublishFormVersion` 從步驟 3 起重跑全部,每個寫入先看「已是目標狀態就跳過」,重跑幾次結果都一樣。步驟 3 / 4 每筆寫入前有一個檢查點(`form-design/form-publish-hooks.ts`),測試在那裡注入失敗來驗「中途失敗後重試 = 一次成功」。

**退役目前版本**:先 `published → retired`、再 `currentVersion → null`;中斷時再呼叫一次會接著做完(版本已退役就只補後一筆)。

**存草稿**:檢查器的錯草稿可以先存(隨 payload 的 `validation` 回);只有正則不合法 / 可能造成 ReDoS 的不收(存草稿與發布都驗過 ReDoS 才收)。

## 提交的寫入規則

`form-values/submission-values.service.ts`。每次寫入(建草稿、存草稿、送出、已完成修改)每一欄**依序**判定,命中第一個就照那列處理:

| 順序 | 原因                            | 後端對該欄的值                             | 規則驗證(送出 / 修改時)        |
| ---- | ------------------------------- | ------------------------------------------ | ------------------------------ |
| 1    | `visibleWhen` 算出 false        | 清空(null)                                 | 不驗                           |
| 2    | `computed` / `constant`         | 後端算 / 用定義值,送來的忽略               | 驗算出的結果(必填算成 null 擋) |
| 3    | 沒有欄位級 `edit`(或看不到這欄) | 保留既有值;送來的與既有不同 → 403 整筆拒絕 | 不驗                           |
| 4    | `readonlyWhen` 算出 true        | 保留既有值,送來的忽略                      | 驗既有值                       |
| —    | 一般可填                        | 存送來的值                                 | 全驗                           |

- 條件以**後端算出的**為準;算條件用的值 = 既有值套上操作者「改得動」的欄位送來的值 + 計算欄位(改不動的欄位送什麼都不影響條件)。
- 「沒動」的判定比**識別**而不是整個物件:選項比 value、引用比 id、上傳比 path、數字比數值;沒送、或對看不到的欄位原樣送回 `"[redacted]"` 都算沒動。
- **存草稿放寬的只有完成資料所需的驗證**(必填 / 範圍 / 長度 / 格式 / custom / 選項是否還在);守門照常(403、computed 由後端算、隱藏清空),另驗型別與表達式可算。
- 送出與已完成修改時,類別 / lookup 選項與引用**重取 label 寫快照**(引用重驗來源可讀);與上一個已完成修訂相同的值保留原快照(來源停用或刪除不擋整筆修改)。label 重取後再算一次計算欄位,`optionLabel` 看到的是新快照。
- 上傳欄只收本 API 簽出來的 `form/` 路徑(`FORM_ATTACHMENT` 用途,私有 bucket;檔型與大小同示範模組的附件)。
- `values` / `summary` / `revision` / `revisions[]` / `editVersion` 在**同一次**條件更新寫入(條件含 `editVersion`,已完成修改另含 `revision`)。

## 讀取投影

`form-values/field-states.ts`、`field-permission-gate.ts`。

- 讀者沒有 `show` 的受保護欄位 → `"[redacted]"`。計算欄位的讀取資格 = 自己的 `show`(若設)**且**沿依賴鏈引用到的每個受保護欄位的 `show`(`@repo/domain/form` 的 `fieldProtections`;只因依賴而受保護的欄位不另建權限)。
- 權限判斷是 **mapper 規則,不走 `hasPermission`**:有效權限集合裡要有那一個具體 key(`PermissionResolver` 已把模組 `*` 展開成存在且啟用的權限,所以持 `*` 的人自動涵蓋);權限列被刪 → 對所有人視為無權,只有超級管理員看得到,模組 `*` 不放行。
- 唯讀讀取(`formSubmission(id, revision)`)**不重算、不清空**存值;`fieldStates` 的顯示 / 唯讀條件用**該修訂的 `ctx`**(`at` / `timezone` / `userId` / `orgId`)重算,不拿讀者現在的身分或時間補值;草稿用現在與建立者本人。
- **建立者一律讀得到自己的單**:單筆讀取在一般路徑(可見範圍 + 資料範圍規則)讀不到時,改走 `BaseRepository.findOwnById`(可見範圍照套、不套資料範圍規則、條件加 `createdBy = 操作者`);列表不放寬。草稿只屬於建立者(別人的草稿不列、讀不到)。
- 顯示名(現名 vs 快照)在 `form-runtime/display-names.service.ts` **批次**解析:整頁的值先依來源分組,每個類別、每個 lookup 來源各查一次(DataLoader 的做法,不逐列查)。

## lookup 登錄表

`apps/api/src/forms/lookup-providers.ts`。帶入、引用、lookup 選項都用這一張;執行時 provider 與 `filter` 一律從**版本定義**取,前端只帶 `{ formKey, version, target }` + 關鍵字。

| provider          | 可回的欄位                                          | 讀欄位要的權限                                    | 可當 `filter` | 範圍                                                           |
| ----------------- | --------------------------------------------------- | ------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| `user`            | `name`、`account`、`email`                          | `account` / `email` 要 `system.user-manager.view` | `enabled`     | 可見範圍內組織的成員(根組織不限)                               |
| `org`             | `name`、`slug`                                      | —                                                 | `enabled`     | 可見範圍內的組織                                               |
| `form_submission` | 摘要槽(`title` / `date` / `amount`)+ 那張表單的欄位 | 受保護欄位要該表單該欄的 `show`                   | —             | 來源表單所屬模組的 `view` + 可見範圍 / 資料範圍;預設只列已完成 |

- `form_submission` 來源回每一筆時,欄位依**那筆自己綁的版本**判斷:存在且非受保護 → 語意值(選項 / 引用另附 label);存在但受保護且沒有 `show` → **省略**;那一版沒有這個欄位 → `null`。
- 設計時的欄位目錄 = 來源表單目前版本的非受保護欄位 + 摘要槽;檢查器以它驗 `labelField` / `valueField` / 帶入的來源欄位。
- **新增一個來源**:`LOOKUP_PROVIDERS` 加宣告 → `LookupProvidersService.providerFor` 加實作(搜尋與依值取回都要套操作者的範圍)→ 本表補一列。

## 退役權限清理

「模組與權限」頁(根組織專屬)。`retiredFormPermissions` 列出 `source: dynamic` 且 `retiredAt` 有值的權限與使用狀況;`deleteRetiredPermission` 三層檢查:

1. 有草稿(日後含審核中)的提交綁的版本仍宣告該欄位 → 擋下(`USED_BY_DRAFTS`,附筆數與版本)。
2. 只剩已完成的提交用到 → 要 `confirmCompletedUsage: true` 才刪(`CONFIRM_REQUIRED`);刪後這些單裡的該欄位只有超級管理員看得到。
3. 沒有任何提交用到 → 直接刪。

計數**跨全部租戶**且不受操作者的可見範圍 / 資料範圍影響(`database/form-submission-usage.ts`;少算一筆草稿就會把還在用的權限刪掉)。刪 = 權限列與全部 `role_permission` 綁定一起抹掉(硬刪:權限 key 唯一,軟刪的殭屍會擋住日後同一欄位重新發布時建回同一個 key)。權限矩陣與模組樹不列退役的權限;角色對退役權限的既有綁定保留(矩陣只認得它列出的 key,不會因此被清掉)。

## api 介面

GraphQL 文件:`packages/graphql/src/documents/forms.graphql`(設計)、`form-submissions.graphql`(執行)。

**設計端**(`@RequirePermission` 守端點,「是不是自己的表單 / 站在哪裡」在 service):`forms`、`form`、`formVersion(formKey, version?)`(省略 = 草稿)、`formVersions`、`validateFormVersion`、`previewFormVersion`(兩者是 query,不落庫)、`createForm`、`updateForm`、`forkForm`、`createFormVersionDraft`、`saveFormVersionDraft`、`publishFormVersion`、`retryPublishFormVersion`、`retireCurrentVersion`、`assignFormToTenants`、`revokeFormFromTenant`、`setTenantFormEnabled`、`retiredFormPermissions`、`deleteRetiredPermission`。

**執行端**(模組是執行期的,service 依該模組的 `view` / `create` / `edit` / `delete` 判,錯誤與 `@RequirePermission` 同一種):`moduleForms(moduleKey)`、`formRuntimeVersion(formKey, version)`、`formSubmissions`、`formSubmission(id, revision?)`、`formSubmissionAttachmentUrl(id, fieldKey, revision?)`、`createFormDraft`、`saveFormDraft`、`submitFormSubmission`、`updateFormSubmission`、`deleteFormSubmission`、`formLookup`、`formLookupRecord`。

input 欄位的缺席 / `null`:

- `UpdateFormInput.name`:缺席或 `null` = 不動。`tabLabelTemplate`:缺席 = 不動、`null` 或空字串 = 清空(改回模組層模板)。
- `CreateFormVersionDraftInput.baseVersion`:缺席 / `null` = 空白草稿。
- `SaveFormDraftInput.values` / `UpdateFormSubmissionInput.values`:**整張表單的狀態**,缺席的欄位 = 清空;看不到的欄位不送或原樣送回 `"[redacted]"` 都算沒動。`CreateFormDraftInput.values` 缺席 = 空白。
- `FormLookupInput.version`:缺席 = 草稿(設計器預覽,要 `system.forms.view` 且讀得到這張表單);有值 = 已發布或已退役版(要該模組的 `create` 或 `edit`)。`target` 的 `fieldKey` / `prefillIndex` 恰給一個。

輸出欄位:

- `FormSubmissionModel.values`:讀者沒有 `show` 的欄位是字串 `"[redacted]"`(不是 `null`),前端依 `fieldStates.redacted` 判斷,不要拿值猜。`displayValues` 只有類別 / lookup 選項與引用欄;`available: false` = 來源已刪或讀者無權,顯示快照 label + 「(來源不可用)」。
- `FormLookupRecord.values`:受保護且無權的欄位**省略**(鍵不存在),那筆版本沒有的欄位為 `null`。
- `FormModel.tenantEnabled`:站在租戶內時本租戶的開關,root 視角為 `null`;`assignments` 只有 root 視角的共用表單有。
- **`abilities` 含權限**(業務模組那一種,前端直接用,不再與 `usePermissions` 相乘):`FormAbilities` 已含 `system.forms.*` 權限與「是不是自己的表單 / 站在哪裡」;`FormSubmissionAbilities.canEdit` = 草稿:建立者本人 + `create`、已完成:`edit`;`canDelete` = 草稿同 `canEdit`、已完成:`delete`;`canEditField` = 權限層面改得動的欄位(條件唯讀看 `fieldStates.readonly`)。

## 錯誤

通用碼照 GQL-04;「為什麼」放 `extensions.reason`(正本 `apps/api/src/forms/forms-error.ts`)。本模組另有兩個 code:

| code                       | 什麼情況回它                                              | 前端該做什麼                                           |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `CONFLICT`                 | 樂觀鎖或搶鎖沒搶到(規格寫的「409」),`reason` 見下         | 提示「已被別人更新,請重新載入」;發布中斷時顯示「重試」 |
| `PERMISSION_NOT_DELETABLE` | 退役權限清理的前置檢查未過;`extensions.reasons` + `usage` | 依 reasons 顯示原因;`CONFIRM_REQUIRED` 時跳確認再送    |

- `CONFLICT` 的 `reason`:`DRAFT_REVISION_MISMATCH`、`DRAFT_EXISTS`、`DRAFT_MISSING`、`PUBLISH_IN_PROGRESS`、`PUBLISH_NOT_INTERRUPTED`、`NO_CURRENT_VERSION`、`EDIT_VERSION_MISMATCH`、`REVISION_MISMATCH`、`STATUS_MISMATCH`、`CLIENT_REQUEST_REUSED`。
- `FORBIDDEN` 的 `reason`:`FIELD_FORBIDDEN`(附 `fieldKey`)、`FORM_NOT_AVAILABLE`、`NOT_FORM_OWNER`、`ROOT_ONLY`;端點層沒權限的 `FORBIDDEN` 沒有 reason。別人的草稿一律 `NOT_FOUND`(草稿只屬於建立者,不透露它存在)。
- `PERMISSION_NOT_DELETABLE` 的 `reasons`:`NOT_DYNAMIC`、`NOT_RETIRED`、`USED_BY_DRAFTS`、`CONFIRM_REQUIRED`。
- `VALIDATION_FAILED`:定義有錯 → `fields: ["definition"]` + `issues`(檢查器的 `DefinitionIssue[]`,每筆帶定位);值有錯 → `fields`(欄位 key)+ `fieldErrors`(`{ fieldKey, code, message }`,code 見 `@repo/domain/form` 的 `VALUE_ISSUE_CODES`);其他輸入錯誤照一般的 `fields`。

## 稽核

| action                                                                                           | targetType        | 記什麼                                           |
| ------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------ |
| `form.create` / `form.update` / `form.fork` / `form.assign` / `form.revoke` / `form.set-enabled` | `form`            | key、名稱、分派的租戶、開關前後                  |
| `form-version.create-draft` / `.save-draft` / `.publish` / `.retry-publish` / `.retire`          | `form_version`    | formKey、版號、draftRevision、changelog          |
| `submission.create-draft` / `.save-draft` / `.submit` / `.update` / `.delete`                    | `form_submission` | 修訂號、editVersion(**不記值**:可能含受保護欄位) |
| `permission.delete-retired`                                                                      | `permission`      | key、name、被解除的角色綁定數、已完成的使用筆數  |
