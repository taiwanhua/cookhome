# Seed、migration 與專案設定交付規格

本文件固定底座同步工作包 C 的實作契約。**這是待實作規格,不是現有指令已具備的能力。** 實作、驗收與部署狀態見所屬 issue/PR。接手者先讀 `CLAUDE.md`、[文件入口](../README.md)、[協作規則](../agents/collaboration.md),再讀本文件與自己負責的票。底座 repo、初始化 skill、Figma 及跨 repo 升級工具仍屬[其他工作包](base-sync.md)。

## 目標與已確認邊界

同一引用專案的不同環境,部署同一版本後應得到相同的受管表單、流程與宣告設定。各環境的資料庫 id、歷史版號、組織、人員、租戶分派與案件不必相同。新安裝、持續升級與重置重建共用來源和執行器;不能用 reset 取代一般升級。

| 內容                                                         | 維護歸屬與行為                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| Seed 契約、組裝、驗證、執行器、發布與 reset 工具             | 底座維護                                                    |
| 底座模組、權限、角色模板、示範資料                           | 底座來源;專案新增內容另存,同 key 不靜默覆蓋                 |
| 專案根組織初值、專案模組與選項、明確登記的共用表單及共用流程 | 專案來源,跟隨 Git 版本交付                                  |
| UI 自建但未登記的共用定義、租戶客製或 fork 定義              | 保留原本獨立維護的機制,不隨來源版本自動覆寫                 |
| 組織、帳號、租戶分派與啟用、表單與流程綁定、角色與審核人員   | 各環境人工維護;不從開發環境匯出至別的環境                   |
| 提交、修訂、流程實例與任務                                   | 各環境業務資料;只由明確 migration 處理,進行中流程不自動換版 |

一般 seed 保留根名稱、描述(含 `null`)與既有初始值欄位;root 帳號存在時不重設密碼。模組 `enabled`、`icon`、`settings` 保留 UI 值,示範初建啟用不變。授權關聯只補不刪;新增能力對 wildcard、個別授權及租戶角色副本的影響仍須列入升級報告。上述初始值保留是明確例外,不把「同一版本」解讀成覆蓋所有現場設定。

## 現有機制與延伸位置

| 正本                                                              | 已具備的機制                                            | C 的延伸                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/db-migrator/src/seed/seed-declaration.ts`、`seed-runner.ts` | TypeScript `SeedSet`、key 認養、初始值保護、關聯補建    | 共用純契約、來源碰撞檢查、新增版本化定義種類                      |
| `apps/db-migrator/seeds/registry.ts`                              | 單一依序登記入口                                        | 底座/專案分來源,入口固定,引用先於使用者                           |
| `apps/db-migrator/migrate-mongo-config.js`、`migrations/`         | `.js` migration、`changelog.fileName`、`changelog_lock` | 保留歷史身分,收集兩個來源,串接設定與資料變更                      |
| `apps/api/src/forms/form-design/`、`workflows/workflow-design/`   | 草稿、檢查、發布、退役、重試及表單動態權限              | 增加 seed 適配與匯出,重用服務及 `versioning/version-lifecycle.ts` |
| `apps/api/src/forms/form-runtime/form-upgrade.service.ts`         | 本租戶、無流程綁定的提交升版                            | 保留適用範圍與修訂保護;不得擴成所有案件自動改版                   |
| `apps/db-migrator/src/reset/`                                     | registry 推導刪留、data/full                            | 納入受管定義依賴,production 改成操作者確認                        |
| `.github/workflows/deploy.yml`、`reset-db.yml`                    | 手動部署與重置                                          | 串接同一設定執行入口、純設定變更判定及明確確認                    |

Seed 繼續用 `.ts`,migration 繼續用 `.js`;不建立第二份人工維護的 JSON。UI 匯出的 `.ts` 本身就是專案 seed 正本,不是另外待轉抄的備份。跨程序的序列化資料只作機器傳輸,不進 repo、不成為第二份設定來源。

## 來源、所有權與固定組裝入口

目標位置如下;既有路徑需由各票同步修正引用和測試,不留下永久雙登記入口。

| 位置                                                       | 責任                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/domain/src/seed/` → `@repo/domain/seed`          | `SeedSet` 等純型別、可攜定義驗證、穩定序列化與 TS 匯出;沿用 `/form`、`/workflow` 型別            |
| `apps/db-migrator/src/seed/`                               | DB 解析、既有 documents/relations/root-admin 處理器;舊型別檔只 re-export 共用契約                |
| `apps/db-migrator/seeds/base/`                             | 既有底座/示範宣告、宣告 helper、`registry.ts`                                                    |
| `apps/db-migrator/seeds/project/`                          | `settings.ts` 專案初值、`registry.ts` 專案種子與定義登記;業務 `.ts` 宣告按模組分檔               |
| `apps/db-migrator/seeds/{base,project}/revisions/`         | 不可變的 `.seed.ts` 快照;匯出檔即快照,目前 registry 只引用當前有效者,舊快照供明示 migration 依賴 |
| `apps/db-migrator/seeds/registry.ts`                       | 唯一組裝入口,讀 project 初值後傳入底座工廠,合成並驗兩方來源                                      |
| `apps/db-migrator/migrations/`                             | 已發布歷史檔案原名原內容保留;不再新增一般 migration 到根目錄                                     |
| `apps/db-migrator/migrations/base/`、`migrations/project/` | 新的底座與專案 migration,共享全域唯一 filename 規則                                              |
| `apps/db-migrator/src/update/`                             | 計畫、執行順序、migrate-mongo 適配、API 子程序及續跑                                             |
| `apps/api/src/seed/`                                       | 版本定義的專用 Nest module、發布適配器、安裝紀錄;不提供任意 DB 寫入 API                          |
| `apps/api/src/seed/run.ts`                                 | 同一 checkout 中的受控 CLI,建置為 `dist/seed/run.js`;不開 HTTP、不登入瀏覽器、不啟動應用背景任務 |

