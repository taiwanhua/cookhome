# 表單引擎(技術)

表單引擎的 api 端:**表單設計**(`apps/api/src/forms/form-design/`:表單、版本、四步發布、分派 / 啟用、欄位級權限的產生與退役清理)與**表單執行**(`apps/api/src/forms/form-runtime/`:草稿 / 送出 / 修訂、欄位級投影、顯示名、lookup)。兩邊共用的判準與寫入規則在 `apps/api/src/forms/` 根目錄。定義的形狀、表達式、檢查器、值的正規化與規則驗證是前後端共用的純邏輯,在 `@repo/domain/form`。

規格正本是表單引擎的 Spec(現況摘要見 `docs/concepts/form-engine.md`);本文件寫 api 怎麼落地、選了哪些做法與為什麼。

## 用途

- 業務模組的**骨架**(路由、頁面節點、權限、資料範圍目標)由 seed 宣告(`engine: "form"`,範例 `shopping-list`);**表單**(欄位、版面、版本、分派、啟用)由 root 與租戶在「表單管理」(`system.forms`)管理。
- 所有表單模組的資料共用 `form_submissions`(模組資料表,`moduleKey` = 綁的表單所屬模組)。
- 提交「送出即完成」;審核流程另案。

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

| 操作者     | 設計端看得到                                     | 設計端改得動         | 可以新增(`moduleForms`)                    |
| ---------- | ------------------------------------------------ | -------------------- | ------------------------------------------ |
| 站在根組織 | 共用表單(客製表單只有該租戶看得到,root 也不例外) | 共用表單(owner null) | 全部共用表單(有發布版本)                   |
| 站在租戶內 | 分派來的(有 `org_form`)+ 自己的客製              | 自己的客製表單       | 本租戶 `org_form` 啟用中的表單(有發布版本) |

- `org_form` 以租戶為邊界讀(`BusinessRelationshipsRepository`),所以部門使用者(可見範圍不含租戶頂層)也查得到本租戶的列。
- 設計端讀不到一律 `NOT_FOUND`(不透露別的租戶有這張表單);讀得到但不是自己的 → `FORBIDDEN`(`NOT_FORM_OWNER`)。root 讀不到、也不能以租戶的客製表單為基底(Spec §1「只有該租戶看得到」)。
- **執行端同一條邊界**(`FormAccessService.findRuntimeForm`):`formRuntimeVersion`、`formLookup` / `formLookupRecord`、`form_submission` 來源的欄位目錄與查詢、新增資格,只認共用表單與操作者自己租戶的客製表單;別租戶的客製表單(key 猜得到 `<來源 key>_<租戶短碼>`)一律當不存在(`NOT_FOUND` / 欄位目錄沒有它的欄位)。
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

**退役目前版本**:先 `published → retired`、再 `currentVersion → null`;中斷時再呼叫一次會接著做完(版本已退役就只補後一筆)。`currentVersion` 的兩處寫入(退役、發布步驟 4c)都是條件更新 `{ currentVersion: 讀到的值 }`,讀到之後被別人改了 → `CONFLICT`(`CURRENT_VERSION_CHANGED`),不蓋掉。

**存草稿**:檢查器的錯草稿可以先存(隨 payload 的 `validation` 回);只有正則不合法 / 可能造成 ReDoS 的不收(存草稿與發布都驗過 ReDoS 才收)。

**ReDoS 檢查注入**:`validateDefinition` 的 `regexSafety` 是必填選項;實作 `recheckRegexSafety`(recheck,固定純 JS 後端)在獨立子路徑 `@repo/domain/form-regex-safety`,不在 `@repo/domain/form` 裡 —— recheck 瀏覽器版約 2.9 MB,放在 `form` 會跟著渲染器進 admin 首屏 bundle。api 的 `form-definition-checker.ts` 直接 import 它;admin 設計器以動態 `import()` 懶載入(`lib/form-engine/regex-safety-loader.ts`,模組層 promise 快取、失敗清掉下次重試),正則改動停手 300ms 才檢查、過期結果丟掉;還沒有結果時檢查結果區顯示「正則檢查中」,載入失敗顯示「存草稿時再檢查」的警告 —— 兩種情況都先不把正則判成不安全(存草稿 / 發布時 api 照驗)。