`base/` 不 import `project/`,只有固定組裝入口可讀兩方。根組織的結構、key、初始值欄位政策由底座定義;`seeds/project/settings.ts` 提供 `rootOrg: { name, description, settings }`。`createBaseSeedRegistry(settings)` 接受經驗證的值,不得讓專案重宣告 `orgs/root` 來覆蓋底座。既有 gender、demo-category、示範資料留底座,不趁搬檔改值、key 或授權。

一般模組宣告 helper 新增可選的 `settings` 初值,沿用 `initialSeedValueFields`;不新增第二套模組設定發布器。既有底座模組若有專案初值需求,由 project settings 的 `moduleInitialValues` 明列模組 key 與 `enabled`、`icon`、`settings`,組裝時只允許這三欄,未知模組或其餘欄位拒絕。已存在的 UI 值仍優先。

兩方 registry 都回傳 `SeedSource { moduleDeclarations: readonly ModuleSeedDeclaration[], seeds: SeedRegistry }`,沿用既有 ModuleSeedDeclaration/helper;底座由 `createBaseSeedRegistry(settings): SeedSource` 產生。`seeds/registry.ts` 合併兩方 moduleDeclarations 後,呼叫 `composeModuleSeeds(declarations, moduleInitialValues)` **只推導一次** modules、permissions、dataScopeTargets、tenantAdminBindings,再與兩方普通 seeds 組裝。禁止 project 直接用 documents 再宣告這四類已推導內容。專案子模組可掛底座父節點,依整棵樹計算父路徑與root-only繼承。引用順序由既有seedRef與關聯端點、模組父節點推導;普通documents的內部條目亦排序,而非只排序整個set。seedRef維持現有頂層/陣列語意,遇巢狀未支援位置先報錯,不宣稱已能遞迴解析。

合成驗證在任何寫入前完成:

- documents 依 collection、keyField、key 及既有 `match` 身分判斷碰撞,不能靠後載入覆蓋;相同 collection 的 key/match 政策須相容。relations 可將完全相同的關聯去重,不增加撤銷語意。root-admin 只允許一份。
- seed 引用、模組父子、權限、資料目標與角色模板的引用需可解析。使用者宣告的依賴與可推導引用共同排序;漏引用、重名與循環指出來源檔和 key。
- 租戶管理員模板由組裝後的全部模組與權限推導,排除根組織專屬模組;既有租戶副本不自動擴權。底座工廠不可只看自己的模組而漏專案新增。
- forms/workflows/versions、安裝紀錄及發布器產生的 dynamic permissions 不可經一般 documents 寫入;不得把版本化發布繞回 raw upsert。

## 可攜定義與同一份 TypeScript seed

在既有 `SeedSet` union 新增 `form-definition` 與 `workflow-definition`。每份宣告描述一個明確內容版本;業務內容依既有 `FormDefinition`、`WorkflowDefinition`,不重新發明欄位/關卡 schema。

兩類共用欄位為 `key`、`revision`、`name`、`changelog`、`definition`、`desiredStatus: "published" | "retired"`;form 另有 `moduleKey`、`tabLabelTemplate: string | null`,workflow 另有 `checkFormKey: string | null`。`revision` 是專案內該 key 的不變發布識別字串,不是來源 DB 版號或 Git tag,格式固定為小寫英數開頭、後接英數/底線/連字號,長度最多 64。內容或目標狀態修正產生新 revision,同 revision 不得改內容。文件缺席與 `null` 的語意由型別固定:上述可清空欄位必填且用 `null` 表示清空,不帶入 DTO 的「缺席 = 不動」更新語意。

匯出由共用 `serializeSeedSet(set): string` 產出 `.ts`,使用 `import type { SeedSet } from "@repo/domain/seed"`、具名 `seed` export 與 `satisfies SeedSet`。內部用安全字串編碼,不把名稱、說明、公式或 changelog 插成可執行模板。專案登記檔 import 該 export;型別檢查、UI 匯出、CLI 與 runtime 驗證共用契約。表單/流程 key 沿用底線格式,不誤套一般 seed 的 kebab-case。

### 可攜範圍