## 提交的寫入規則

`form-values/submission-values.service.ts`。每次寫入(建草稿、存草稿、送出、已完成修改)每一欄**依序**判定,命中第一個就照那列處理:

| 順序 | 原因                            | 後端對該欄的值                             | 規則驗證(送出 / 修改時)        |
| ---- | ------------------------------- | ------------------------------------------ | ------------------------------ |
| 1    | `visibleWhen` 算出 false        | 清空(null)                                 | 不驗                           |
| 2    | `computed` / `constant`         | 後端算 / 用定義值,送來的忽略               | 驗算出的結果(必填算成 null 擋) |
| 3    | 沒有欄位級 `edit`(或看不到這欄) | 保留既有值;送來的與既有不同 → 403 整筆拒絕 | 不驗                           |
| 4    | `readonlyWhen` 算出 true        | 保留既有值,送來的忽略                      | 驗既有值                       |
| —    | 一般可填                        | 存送來的值                                 | 全驗                           |

- 條件以**後端算出的**為準,而且用**最終會存下的值**算:先以「既有值 + 改得動的欄位送來的值」猜一輪分類,之後每輪用上一輪的最終值(隱藏的清空、唯讀與無權的保留既有值、計算欄位重算)重算條件,分類不變為止。被忽略的送入值因此影響不了別欄(送一個會被 `readonlyWhen` 忽略的值,不能把別欄判成隱藏、清掉它的既有值),寫入時的判定也與讀取時以存值重算的 `fieldStates` 一致。
- 「沒動」的判定比**識別**而不是整個物件:選項比 value(多選比集合、不看順序)、引用比 id、上傳比 path、數字比數值;沒送算沒動;原樣送回 `"[redacted]"` 只有在讀者**真的看不到**這欄時才算沒動,看得到的人送它就是一般的值、照型別驗證。
- **存草稿放寬的只有完成資料所需的驗證**(必填 / 範圍 / 長度 / 格式 / custom / 選項是否還在);守門照常(403、computed 由後端算、隱藏清空),另驗型別與表達式可算。
- 送出與已完成修改時,類別 / lookup 選項與引用**重取 label 寫快照**(引用重驗來源可讀);快照的 label **只取來源的非受保護欄位**(不看送出的人有沒有 show:快照存在非受保護的欄位裡,來源欄位之後改成受保護時,不能把值帶進來)。與上一個已完成修訂相同的值保留原快照(來源停用或刪除不擋整筆修改)。label 重取後再算一次計算欄位,`optionLabel` 看到的是新快照。
- 上傳欄只收本 API 簽出來的 `form/` 路徑(`FORM_ATTACHMENT` 用途,私有 bucket;檔型與大小同示範模組的附件)。
- `values` / `summary` / `revision` / `revisions[]` / `editVersion` 在**同一次**條件更新寫入(條件含 `editVersion`,已完成修改另含 `revision`)。

**設計器預覽**(`previewFormVersion`):「不套欄位級權限」只指**本表單**的欄位(閘門對本表單全開);引用與 lookup 選項的來源照樣用操作者真實的權限 —— 否則設計者可以在草稿裡放一個引用欄、把顯示欄指到別張表單的受保護欄位,再用預覽讀出原值。

## 列表欄位配置

`modules.settings.list = { columns: [ { kind: "slot" | "field", key, formKey?, width, order } ] }`,root 整份覆蓋(`setModuleListColumns`,`form-design/module-list-columns.service.ts`)。寫入時驗:摘要槽 key 只能是 `title` / `date` / `amount`;表單欄位要存在於該模組**共用表單**目前版本,且在那些版本裡都**不是受保護欄位**(`formKey` 給了就只看那一張,沒給就看模組內全部);欄寬 40–2000;同一欄不能重複。空陣列 = 清掉配置、回前端預設欄。定義檢查器讀它出 `LIST_COLUMN_MISSING` 警告;表單改版後引用到不存在的欄位不自動清,前端顯示「—」。

## 讀取投影

`form-values/field-states.ts`、`field-permission-gate.ts`。