- 只匯出共用定義(`ownerOrgId = null`;workflow 的 `tenantId` 亦為 null),版本須已發布且測試完成。只選取明確版本,不以「當下最新」代替。匯出不寫來源 DB,納入 repo 才成為待交付設定。
- 排除 `_id`、組織/使用者/角色 id、DB 版號、時間戳、publishedBy、currentVersion、draftRevision、forkedFrom、分派與綁定。原始表單欄位 key、流程關卡 key、表單引用 key 保留。
- 共用流程的 users 審核來源與非空 roleId 拒絕;角色使用既有 placeholder,主管與表單欄位來源照既有檢查器。租戶 fork 的實際角色仍由人設定。
- 遞迴檢查欄位與 array columns、lookup filter、constant/default、prefills、表達式與流程條件。依欄位/provider 語意拒絕寫死的環境資料引用;使用者/組織/角色/提交/上傳物件的固定 id 或值不能帶走。`ctx.user.*` 等既有動態表達式可保留。不能只搜 24 位字串就當完成驗證,也不能把一般文字誤當 id。
- 欄位類別、模組、被引用表單必須有同一計畫可解析的穩定 key。缺少受管依賴列出精確位置,不偷偷匯出整個資料庫或抹掉設定。可攜性不符時整份匯出失敗,UI 顯示路徑與修正原因。

`packages/domain/src/seed/portable-definition.ts` 是可攜性規則唯一正本,UI 匯出及 CLI 都呼叫 `validatePortableDefinition(seed, catalog): ValidationReport`。這是既有定義檢查之上的交付檢查,不改寫 runtime schema 或限制一般 UI 自建定義。第一版的精確邊界如下:

| 位置                   | 允許                                                                                           | 拒絕                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| lookup provider/filter | 既有 user/org:空filter或只有boolean enabled;form_submission:空filter,formKey指向可解析共用定義 | 未知provider/filter,本地id條件;不得忽略未知filter                                                      |
| reference/upload固定值 | 缺席、null或空集合;reference既有合法ctx.user.id/orgId預設表達式                                | 非空constant/default,含上傳path或帶label的reference物件                                                |
| lookup選項固定預設     | 缺席、null或空集合;選項仍在執行期查詢                                                          | 現有user/org/form_submission皆屬環境資料,非空固定value一律拒絕,不因改用account/slug而繞過;多選逐項同驗 |
| 靜態選項/欄位類別      | 現有靜態values;受管category key與普通seed選項                                                  | 用本地實體id假冒reference/lookup固定值                                                                 |
| 共用流程assignee       | manager、可解析formKey/fieldKey、roleId=null且有placeholder的role                              | users、非空roleId、指向租戶客製form                                                                    |

表達式檢查沿用既有 `scanExpression` 和欄位依賴圖,加上 ID 語意而非另寫求值器。`ctx.user.id`、`ctx.user.orgId`、reference 欄位及 lookup 的 id 值標為 ID(多選標為 ID 集合);prefill 由 provider.id 帶入的目標亦傳播此標記,computed/引用欄位沿依賴鏈傳播。`var` 路徑沿用既有裸欄位 key/`row.*`/`ctx.*`,不新增 `values.*` 語法。覆蓋 default、computed、rules.custom、visibleWhen、readonlyWhen、skipWhen 與條件分支:

- ID 的相等/不等比較只允許另一個動態 ID 或 null;`in` 只允許動態 ID 集合或空陣列。寫死非空字串/物件/陣列一律報錯,不判斷它像不像 ObjectId。
- `if` 的回傳分支傳播 ID 語意;ID 分支不能混入非空固定值。`and`/`or`/`!` 的條件可判空或真假,其回傳值依現有運算子語意傳播,不能藉此把固定字串包成 ID。
- 其他運算子若直接接收 ID/ID 集合(含字串拼接、數字/日期運算或未知轉型)拒絕;`optionLabel` 依既有定義解析為顯示文字,不把文字誤當 ID。未涉及 ID 的普通數值、日期、文字與條件仍走原檢查器。
- 不能確定 provider/欄位資料流語意時報具體不支援的位置,不默默略過。兩端共用的正反例至少包含「文字欄24碼常數通過」「ctx.user.id與reference動態比較通過」「reference與固定短字串比較拒絕」「if/and包固定ID拒絕」「array columns與prefill後的間接ID拒絕」。

### UI 操作與發布時機

開發用途環境用現有設計器編輯、發布並試填/測流程;草稿預覽不能冒充實際發布驗收。準備該 issue PR 時在表單/流程版本面板選定已測版本,按「匯出專案設定」取得 `.ts`,由開發者納入專案 registry。使用者輸入 revision 與發布說明,介面明示此操作只匯出設定、不含人員或分派。

匯出權限沿用設計服務的根組織、讀取與發布判準:表單 `system.forms.view` 加 `system.forms.edit`,流程 `system.workflows.view` 加 `system.workflows.publish`,API 必須自行驗證,不能只隱藏按鈕。GraphQL 分別增加 `exportFormSeed(input: {formKey, version, revision, changelog})`、`exportWorkflowSeed(input: {workflowKey, version, revision, changelog})`,回傳 `{ fileName, source }`。這是唯讀 query,不接受使用者指定伺服器檔案路徑、不執行上傳 TS。`fileName` 固定為 `<key>.<revision>.seed.ts`,匯出 `desiredStatus: "published"`;明示退役由開發者以同一契約的新 revision 提交。錯誤沿用各模組既有錯誤包裝並帶欄位路徑。

同一 feature 分支包含匯出 seed、必要 migration 與驗收。先在隔離空庫重建,再驗既有資料升級;只在原本已有定義的 dev 回灌不算可重建證據。後續照既有 dev → staging → main 批次發布。同一版本部署只讀 repo 審查過的內容,不臨時拉 dev DB 最新設定。