- 讀者沒有 `show` 的受保護欄位 → `"[redacted]"`。計算欄位的讀取資格 = 自己的 `show`(若設)**且**沿依賴鏈引用到的每個受保護欄位的 `show`(`@repo/domain/form` 的 `fieldProtections`;只因依賴而受保護的欄位不另建權限)。
- 權限判斷是 **mapper 規則,不走 `hasPermission`**:有效權限集合裡要有那一個具體 key(`PermissionResolver` 已把模組 `*` 展開成存在且啟用的權限,所以持 `*` 的人自動涵蓋);權限列被刪 → 對所有人視為無權,只有超級管理員看得到,模組 `*` 不放行。
- 唯讀讀取(`formSubmission(id, revision)`)**不重算、不清空**存值;`fieldStates` 的顯示 / 唯讀條件用**該修訂的 `ctx`**(`at` / `timezone` / `userId` / `orgId`)重算,不拿讀者現在的身分或時間補值;草稿用現在與建立者本人。
- **建立者一律讀得到自己的單**:單筆讀取在一般路徑(可見範圍 + 資料範圍規則)讀不到時,改走 `BaseRepository.findOwnById`(可見範圍照套、不套資料範圍規則、條件加 `createdBy = 操作者`);列表不放寬。草稿只屬於建立者(別人的草稿不列、讀不到)。
- **定義也依讀者投影**(`formRuntimeVersion`,`form-runtime/definition-projection.ts`,判準同一支 `canShow`):讀得到的欄位照回;讀不到的(沒有自己的 `show`,或計算欄位沿依賴鏈引用到沒有 `show` 的受保護欄位)只回骨架 `{ key, label, type, widget: { kind }, valueSource: { kind }, permission, redacted: true }` —— `constant.value`、計算公式(可能內嵌常數)、`options`、`rules`、`help`、條件、引用來源一律省略(骨架的 `expr` / `value` 為 `null`)。有 `show` 的人照回完整定義。設計端的 `formVersion` / `formVersions` 不投影(設計者本來就要看全部)。`layout`、`summaryMap`、`prefills` 不投影:它們只列欄位 key(`prefills[].mapping` 會列出骨架欄位的 key),不含受保護欄位的內容;帶入時寫不寫得進該欄由 `canEdit` 擋,來源值經 `formLookup` 依欄位權限省略。
- 顯示名(現名 vs 快照)在 `form-runtime/display-names.service.ts` **批次**解析:整頁的值先依來源分組,每個類別、每個 lookup 來源各查一次(DataLoader 的做法,不逐列查)。

## 欄位管理類別選項

`formFieldOptions`(`form-runtime/form-field-options.service.ts`):選項欄(`options.kind = "fieldCategory"`)給填寫者取當前選項,**不需要** `system.field-manager.view`。前端只帶 `{ formKey, version, fieldKey }`,類別 key 從版本定義取(與 `formLookup` 同一原則);範圍是 `FieldCategoryOptionsService` 的合併範圍(送出時驗值、顯示名解析用的同一支),只回啟用的,依欄位管理的排序值、建立順序排。

| 情況                                                  | 回什麼                                                 |
| ----------------------------------------------------- | ------------------------------------------------------ |
| 表單不存在、別租戶的客製表單、版本不是已發布 / 已退役 | `NOT_FOUND`                                            |
| 沒有該模組 `view` / `create` / `edit` 任一            | `FORBIDDEN`(無 reason,同 `formRuntimeVersion`)         |
| 欄位不存在或不是類別選項                              | `VALIDATION_FAILED`(`fields: ["fieldKey"]`)            |
| 讀者讀不到這一欄(受保護欄位沒有 `show`)               | `FORBIDDEN`(無 reason;先於欄位種類判,不透露 `options`) |
| `version` 省略(設計器預覽草稿)                        | 要 `system.forms.view` 且讀得到這張表單;不套欄位級權限 |

「表單可用」取執行端的邊界(共用表單或本租戶客製表單,`findRuntimeForm`),**不**要求表單此刻可新增:租戶停用或收回分派後,既有的草稿 / 已完成的單仍可存、可修改(`saveFormDraft` / `updateFormSubmission` 不看新增資格),選項也要拿得到。

## lookup 登錄表