## 發布、身分與衝突

db-migrator 經受控子程序呼叫 API CLI,傳入共同契約的資料;禁止 app 互相 import,也禁止在 db-migrator 再做一份發布狀態機。API CLI 載入最小 `SeedRuntimeModule`,重用既有 create/save/check/publish/retry/retire、repository、動態權限與 audit;無網頁登入、HTTP 管理端點或雲端常駐服務。

CLI 以 `ROOT_ADMIN_ACCOUNT` 查該環境實際的啟用帳號與 root,經 `OperatorContextService` 和既有 access service 取得操作者事實,逐項驗權限與根組織身分。不得使用 `actorId: null`、假造超管 facts、建假使用者或重設密碼;原 AuditService 要求真實 actor。無適用操作者時在發布前停止。先完成普通 root seed 才能在新安裝發布定義。

`SeedRuntimeModule` 明確組裝 Mongoose 連線、DatabaseModule、PermissionModule、AuditModule、FormsCoreModule、FormDesignModule 與 WorkflowDesignModule,並註冊既有 DataScopeService、OwnerProtectionService、OperatorContextService class,不複製其實作。DataScopeService 的初始化須照常註冊 DataScopeRuleProvider,不得關閉 DatabaseModule bootstrap 檢查;不用會間接啟動完整 Auth/Storage 的 OrgsModule/DataScopeModule。必要的 design service exports 由 C2 補齊。CLI facade 明驗 forms.create/edit、workflows.create/edit/publish 等實際操作所需既有權限(表單退役用edit、流程退役用publish),不能仰賴未執行的 resolver decorator。查帳號的唯讀 lookup 沿用登入線非租戶查詢模式,所有變更則使用解析後的真實操作者。

固定程序介面為 `DefinitionSeedRequest { protocolVersion: 1, runId, lockOwner, releaseCommit, operation: "apply" | "inspect", seeds: DefinitionSeedSet[] }` 與 `DefinitionSeedResult { results, errors }`。每筆 result 包含 kind/key/revision/contentHash/snapshotHash、definitionId/localVersion、`created | updated | adopted | unchanged` 或具體衝突。migrator 以 `process.execPath` 加已建置 CLI 的固定路徑啟動,不走 shell,stdin/stdout 傳一份 JSON,診斷只到 stderr;子程序失敗、格式不符或任何 errors 都使整批失敗。CLI 核對同一 DB 的 lock owner,不接受任意程式路徑。此程序介面不是使用者要維護的設定格式。

結果由 `parseDefinitionSeedResult(input, operation)` 依操作驗證。四種完成結果必須有非空 definitionId 與正整數 localVersion;`inspect` 只回 `unchanged` 或 `absent`(該 revision 尚未安裝,不是完成),`apply` 不接受 `absent`。currentVersion 非 null 時亦須為正整數。

跨環境識別使用 `(kind, key, revision)`,另存兩個 hash:contentHash 包含 kind/key、受管metadata及definition,排除 revision/changelog/desiredStatus/DB metadata;snapshotHash 包含整份宣告,用來驗同revision不可變。固定物件鍵排序並保留有語意的陣列順序,缺席/空值正規化只依現有契約,不抹掉有語意的差異。安裝紀錄映射到該環境的 definition id 與 local version,不能把來源 `version: 3` 當成目標也必須是 3。不同環境歷史不一樣但目標內容相同即可。

- 新 key:建立共用身分與草稿,按原生命週期發布;記錄成功前核對 currentVersion、凍結內容與動態權限。
- 已受管且內容未變:不增版、不改身分、不重寫發布時間或重複稽核。已成功的紀錄仍須核對實體,不可只看到紀錄就跳過缺失資料。
- 來源 dev 已有相同 key、相同共用身分及完全相同發布內容:明確採納該版並保留 id/歷史/分派,不另發一版。初次納管的同 key 若內容不同或屬於租戶,直接衝突,不套 generic seed 的自動認養。
- 已受管改版:目前內容須符合上次安裝版本,或已等於這次要交付的已發布來源版本;除此之外視為現場漂移。來源已等於目標可採納,因此正常 dev 設計不會永久阻塞自己的部署。
- 未預期的設計草稿、別人正在 publishing、非預期 currentVersion、metadata 漂移或 revision 同名不同 hash:先報衝突,不丟棄草稿、不強制覆蓋、不自動重建 key。UI 原本的設計能力保留;部署衝突由操作者整理或重新匯出進版控。
- 本次安裝自己建立的草稿與中斷發布由安裝紀錄識別,只可接續同一 revision/hash 的操作。每一步與版本 CAS 配合,不得重試成第二個正式版本。
- 新版發布保留已發布/已退役歷史。既有修訂與進行中流程繼續引用原版;客製/fork 不自動追蹤。顯式退役沿用原服務,移除 registry 宣告本身不退役、不刪除、不撤銷分派。

安裝紀錄放 `seed_definition_installations`,唯一 `(kind,key,revision)`,至少含 contentHash、snapshotHash、localVersion、definitionId、處理狀態與可續跑 checkpoint。受管範圍的真相是當前 registry,不能只憑資料庫標記永遠保留管理權。重新登記已移除的同 key 仍按上述一致性檢查;不得因歷史 installation 存在就奪回現場內容。