`apps/api/src/forms/lookup-providers.ts`。帶入、引用、lookup 選項都用這一張;執行時 provider 與 `filter` 一律從**版本定義**取,前端只帶 `{ formKey, version, target }` + 關鍵字。目標是欄位(lookup 選項欄 / 引用欄)時,讀者還要讀得到那一欄:受保護欄位沒有 `show` → `FORBIDDEN`(先於「有沒有 lookup 來源」判,不從錯誤碼透露定義;草稿預覽不套)。

| provider          | 可回的欄位                                          | 讀欄位要的權限                                                                    | 可當 `filter` | 範圍                                                           |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| `user`            | `name`、`account`、`email`                          | `account` / `email` 要 `system.user-manager.view`(以它們當 `valueField` 反查也要) | `enabled`     | 可見範圍內組織的成員(根組織不限)                               |
| `org`             | `name`、`slug`                                      | —                                                                                 | `enabled`     | 可見範圍內的組織                                               |
| `form_submission` | 摘要槽(`title` / `date` / `amount`)+ 那張表單的欄位 | 受保護欄位要該表單該欄的 `show`                                                   | —             | 來源表單所屬模組的 `view` + 可見範圍 / 資料範圍;預設只列已完成 |

- `form_submission` 來源回每一筆時,欄位依**那筆自己綁的版本**判斷:存在且非受保護 → 語意值(選項 / 引用另附 label);存在但受保護且沒有 `show` → **省略**;那一版沒有這個欄位 → `null`。
- 設計時的欄位目錄 = 來源表單目前版本的非受保護欄位 + 摘要槽;檢查器以它驗 `labelField` / `valueField` / 帶入的來源欄位。
- **新增一個來源**:`LOOKUP_PROVIDERS` 加宣告 → `LookupProvidersService.providerFor` 加實作(搜尋與依值取回都要套操作者的範圍)→ 本表補一列。

## 退役權限清理

「模組與權限」頁(根組織專屬)。`retiredFormPermissions` 列出 `source: dynamic` 且 `retiredAt` 有值的權限與使用狀況;`deleteRetiredPermission` 三層檢查:

1. 有草稿(日後含審核中)的提交綁的版本仍宣告該欄位 → 擋下(`USED_BY_DRAFTS`,附筆數與版本)。
2. 只剩已完成的提交用到 → 要 `confirmCompletedUsage: true` 才刪(`CONFIRM_REQUIRED`);刪後這些單裡的該欄位只有超級管理員看得到。
3. 沒有任何提交用到 → 直接刪。

計數**跨全部租戶**且不受操作者的可見範圍 / 資料範圍影響(`database/form-submission-usage.ts`;少算一筆草稿就會把還在用的權限刪掉)。刪的順序:先寫稽核 → 刪權限列 → 解除全部 `role_permission` 綁定(硬刪:權限 key 唯一,軟刪的殭屍會擋住日後同一欄位重新發布時建回同一個 key);每一步重做都無害,中途失敗殘留的綁定指向不存在的權限列、不生效。**檢查使用量到真的刪之間沒有鎖**:這段時間有人新建草稿綁到宣告該欄位的版本,那筆草稿的該欄位之後只有超級管理員看得到。權限矩陣與模組樹不列退役的權限;角色對退役權限的既有綁定保留(矩陣只認得它列出的 key,不會因此被清掉)。
**權限矩陣的租戶邊界**(`roles/role-matrix.service.ts`):欄位級權限依 key 拆出 formKey,只列共用表單與操作者自己租戶的客製表單的那幾筆(根組織操作者只看得到共用表單的);存檔時送了別租戶(或已不存在的)表單的欄位級權限 → `ROLE_OUT_OF_REACH`。持模組 `*` 的角色在解析時仍涵蓋該模組全部權限(含別租戶的),但那些欄位所在的提交本來就在別的租戶,讀不到。

## admin 頁面

### 表單管理(`system.forms`)

`apps/admin/src/pages/system/FormsPage/`。左清單、右面板:

| 畫面                   | 做什麼                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 表單清單               | 搜尋;每列名稱、key、模組、共用 / 客製、目前版本或「無發布版本」、停用、發布中斷、有草稿;「+ 建立表單」(共用表單,只有站在根組織才建得成,租戶收到 `ROOT_ONLY`)                                                                                                                                                                                                                                                                                                                           |
| 右側標頭               | 編輯名稱與頁籤模板(`abilities.canEdit`)、以此為基底建新表單(`canFork`)、分派租戶(`canAssign`)、在本租戶啟用開關(`canSetEnabled`)                                                                                                                                                                                                                                                                                                                                                       |
| 設計(頁籤)             | 元件面板 / 畫布(`FormRenderer` 設計模式,dnd-kit 拖拉)/ 屬性面板 / JSON 預覽 / 檢查結果(點擊定位);表單設定(摘要槽、帶入規則);存草稿帶 `expectedDraftRevision`;「預覽」切 `preview` 模式(即時跑條件與計算,「以後端重算」後以 `previewFormVersion` 回的值與顯示 / 唯讀為準)。**未存的變更不會無聲消失**:「設計 / 版本」兩頁籤都保持掛載;有未存變更時換表單先跳窗(留在設計 / 放棄變更 / 先存草稿);發布跳窗提示「發布的是上次存的草稿」並提供先存(狀態經 `stores/useDesignerDraftStore.ts`) |
| 版本(頁籤)             | 草稿與各版本、發布(changelog 必填)、發布中斷重試、退役目前版本、與上一版差異、以任一版本為基底開新草稿                                                                                                                                                                                                                                                                                                                                                                                 |
| 分派跳窗               | 勾租戶 = 分派、取消勾 = 收回(只有平台)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 以此為基底建新表單跳窗 | 選基底版本、填 key(建立後不可改)與名稱                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

- 設計器的表達式一律用**結構化選擇器**(欄位 / 上下文 / 常數 / 運算,可巢狀),不做文字輸入。
- 刪被引用的欄位:先列出草稿內引用它的表達式、摘要槽、帶入規則,以及草稿外的列表欄位配置(只提示);確認後只從草稿的 `fields[]` / `layout` 移除,引用處變成檢查器錯誤。刪分區二選一:欄位移到「未放置」或連同欄位刪除。
- 存草稿 / 發布收到 `CONFLICT` → 「已被別人更新,請重新載入」。

### 模組與權限(`system.module-manager`)

- 表單模組(`engine: FORM`)的右面板多一塊**列表欄位配置**(`setModuleListColumns`,`system.forms.edit` + 站在根組織):選摘要槽或表單欄位、排序、欄寬。
- 頁首「退役權限清理」(`system.module-manager.delete-retired-permission`):列 `retiredFormPermissions`(顯示權限 `name`、表單、欄位、使用筆數),刪除走三層檢查:`USED_BY_DRAFTS` 顯示筆數與版本、`CONFIRM_REQUIRED` 先確認再帶 `confirmCompletedUsage: true`。

### 引擎零件與預設組裝

| 零件                                                                              | 檔案(`apps/admin/src/`)                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `FormRenderer`(五種 `mode`)、設計模式的格子與放置區                               | `components/form-engine/FormRenderer/`                                   |
| widget 登錄表(`widget.kind` → 元件)                                               | `components/form-engine/widgets/widget-registry.ts`                      |
| `FormSubmissionList` / `FormSubmissionDetail`(含修訂紀錄與差異)                   | `components/form-engine/FormSubmissionList.tsx`、`FormSubmissionDetail/` |
| `FormPicker` / `LookupDialog` / `ReferenceField`                                  | `components/form-engine/`                                                |
| `renderValue(ctx)` / `FormValue`                                                  | `components/form-engine/render-value.ts`、`FormValue.tsx`                |
| `formModulePages(moduleKey)` 與四個預設頁                                         | `components/form-engine/FormModulePages/`                                |
| 純邏輯:欄位狀態(五種 mode)、欄位級權限來源、設計器操作、帶入、修訂差異            | `lib/form-engine/`                                                       |
| `useModuleForms` / `useFormDraft` / `useFormSubmission` / `useFormRuntimeVersion` | `hooks/`                                                                 |

- 欄位級權限:已有提交 → 用 api 的 `fieldStates.redacted` 與 `abilities.canEditField`;新增、草稿還沒建 → 由持有的 `<模組>.show-/edit-<formKey>-<fieldKey>` 推(推錯只影響畫面,寫入仍由 api 守)。
- 選項欄三種來源統一在 `components/form-engine/widgets/useFieldOptions.ts`:靜態清單讀定義、類別選項打 `formFieldOptions`(先取前 100 筆、前端比對關鍵字;api 回的 `totalCount` 大於取回筆數時,打字搜尋改送 api 的 `keyword`。沒有搜尋框的下拉 / 單選鈕只列前 100 筆)、lookup 打 `formLookup`(關鍵字送 api)。類別選項的查詢失敗時該欄只顯示既有值、改不了。
- 定義裡標 `redacted: true` 的欄位(`formRuntimeVersion` 的骨架)一律當讀不到、整格不渲染(`lib/form-engine/field-states.ts`、`field-permissions.ts`);骨架省略了公式,所以「只因依賴而受保護」的計算欄位靠這個旗標,不靠權限 key 推。

## api 介面

GraphQL 文件:`packages/graphql/src/documents/forms.graphql`(設計)、`form-submissions.graphql`(執行)。

**設計端**(`@RequirePermission` 守端點,「是不是自己的表單 / 站在哪裡」在 service):`forms`、`form`、`formVersion(formKey, version?)`(省略 = 草稿)、`formVersions`、`validateFormVersion`、`previewFormVersion`(兩者是 query,不落庫)、`createForm`、`updateForm`、`forkForm`、`createFormVersionDraft`、`saveFormVersionDraft`、`publishFormVersion`、`retryPublishFormVersion`、`retireCurrentVersion`、`assignFormToTenants`、`revokeFormFromTenant`、`setTenantFormEnabled`、`retiredFormPermissions`、`deleteRetiredPermission`、`setModuleListColumns`(`system.forms.edit` + 站在根組織)。`moduleListColumns(moduleKey)` 給該模組的使用者讀(有 view / create / edit 任一)。

**執行端**(模組是執行期的,service 依該模組的 `view` / `create` / `edit` / `delete` 判,錯誤與 `@RequirePermission` 同一種):`moduleForms(moduleKey)`、`formRuntimeVersion(formKey, version)`、`formSubmissions`、`formSubmission(id, revision?)`、`formSubmissionAttachmentUrl(id, fieldKey, revision?)`、`createFormDraft`、`saveFormDraft`、`submitFormSubmission`、`updateFormSubmission`、`deleteFormSubmission`、`formLookup`、`formLookupRecord`、`formFieldOptions`(類別選項,見上)。綁了審核流程的表單另有 `withdrawSubmission`、`voidSubmission`、`copySubmissionToDraft`(規則見 `docs/modules/workflows.md`)。

**提交狀態與審核流程**(6b):`FormSubmissionStatus` 七值(`DRAFT` / `REVIEWING` / `RETURNED` / `WITHDRAWN` / `COMPLETED` / `REJECTED` / `VOIDED`)。綁流程的表單送出不經 `COMPLETED`、直接 `REVIEWING`(`submitFormSubmission` 內走審核流程的寫入順序,送出時檢查擋下回 `FORBIDDEN` + reason);`RETURNED` / `WITHDRAWN` 由申請人以 `saveFormDraft` 改內容、再 `submitFormSubmission`(修訂 +1)。`formSubmissions` 列出草稿以外的所有狀態(草稿只給建立者);`updateFormSubmission` 只收**沒走過流程**的 `COMPLETED`(走過流程的核准後鎖定、只能作廢 → `CONFLICT` `STATUS_MISMATCH`);`deleteFormSubmission` 可刪草稿 / `RETURNED` / `WITHDRAWN`(建立者本人,`create`)、沒走過流程的 `COMPLETED` 與 `REJECTED`(`delete`),其他狀態 → `CONFLICT` `STATUS_MISMATCH`。單筆讀取與附件的授權是 `canReadSubmissionRevision`:建立者讀全部修訂;任務持有者只讀他審的修訂(`revision` 省略 = 其中最新的一個,摘要改用該修訂實例上的快照);`formRuntimeVersion` 對持有該表單任務的人也開放。

input 欄位的缺席 / `null`:

- `UpdateFormInput.name`:缺席或 `null` = 不動。`tabLabelTemplate`:缺席 = 不動、`null` 或空字串 = 清空(改回模組層模板)。
- `CreateFormVersionDraftInput.baseVersion`:缺席 / `null` = 空白草稿。
- `SaveFormDraftInput.values` / `UpdateFormSubmissionInput.values`:**整張表單的狀態**,缺席的欄位 = 清空;看不到的欄位不送或原樣送回 `"[redacted]"` 都算沒動。`CreateFormDraftInput.values` 缺席 = 空白。
- `FormFieldOptionsInput`:`version` 缺席 = 草稿(同下一條);`keyword` 缺席 / 空字串 = 全部(比對顯示名與值,不分大小寫);`pageSize` 預設 100(上限 100)。
- `FormLookupInput.version`:缺席 = 草稿(設計器預覽,要 `system.forms.view` 且讀得到這張表單);有值 = 已發布或已退役版(要該模組的 `create` 或 `edit`)。`target` 的 `fieldKey` / `prefillIndex` 恰給一個。

輸出欄位:

- `FormSubmissionModel.values`:讀者沒有 `show` 的欄位是字串 `"[redacted]"`(不是 `null`),前端依 `fieldStates.redacted` 判斷,不要拿值猜。`displayValues` 只有類別 / lookup 選項與引用欄;`available: false` = 來源已刪或讀者無權,顯示快照 label + 「(來源不可用)」。
- `formRuntimeVersion` 的 `fields`:讀者讀不到的欄位是骨架且 `redacted: true`(見「讀取投影」);`redacted` 缺席 = 完整定義。
- `FormLookupRecord.values`:受保護且無權的欄位**省略**(鍵不存在),那筆版本沒有的欄位為 `null`。
- `FormModel.tenantEnabled`:站在租戶內時本租戶的開關,root 視角為 `null`;`assignments` 只有 root 視角的共用表單有。
- **`abilities` 含權限**(業務模組那一種,前端直接用,不再與 `usePermissions` 相乘):`FormAbilities` 已含 `system.forms.*` 權限與「是不是自己的表單 / 站在哪裡」;`FormSubmissionAbilities.canEdit` = 草稿 / 被退回 / 撤回:建立者本人 + `create`、沒走過流程的已完成:`edit`(走過流程的已完成為 false);`canDelete` = 草稿 / 被退回 / 撤回:建立者本人 + `create`、沒走過流程的已完成 / 已駁回:`delete`;`canWithdraw` = 建立者、審核中;`canVoid` = 走過流程的已完成、建立者或 `edit`;`canCopy` = 已作廢 + `create`;`canEditField` = 權限層面改得動的欄位(條件唯讀看 `fieldStates.readonly`)。只審過某修訂的讀者一律 false。

## 錯誤

通用碼照 GQL-04;「為什麼」放 `extensions.reason`(正本 `apps/api/src/forms/forms-error.ts`)。本模組另有兩個 code:

| code                       | 什麼情況回它                                              | 前端該做什麼                                           |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `CONFLICT`                 | 樂觀鎖或搶鎖沒搶到(規格寫的「409」),`reason` 見下         | 提示「已被別人更新,請重新載入」;發布中斷時顯示「重試」 |
| `PERMISSION_NOT_DELETABLE` | 退役權限清理的前置檢查未過;`extensions.reasons` + `usage` | 依 reasons 顯示原因;`CONFIRM_REQUIRED` 時跳確認再送    |

- `CONFLICT` 的 `reason`:`DRAFT_REVISION_MISMATCH`、`DRAFT_EXISTS`、`DRAFT_MISSING`、`PUBLISH_IN_PROGRESS`、`PUBLISH_NOT_INTERRUPTED`、`NO_CURRENT_VERSION`、`CURRENT_VERSION_CHANGED`、`EDIT_VERSION_MISMATCH`、`REVISION_MISMATCH`、`STATUS_MISMATCH`、`CLIENT_REQUEST_REUSED`、`ALREADY_COPIED`(複製為新單:來源已複製過)。
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
| `module.set-list-columns`                                                                        | `module`          | 配置前後的欄位清單                               |