所有權在第一筆身分/版本寫入前建立:installation 保存 runId、預先配置的 definitionId/draftId、預期 currentVersion/metadata、兩個hash與步驟。既有 create/create-draft 服務增加只供內部 seed facade 的預配置 ID 參數,一般 GraphQL 不開放此參數。reserved 階段若指定id仍不存在,可以按原id建立;已存在同id且內容/前置狀態符合則接續,同key不同id或非預期內容則衝突。已完成發布但尚未記成功時,核對該draftId轉成的正式版與currentVersion後補記成功;不能新建第二版。測試需逐一中斷「登記後/建身分後/建草稿後/儲存後/配置版號後/動態權限後/currentVersion 切換後/成功紀錄前」。metadata 更新只能在全部前置比較通過後,以預期值條件更新;已完成的步驟可重入,不因自己先前的寫入被當成外部漂移。

`desiredStatus: "retired"` 要保留同份完整定義。已有contentHash相符目前版時按本地映射的 expectedVersion 退役;相符版已退役且currentVersion=null才算未變,若另一新版是current則衝突。空庫為此明確仍登記的定義建立版本後退役,最終 currentVersion 為 null。不能用舊內容復活已退役版;需要重新發布時即使contentHash相同,也要新的 revision 和正式版號,此規則優先於「內容未變不增版」。移除宣告與明示退役是兩個不同操作。

## Migration 與設定的執行契約

### 唯一執行入口與歷史快照

新增 `pnpm --filter @repo/db-migrator update`,程式入口 `src/update/run.ts`,純計畫在 `plan.ts`,執行在 `runner.ts`。`buildUpdatePlan({ current, snapshots, migrations, applied }): UpdatePlan` 驗來源、依賴與歷史身分;`applyUpdatePlan(context, plan): Promise<RunReport>` 執行。既有 `migrate`、`seed` scripts 及被API測試直接呼叫的 `src/seed/run.ts` 改成同一入口的相容別名,兩者都執行完整 update,不留下可繞過依賴的半套操作;低階 `runSeeds` 留作普通 handler 與隔離測試。部署改成只呼叫一次 update。`migrate:down` 改經同一鎖和來源收集器呼叫原 migration 的 down,保留既有手動能力,不回滾 seed/定義/installation 或假稱整批還原。缺 down 實作或存在未完成 update 時拒絕,不能繞過互斥。down執行前記rollback-in-progress,成功後記rolled-back;update遇未完成rollback先拒絕,不能把先前verified誤補成功。rolled-back使該支up恢復為未執行,仍按原資料前置重新驗證。`migrate:status` 改讀所有來源與既有 changelog,維持唯讀,不能因根目錄只剩歷史檔而漏掉新 migration。

不可變快照仍是上述 `export const seed ... satisfies SeedSet`。如需普通設定作歷史前置,同樣匯出現有 documents/relations 型別,不引入另一種快照 schema。每檔可另 export `requiresSeeds: readonly string[]`,路徑相對 `seeds/`,只允許 `base/revisions/` 或 `project/revisions/` 內的 `.seed.ts`;固定 loader 使用 tsx 載入後驗證,拒絕逃逸、symlink、重複與循環。目前 registry import 當前快照,未登記的歷史檔不會在一般 seed 自動執行。已發布快照不可改寫,CI 對照基線檢查;專案回收快照先換歸屬需另作明確相容變更,不靠相同 key 靜默搶占。

新 `.js` migration 可 export `seedDependencies: readonly string[]`、`appliesTo(db): Promise<boolean>`、`assertSeedInstallable(db, inspection): Promise<void>` 及 `verify(db, context): Promise<void>`;無 seed 依賴者沿用 `up(db, client)`。有 seed 依賴者必須同時提供三個檢查函式,`up(db, client, context)` 取得已解析的 `{ definitions: [{kind,key,revision,contentHash,snapshotHash,definitionId,localVersion}], releaseCommit, runId }`,不得 import 可變的當前 registry。inspection 包含每個依賴的精確快照、既有映射/currentVersion/目前contentHash與待安裝清單。assertSeedInstallable須明示允許的來源hash或不存在條件;不能以revision字串大小推測新舊,也不能只檢查key存在。檔案本身是 migration metadata 正本,不另維護一份手寫清單。

依全域完整 filename 排序處理尚未成功的 migration:

1. 先查 `seed_update_runs` 是否有同filename尚未verified的preparing/started紀錄。有則恢復保存的精確依賴context/checkpoint,不得重新當成第一次no-op。preparing階段依各筆installation續跑;已被本次程序發布成目標的內容按checkpoint核對,不再拿舊來源hash拒絕自己的寫入。首次執行才讀 appliesTo;沒有待轉換資料時以空definitions的context執行verify,確認無需轉換才成功no-op,不發布歷史seed。不是只看整庫是否為空。
2. 有待轉換資料時,inspect seedDependencies的精確快照及遞迴前置,執行assertSeedInstallable後,在任何依賴apply前保存preparing、來源檔/快照hash及當時inspection,才逐筆安裝缺少的快照,再執行up和verify。所需module/欄位類別尚未存在時,也須有精確普通seed快照前置;不能偷用「目前最新版」代替歷史前提。
3. up前保存started、來源檔hash、已解析依賴context,verify成功後保存verified,最後才讓migrate-mongo記changelog。up部分成功或verify失敗後重跑仍須用原context完成verify;verified但changelog尚未寫時亦核對結果後補記。跨run查找同filename未完成紀錄,有矛盾context/hash即拒絕,不能因剩餘來源為零掩蓋失敗。
4. 所有 migration 完成後,套用目前普通 registry(含 root)、再依定義引用拓樸順序發布目前有效定義,最後核對目標內容與結果。普通種子保留既有初始值與認養政策。

這樣從 V1 直接升 V3 時,仍可走「前置 migration → V2 快照 → V2 資料轉換 → 下一支 migration → V3 快照及資料轉換 → 目前目標核對」。V2 不在目前 registry 仍可由不可變檔精確解析。新安裝/full reset 沒有 V1 業務資料則跳過歷史資料轉換,只建立仍在目前 registry 的目標,不重建已移除的定義。

`inspect`只驗歷史映射及凍結的版本內容,允許retired,不修改currentVersion或目前metadata;受管metadata按installation保存的該版快照核對,不能要求舊版name仍等於目前身分name。歷史版不存在才考慮apply,且須通過assertSeedInstallable和既有採納/漂移保護。若migration使用的操作要求目標必須是目前發布版,在檢查函式明確驗證並拒絕不相容路徑;不得放寬FormUpgradeService限制。現在contentHash不符合明列允許來源就拒絕安裝舊快照,不倒退發布或修改歷史。修復需同票補可重入、可驗證的明示轉換,不是重置環境。

### migrate-mongo 相容、互斥與結果

沿用 `changelog.fileName`、既有 appliedAt 與 `useFileHash: false`;九支已發布 migration 保留原 filename/內容,包括同 timestamp 不同 basename 的合法檔。所有來源的 basename 必須全域唯一,不把 base/project 前綴加入歷史 fileName。來源碰撞先拒絕;不因分資料夾而把舊 migration 重跑。

`src/update/migrate-adapter.ts` 使用目前 migrate-mongo 的 `config.set` 與 `up(db, client)`。套件只掃平面目錄且無 subset 參數,因此每次產生只含計畫中單支 migration 的暫存 wrapper,basename 保持不變;wrapper 呼叫原 `.js` 的 up 與 verify,context 是本次計畫解析出的值。成功 no-op 亦透過此 wrapper 記錄,不手造第二份 changelog。暫存目錄是自動產物且 finally 清理;套件 config 是全域狀態,不得平行執行。未在本批 wrapper 的歷史 changelog 不被刪除或重寫。新檔與快照 immutability 檢查和既有檔案歷史比較在 CI 完成,不開 `useFileHash` 使舊檔重新執行。

update、seed/migrate 別名、reset 及 API CLI 共用 `changelog_lock` 中固定 `_id` 的原子互斥,欄位包含 owner token、runId、操作、commit、開始時間。保留套件 `lockTtl: 0`,它本身不提供所需整批鎖;由共同入口負責鎖住全部步驟,每次續步核對 owner。程序正常成功或失敗後按 owner 釋放,確保 API 子程序已退出才釋放;硬中止留下鎖,不靠 TTL 自動接管仍可能在寫入的程序。`update --unlock-owner=<token>` 只在操作者已確認原程序停止後使用,檢查匹配 owner 並記結果,不提供不指定 owner 的強制解鎖。

鎖的識別常數與程序協定只在 `@repo/domain/seed` 定義。只有最外層命令取得/釋放鎖;reset呼叫內部update沿用owner,API子程序只核對不重搶鎖。不得把持鎖的reset再改成呼叫會重新搶鎖的外部update命令。

full reset 為保留這把跨階段鎖,改為逐一 drop 除 `changelog_lock` 外的全部 collection(含 changelog 與 installation),而非中途 `dropDatabase()` 丟失鎖。這仍是完整應用資料/索引重建;鎖不是業務資料,結束才釋放。部分失敗後再次明確執行 full 可從清庫步驟重入。data reset 清留計畫與刪除也在同一鎖內。

結果至少列出 release commit、每支 migration 的 skipped/applied/failed、seed 新增/更新/認養/未變、定義 revision→localVersion、資料處理/跳過/衝突數和 verify 結果。另以 `seed_update_runs` 記本次 commit、計畫 hash、狀態與階段,供 seed-only 部署辨識實際設定版本;這是執行紀錄,不是第二份設定正本。data reset保留所有run歷史(含失敗紀錄)作稽核,但不以歷史success略過當次實體檢查;新建當次reset run。full清空後立即重建當次run,後續失敗也記階段;清除過程失敗至少保留鎖的階段與外部log。未完成不能記整批成功,exit 0 不能掩蓋未解衝突。

### 資料轉換與線上行為

Migration 負責一次性資料轉換,seed 負責完整目標設定。每支轉換明訂來源條件、欄位映射/補值、歷史修訂保留、預期筆數、重跑判斷與後置條件。不要改既有已發布定義以配合舊資料,也不要無差別修改進行中流程的 workflowVersion。

現有 FormUpgradeService 只處理同租戶、無流程綁定的草稿或未走流程 completed 提交,目標必須已發布;跳過衝突/計算失敗/容量超限需要列報,不得算全成功。C 不增加全租戶自動升版或擴大這個 API 的適用範圍。個別業務 migration 若直接處理資料,須按上述完整轉換契約另驗,不可把只有 UI 支援的操作視為已存在的跨租戶工具。

發布會立即切 currentVersion,整批不是原子啟用;工具互斥也不會擋線上業務寫入。破壞性變更須在該票固定向前/向後相容窗口、必要停寫方式與恢復步驟,否則不能發布。一般錯誤以前進修復和續跑處理;單純切回舊 API image 或 migration down 不代表已回復定義/資料。

## 重置與操作者確認

刪除前先完成來源碰撞、連線目標、環境與 mode、seed root 初值、可攜性及依賴的預檢,輸出非機密的刪留計畫。未通過時不得有部分刪除。data reset 由同一 registry 推導整套依賴,不另維護一份「系統表」白名單。

| 類別                                                    | 一般部署                   | data reset                | full reset               |
| ------------------------------------------------------- | -------------------------- | ------------------------- | ------------------------ |
| 當前 registry 受管共用定義及 published/retired 歷史版本 | 保留歷史、按目標改版       | 保留;補齊當前目標         | 清除後依所選版本重建     |
| 未發布設計草稿                                          | 遇受管衝突停止,不刪        | 清除,含受管定義的現場草稿 | 清除                     |
| UI 自建、租戶客製/fork、已移除 seed 宣告的定義          | 保留                       | 清除                      | 不重建                   |
| 提交、流程實例/任務、租戶組織、人員與分派/綁定          | 保留,僅明示 migration 處理 | 依原 data reset 清除      | 清除                     |
| 根組織名稱/描述、模組初始值欄位                         | 保留現值                   | 保留現值                  | 用專案初值重建           |
| migration changelog                                     | 保留                       | 保留已成功紀錄            | 清除後重跑適用 migration |

data reset 的保留閉包還包括保留版本所需的 dynamic permissions(保留既有ID與retiredAt)與對應安裝紀錄;刪定義須同步清掉其紀錄與失效關聯。不得保留身分卻清空所有版本,也不得清除資料卻留下成功紀錄使 seed 跳過。data reset遇未完成的migration preparing/started/rollback或任何中斷發布先整次拒絕,包含publishing及已published但currentVersion尚未切換的狀態;先依同revision/hash續跑update或原UI發布,完成後再明確reset。預檢不偷偷發布或刪除半成品。full已明確清庫,可清中斷發布並重建。

Production 允許 data/full reset,由操作者確認真正目標。CLI 新增必填 `--environment=dev|staging|production`,`--confirm` 改為 `reset:<environment>:<實際DB名>:<data|full>`;缺席或任何一段不符就停止。不能再靠 DB 名尾碼推測環境;workflow 的 environment 決定專案設定與 Secret 名稱,實際 URI 解析 DB 名再比對確認。workflow 新增必填 `confirmation` input,由人輸入後經 env 原樣傳 CLI,不可從 `MONGODB_URI` 自動產生後假裝是人工確認。只顯示 DB 名稱,不輸出 URI、帳密或 Secret 值。`RESET_ALLOW_ENV` 沿用為環境允許清單,可包含 production,不再有永久拒絕 production 的判斷。mode、環境與 DB 名一併出現在執行摘要。

完整還原是依版本重建,不是備份復原。本規格授權建置能力,不代表現在要清除任何真實環境。

`WorkflowEngineService` 現有跨請求 `definitions` Map 以 workflowKey/localVersion 為鍵,重置後同key/版號可能指向不同內容。C5 移除此無失效機制的永久快取,沿用原repository讀取與definition轉換;不新增cache purge API,不要求靠重部署修正。驗收必須維持同一app/service instance,先讀舊版、重建同key/版號不同內容再讀應得新版,刪除後應回版本不存在,不得命中舊值。一般更新仍遵守已發布版本不可原地改寫。

## 實作分工與驗收

應用程式與測試由 Claude Code 負責,Codex 負責規格、獨立審查與主流程。以下 C1–C6 是同一批的工作分工,不是六個另行維護的機制。每票一位 writer,技術依賴先通過審查,再依現有疊票規則切分支;共同檔案由後續票接續,不平行覆蓋。每張票明訂 `CLAUDE.md` 不可改。具體票號、基線、分支與 PR 存 issue/PR。

| 工作                        | 依賴                | 唯一檔案範圍與責任                                                                                                                                                                  | 必驗結果                                                                                                |
| --------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C1 共用契約與來源分區       | 本規格              | `packages/domain/src/seed*` 及套件出口;db-migrator `seeds/**`、`src/seed/**` 和必要相容測試;root 專案初值搬移連動 `docs/branding.md` 的原路徑                                       | 普通 seed 行為與 id 不變;非空 project 模組/權限/關聯成功、碰撞/循環拒絕;匯出可直接型別檢查;可攜性正反例 |
| C2 API 發布適配與安裝紀錄   | C1                  | `apps/api/src/seed/**`、installation schema/repository/底座登記、既有 design services 最小接縫與 exports、`apps/api/package.json` 的 CLI;必要 mapper/測試                           | 真隔離 DB 的首次/重跑/來源採納/漂移拒絕/每個崩潰點續跑;動態權限、audit、歷史與 fork 保護                |
| C3 有序 update 與部署接線   | C1、C2              | db-migrator `src/update/**`、migration 收集/adapter/測試、package scripts、接續C1的src/seed/run.ts;deploy.yml、CI、affected/依賴建置、workflow 接線測試、API/E2E harness 子程序相容 | 舊 changelog 零重跑;V1→V3使用精確V2;空庫不重建已移除項;互斥/中斷/verify;純設定變更實際執行update        |
| C4 表單與流程 UI 匯出       | C1、C2;可與 C3 並行 | 兩個 design 的 export resolver/service/DTO/model、admin 版本面板與下載、MSW/i18n/help、GraphQL documents與唯一codegen產物、模組文件的API節                                          | 根組織與權限守門;精確版本完整欄位;無環境ID;匯出.ts經C1登記→C2發布同內容;mock畫面                        |
| C5 reset 與 production 確認 | C2、C3              | db-migrator `src/reset/**`、reset-db.yml、`scripts/project-settings/workflows.test.mjs` 接續C3、env登記中RESET_ALLOW_ENV說明                                                        | 同一保留閉包、清草稿/退出者/客製、full鎖不丟、局部失敗重跑;production模擬確認正反例零誤刪               |
| C6 共用操作與維護指引       | C1–C5               | ADR-0002、CONTEXT、README、architecture、data-model、concepts、forms/workflows模組行為、deployment/toolbox/env、module-scaffold、初始化/邊界盤點與計畫                              | 依實際產物改寫正本,移除production永拒與定義永不seed的失效說明;新clone可照文件完成驗收                   |

C1–C5 不擅改規則本文;上表的品牌/env與模組API/help是明示連動例外。C2以共用契約的隔離lock fixture驗CLI,不依賴尚未完成的C3。C4 接續 C2 修改 design module 的 providers,不能在 C2 還寫入時修改同檔。C5 接續 C3 的 workflow 測試,不平行改。C6 收斂全部規則回饋,避免每票各寫一份規格。現有測試因搬檔/import/數字等必然連動屬原 owner,與本批無關的問題另票。

### 部署與建置接線

deploy/reset 不再只安裝 db-migrator:連同 API CLI 與其 workspace runtime 依賴安裝、建置,核對 `dist/seed/run.js` 可啟動。使用同一 checkout/commit 的產物,不混用雲端 API 舊版本。api 的 `tsconfig.build.json` 只編 src,因此 CLI 放 src/seed,不把 scripts 整包加入 production build。正式 server 啟動路徑不 import/執行 CLI。API image 仍依既有 prune/install 規則,不得因 CLI 加入寄信或排程副作用。

部署仍手動且沿用 api 部署成功後做資料更新的現行時機,破壞性更新另外依該 migration 的相容窗口操作。`api || migrator` 變更必須跑 update;shared seed 契約要有真 workspace 依賴供 Turbo 追蹤。只改 project seed、migration 或快照也要跑,不能只看 API image 是否變更。`seed_update_runs.releaseCommit` 記錄實際設定版本,API image SHA 不代替它。CI 的隔離測試與子程序 harness 必須完成所需 API/domain build;不依賴本機恰好已有 dist。

### 驗收矩陣

| 案例           | 通過標準                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| 空庫/完整重建  | 只重建所選版本的當前宣告;兩環境ID不同、定義hash一致,重跑不增版                                                        |
| 既有普通種子   | root名稱/描述/null、模組初始值與帳號保留;授權仍只補不刪;非空project能力被模板正確納入                                 |
| 累積版本升級   | 隔離 V1 真資料直接升 V3,先用不可變 V2 做明示轉換;changelog appliedAt不變,歷史修訂與在途workflow原版不變               |
| 來源dev採納    | UI先發布相同內容,匯出/登記回灌保留id與版號;未登記與租戶fork不動                                                       |
| 漂移與錯誤     | 同revision異hash、未預期草稿/發布中斷、owner/module不符、遺漏依賴/循環都在可預檢範圍內零寫入;執行期失敗不宣稱整批成功 |
| 續跑與互斥     | 逐發布checkpoint中斷、migration部分寫入後失敗、最後journal失敗皆可辨識並重入;雙程序不能同時寫;硬中斷鎖不自動接管      |
| data reset     | 保留受管published/retired版本與權限ID/退役狀態/有效安裝映射;清草稿/自建/客製/退出管理/案件/租戶/分派;保留root現值     |
| full reset     | 確認後清所有應用collection/index並重建;鎖持續有效;故障後再次明確full可重入                                            |
| production確認 | 拋棄式DB模擬production,缺值/錯env/錯DB/錯mode全部零刪除,完整確認可執行;fake gcloud/pnpm驗workflow原樣傳人工input      |
| 匯出與組裝     | 真GraphQL驗權限與共用身分;MSW驗兩面板與下載;字串/表達式安全序列化,export→typecheck→registry→真發布內容一致            |
| 設定單獨變更   | affected fixture只改project來源仍排update;乾淨checkout建置CLI並驗真正子程序,設定commit與APIimage分開記                |

測試沿用現有 Jest、真 GraphQL/隔離 Mongo、MSW 與腳本測試,不另建測試框架。UI 票依 SOP 附 mock 截圖;不把執行真實 production reset、清除任何雲端資料或觸發 E2E 當作驗收必要條件。實際部署依既有 release SOP,CI 綠、dev/staging驗證、正式發布三者分開回報。
