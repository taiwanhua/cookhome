# 專案設定與部署識別規格

本規格把[底座同步計畫](base-sync.md)的工作包 A 拆成兩張可獨立驗收的實作票:公開品牌設定與讀取接線、部署與工具識別。目標是在保留 CookHome 現有行為的前提下,讓專案值有自己的來源,底座升級可更新讀取程序而不覆寫專案值。

以下路徑、型別與拆票是本批實作契約,實際進度以對應 issue/PR 為準。檔案盤點已完成,本輪不重做盤點,也不把功能登記、seed 所有權或初始化 skill 混入這兩票。總原則與使用者已定案要求仍以底座同步計畫為準;這份技術設計不代表程式已完成或已發布。

## 接手與分工

依序讀 `CLAUDE.md`、[共同協作規則](../agents/collaboration.md)、[初始化盤點](../tmp/project-bootstrap-inventory.md)、本文件,再讀負責票的完整範圍。操作命令見 [toolbox](../agents/toolbox.md),交件流程見 [issue tracker](../agents/issue-tracker.md)。

兩票各自一位寫入 owner、一個分支與工作樹。Codex 整理規格與審查,Claude 實作和測試;只有 Claude 時可依同一份文件接手。`CLAUDE.md`、`AGENTS.md` 在兩張實作票均不可改。

## 設定來源與所有權

採「一份初始化索引,設定依用途分開」。索引指向值的正本,不複製值;有唯一來源的設定繼續沿用。機密值不進 repo,不因新增設定 package 而改放位置。

| 種類                       | 提案正本                                                       | 維護與同步                                             |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| 公開品牌與穩定識別         | 新增 `packages/project-config/src/project/public.ts`           | 專案維護值;底座維護型別、驗證及讀取接線                |
| 信件寄件識別與署名         | 新增 `packages/project-config/src/project/mail.ts`             | API 專用出口;不含 API key,品牌名引用 public 正本       |
| 品牌色盤算法與通用預設     | 既有 `packages/ui/src/theme/brand.ts`,新增 `brands/default.ts` | 底座維護;預設仍用目前橘色,專案輸入自己的名稱與 primary |
| GCP 部署目標與 Secret 名稱 | 新增 `deploy/project/cloud.json`                               | 專案維護值;僅記 Secret 名稱,不記 Secret 值             |
| Repo 與看板識別            | 新增 `deploy/project/github.json`                              | 專案維護值;workflow 維護讀取與驗證                     |
| API 非機密執行期環境變數   | 既有 `deploy/env/dev.yaml`、`staging.yaml`、`production.yaml`  | 保留此唯一來源,不再複製到 cloud.json                   |
| 真正機密                   | 現有 Secret Manager、GitHub Secrets、本機未追蹤環境檔          | 依 `docs/env-registry.md`;不匯入公開 package           |
| 前台風格與資產             | 既有 front 畫面、樣式與各 app 的 public 目錄                   | 專案維護;這兩票不重畫 UI、不搬食譜功能                 |
| 初始化索引                 | 新增 `docs/project-initialization.md`                          | 列正本路徑、輸入、驗證與後續責任,不代表 skill 已完成   |

新 package 的 `src/base/` 放底座契約與純函式,`src/project/` 放專案值,`src/public.ts`、`src/mail.ts` 為固定出口。不新增將所有值匯總的根出口;`/public` 的依賴不能到 `/mail`、環境讀取或 Node API。`@repo/ui` 與通用 i18n 組裝函式不反向讀專案 package。

## 第一票 公開品牌設定與讀取接線

### 現況與期望

現況:主色算法已有 `createBrandFromPrimary`,但品牌名稱、HTML title、前台 metadata、信件文字和瀏覽器儲存鍵仍分散。AppThemeProvider 已接受 brand,不需要另造主題引擎。

期望:專案值集中於專案來源,由既有入口讀取;CookHome 顯示、配色、儲存格式與信件輸出保持一致。以不同品牌測試輸入驗證讀取接線,不要求清除整個 repo 所有歷史或食譜文案中的 CookHome 字串。

### 公開設定契約

`@repo/project-config/public` 匯出 `projectPublic`、`ProjectPublicConfig`、`createAdminStorageKeys(slug: string)`。`projectPublic` 的實作使用 `satisfies ProjectPublicConfig`,保留實際語系鍵的型別資訊。設定是 build 輸入,不讀 `process.env`、`window` 或遠端服務。

| 欄位                                    | 型別與語意                                                                                   | CookHome 初值來源                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `slug`                                  | 非空、小寫 kebab-case;建立專案時指定的穩定識別,更名不自動變更                                | `cookhome`                                 |
| `brand.name`                            | 非空字串,目前兩語系共用品牌名稱                                                              | `common.json` 的 `brand`                   |
| `brand.primary`                         | `#` 加六位十六進位色碼                                                                       | `packages/ui/src/theme/brands/cookhome.ts` |
| `admin.documentTitle`                   | HTML title,純文字                                                                            | `apps/admin/index.html`                    |
| `front.metadata`                        | 以語系為 key,每項有 `title`、`titleTemplate`、`description`;組裝時驗證覆蓋 i18n 全部支援語系 | 兩語系 `front.json` 的 `meta`              |
| `compatibility.legacySideNavStorageKey` | `string \| null`;新專案為 null,只有既存 CookHome 指定舊鍵                                    | `cookhome.admin.sidenav`                   |

`src/base/public-config.ts` 定義公開契約與驗證;`src/base/admin-storage-keys.ts` 定義鍵生成。驗證拒絕缺少必要值、非法 slug、非法 primary;不默默補回 CookHome。前台 metadata 保留 `%s` title template 語意,不當 ICU 變數替換。

`createAdminStorageKeys` 回傳 `locale`、`colorMode`、`colorScheme`、`routeTabsPrefix`、`sessionChannel`、`sideNav` 六個字串,格式均為 `${slug}-admin-<現有用途>`。路由頁籤仍由既有 `routeTabsStorageKey(userId)` 附加 `:<userId>`;MUI 仍在 colorScheme 後附加 `-light`、`-dark`。既有 lib 常數名稱可保留,只改值來源。

這票不新增儲存資料搬移策略,也不因抽設定而改 slug。CookHome 的側欄舊鍵搬移保持現有「新鍵缺值才搬、搬後刪舊鍵」;其他專案的 null 表示完全不讀、不刪 CookHome 舊鍵。

### 信件與文案契約

`@repo/project-config/mail` 匯出 `projectMail`,含 `senderEmail`、`signature`;品牌名引用 `projectPublic.brand.name`。API 保留 `MAIL_SENDER` 等既有消費介面,從設定組出原來的寄件人,四類信件保持現有模板、HTML 跳脫及時間格式。`resend-mail.service.ts` 的實際 `from` 也要驗,不能只驗主旨。

`RESEND_API_KEY`、`MAIL_ALLOWLIST`、無 key 時改用記錄 adapter 的策略繼續由既有 MailConfig 管理。寄件地址與署名雖非機密,仍不匯入瀏覽器出口。測試使用 fake client,不寄真信。

`packages/i18n/src/project-messages.ts` 新增 `composeProjectMessages(values)`;輸入為 `{ brandName: string, frontMetadata: Record<Locale, Messages["front"]["meta"]> }`,回傳完整 `Record<Locale, Messages>`。只覆寫 `common.brand` 與 `front.meta` 三個既有鍵,不做通用 deep merge、不改 key 或 ICU 參數。基礎字典改成中性預設,原 CookHome 值由專案設定保留。

新增 `packages/i18n/src/locales.ts` 收既有 locales/Locale/defaultLocale/localeLabels/isLocale,新增 `base-messages.ts` 收唯一的基礎字典組裝與 Messages 型別。index 只作出口,project-messages 直接 import 這兩份來源,不回 import index、不複製一套組裝,避免循環依賴。

admin 的 AppProviders 與 front 的 `src/i18n/request.ts` 注入專案值。React 與前台 metadata 仍經原來的翻譯 key 取文字;前台 layout 不改接後台主題。函式不得修改基礎 messages;基礎字典與組裝結果都要有語系/鍵一致性驗證。既有直接讀 messages 的測試一併檢查,不因測試還吃基礎預設而漏驗正式接線。

### 主題與 HTML

admin、Storybook 以公開 name/primary 呼叫既有 `createBrandFromPrimary`。通用 UI 新增 `defaultBrand`,仍是橘色,不讀專案設定。遷移 repo 內所有 `cookhomeBrand` imports 後移除舊出口與檔案;範圍含既有 UI/admin 測試,不留永久品牌 alias。

新增 `apps/admin/src/lib/project-html.ts`,提供兩份 Vite 設定共用的品牌 title 處理;正式 title 讀設定,mock 加原來的 `(mock)`。純文字 title 必須 HTML escape。mock 的空 favicon 與不服務 public 目錄行為保留;既有 favicon 作為專案資產登記,本票不改圖。首幀配色腳本與 Provider 讀同一組 storage keys。

### 可改範圍與歸屬

| 範圍           | 允許修改                                                                                                                                                            | 保留邊界                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 新設定 package | `packages/project-config/` 的 base/project/出口、package/TS/lint/Jest/build 設定及測試                                                                              | 無框架、UI、i18n 或 secret 依賴                      |
| admin          | AppProviders、color-mode/init、locale、route-tabs、auth/session-channel、useSideNavStore、新 project-html、兩份 Vite 設定與 HTML,以及對應測試                       | 不改路由、頁面替換、權限、session 協定或 cookie 策略 |
| 主題展示與測試 | Storybook preview、UI brand/default/index 與使用舊品牌出口的測試                                                                                                    | 色盤算法與元件行為不改                               |
| 文案           | i18n index、新 locales/base-messages/project-messages、兩語系 common/front.meta 及相關檢查;front request 與測試                                                     | `front.home` 食譜文案、畫面與樣式不搬                |
| API            | mail-templates、resend-mail.service 與 mail 測試                                                                                                                    | 認證、RBAC、mail allowlist/adapter 策略不改          |
| 建置           | 消費端 package.json、pnpm-lock.yaml、必要 turbo/Docker 接線                                                                                                         | 不新增第三方服務;改動需逐項說明                      |
| 文件例外       | `docs/architecture.md` packages 列、`docs/branding.md` 品牌/鍵/信件列、`docs/standards/general/i18n.md` 專案品牌注入規則、`docs/project-initialization.md` 品牌部分 | 不改 Figma、部署實值、env 名稱、CLAUDE/AGENTS        |

新 package 按 STRUCT-08 建 ESM/CJS exports 與 typesVersions。API 在執行期使用的 package 必須放 `dependencies`,因 Docker 建置後會執行 `pnpm install --prod`;現有規範的 devDependency 範例不能直接套在此情境。此差異列入交件規則回饋。Vite config 載入設定前須能取得 build 產物;Turbo 依賴圖、直接啟動的前置命令與 Docker prune 均需驗證。

### 驗收條件

1. 現況:品牌散落。期望:替代品牌只改專案值,admin 登入與 fallback、Storybook、HTML title、兩語系前台 metadata、四類信件與 Resend from 均正確;CookHome 原輸出不變。
2. 現況:六種鍵與 legacy 鍵散落。期望:CookHome 全部鍵和資料格式逐一相等,已存語言、外觀、側欄及每使用者頁籤保留;替代 slug 不讀寫 CookHome 鍵。同專案跨分頁同步照常,不同 namespace 不互收。
3. 現況:首幀與 Provider 已共用色彩常數。期望:抽設定後仍同源;實際執行首幀 script 驗亮、暗、系統偏好,不只比對 script 字串。
4. 現況:共用 UI 出口帶 CookHome。期望:中性預設與專案品牌分離,UI 不依賴 project-config;重跑既有色盤與相關元件測試。
5. 現況:字典檢查主要掃 JSON。期望:仍檢查基礎字典,另驗注入後語系/鍵/參數完整且不修改基礎物件;缺語系有明確錯誤。
6. 現況:無新 package。期望:API CJS、前端 ESM、Vite config、production dependency 安裝與 Docker prune 後均能讀取;公開 import graph 與 bundle 不包含 mail 出口或 secret 讀取。
7. 依 toolbox 執行受影響 package 的 lint/types/test/build 與格式檢查,admin 交件附原品牌及替代品牌 mock 截圖。E2E 僅提供建議,不自行觸發。實際部署另循發布流程,不把單元測試通過視為已發布。

## 第二票 部署與工具識別

### 現況與期望

現況:API 明文 env 已在 `deploy/env/*.yaml`,但 deploy/reset 的雲端目標、Secret 名稱、seed 帳號與 API URL 重複寫在 workflow,看板 IDs 也寫死。改新位置的設定時,現有 affected 判斷可能不會重建 app。

期望:workflow 讀專案設定,三環境解析結果與現有值逐項相等;換 repo 時會先檢查專案身分,不沿用 CookHome 目標。這票搬設定來源與接線,不建立雲端資源、不更換機密或正式資源值。

### 設定契約

| 檔案                            | 欄位與責任                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy/project/github.json`    | `schemaVersion: 1`;`expectedRepository` 為唯一 owner/repo 正本;`projectStatus.enabled`、`projectId`、`statusFieldId`、`options` 保存看板識別。options 固定 `backlog/ready/inProgress/review/devVerify/devPassed/stagingVerify/stagingPassed/released/wontDo` 十鍵,自動化只使用其目前負責的六鍵                                      |
| `deploy/project/cloud.json`     | `schemaVersion: 1`;`gcp.projectId`、`gcp.region`、`gcp.artifactRegistry`、`gcp.workloadIdentityProvider`、`gcp.deployServiceAccount`;`environments.dev/staging/production` 各列 `apiService`、`adminService`、`apiUrl`、`rootAdmin.account/email`、`secrets.mongodbUri/fieldEncryptionKey/rootAdminPassword/jwtSecret/resendApiKey` |
| `deploy/env/<environment>.yaml` | 保留現有 API 非機密 env;不把 ADMIN_URL、cookie domain、bucket、feature flags 複製到 cloud.json                                                                                                                                                                                                                                      |
| GitHub / Secret Manager         | GitHub 的 `GH_PROJECT_TOKEN` 名稱保留;上述 secrets 欄位指向既有 Secret Manager 名稱,值仍由既有機制取得                                                                                                                                                                                                                              |

新增 `scripts/project-settings/config.mjs` 作唯一 JSON 讀取/驗證/解析模組,供 `read-config.mjs` CLI 和 workflow 使用。使用 Node 內建能力,不需先 pnpm install 或 build A1 package。三環境 key 固定,未知環境、缺必要值、repo 不符均明確失敗。輸出只含非機密設定和 Secret 名稱,禁止讀取或列印機密值。

CLI 分兩種固定入口:

- `node scripts/project-settings/read-config.mjs --scope cloud --environment <dev|staging|production> --repository <owner/repo>`:讀兩份 JSON,核對 repo,解析部署參數。
- `node scripts/project-settings/read-config.mjs --scope github --repository <owner/repo>`:只讀 github.json,不接受假部署環境,不依賴 cloud.json。看板停用時不要求看板 IDs/options/token,但仍核對 expectedRepository。

repo 輸入來自 workflow 的受信任 context,不能改用設定檔自己的 expectedRepository 充當比對值。未知 schemaVersion 拒絕讀取;無有效設定時不可回退 CookHome 常數。

CLI stdout 僅輸出單一 JSON 物件,錯誤走 stderr 與非零退出碼。cloud 輸出固定為 `gcp_project_id/region/registry/registry_host/wif_provider/deployer_sa/api_service/admin_service/api_url/mongodb_secret/enc_secret/root_secret/jwt_secret/resend_secret/root_account/root_email`;registry_host 從 registry 衍生,不另存。github 輸出固定為 `enabled/project_id/status_field_id/options`,停用時只輸出 enabled=false。SHA 仍從 git 取得,不寫入設定。

workflow 只映射上述固定 key,字串拒絕控制字元,不讓設定提供輸出鍵名或指令。shell 使用 env 與有引用的參數傳值,不把 JSON 值直接插入 run 腳本文本,不使用 eval。讀取器不取得 token;看板 token 只在啟用且必要設定驗證成功後交給原來的 API 步驟。

### Workflow 行為

- deploy/reset 在 checkout 之後讀設定與驗證,之後才做雲端認證或外部操作。reset 目前有 checkout 前的設定步驟,必須移到可讀取專案檔案之後。
- 保留分支與環境對應、只手動 Deploy、migrate 後 seed、reset 只允許 dev/staging、DB 名稱確認及 production 禁止等行為。API URL 組出 admin 的既有 VITE_GRAPHQL_ENDPOINT,不加入第二份 endpoint 值。
- deploy 的 affected 判斷納入新 cloud/github 設定和讀取腳本;這些檔案變動時保守重建 api/admin。僅更動 API URL 也必須重建 admin,並維持 Turbo 的 build env 雜湊。
- project-status 只讀受信任預設分支的設定與腳本,不 checkout 或執行 PR head 程式,不從 PR 內容載入設定。停用整合時零看板 API 寫入;啟用而必要設定或 token 不足時回報明確錯誤。
- 首次導入時,新 workflow 所需檔案尚未進 main 的窗口允許明確失敗且零 mutation,由主流程依既有 SOP 手動移卡;進 main 後驗證恢復。這是明確的過渡期,不另發 bootstrap release、不改讀 PR head、不回退寫死 IDs。fork PR 缺 token 同樣零 mutation 並清楚回報,不擴張 workflow 權限。
- expectedRepository 不符時,deploy/reset 在 auth 前失敗,project-status 在 mutation 前失敗。不能用空值、fallback 或忽略錯誤的方式繼續操作原看板或 GCP 專案。
- 設定抽出不代表外部 WIF、IAM、網域或看板已配置;初始化索引分別記錄提供、建立、驗證三種狀態。GitHub bootstrap 需要的 secret 與預設分支設定仍由新專案初始化流程完成。

### 可改範圍與歸屬

| 範圍             | 允許修改                                                                                                                                                                                     | 保留邊界                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 專案設定與讀取器 | `deploy/project/cloud.json`、`github.json`、`scripts/project-settings/` 與隔離測試                                                                                                           | 不讀真 Secret、不新增外部 API 寫入                                                                                     |
| Workflow         | `.github/workflows/deploy.yml`、`reset-db.yml`、`project-status.yml`、`ci.yml`                                                                                                               | CI 明確執行設定/schema 與讀取器測試,不依賴 workspace affected 推導;不更改觸發政策、權限範圍、分支流程或 reset 安全規則 |
| 既有 env         | `deploy/env/*.yaml` 核對後保留;這票原則上無內容修改                                                                                                                                          | 不複製、不改機密策略或功能開關                                                                                         |
| 文件例外         | `docs/deployment.md` 的設定來源、`docs/env-registry.md` 的 workflow 輸入來源、`docs/agents/issue-tracker.md` 的看板 ID 查找指路、`docs/branding.md` 的部署網域列、初始化索引的部署與工具部分 | 共用流程語意不變;CLAUDE/AGENTS 不改                                                                                    |

這票與 A1 不共改 package.json、lockfile 或新設定 package。初始化索引由規格文件票先建骨架,A1/A2 各只改自己的章節;branding 依上表分列。若實作時發現必須改同一段,先由主流程重新分配 owner,不能靠最後覆蓋。

### 驗收條件

1. 現況:deploy/reset 各寫一份目標。期望:三環境解析出的服務名、GCP/WIF、registry、API URL、Secret 名稱及 seed 帳號/信箱與原設定逐項相同;測試結果只揭露非機密資訊。
2. 現況:換 repo 仍可能指舊資源。期望:用不同 repository、缺值與非法環境夾具驗證,auth、gcloud 及看板 mutation 都不會被呼叫。
3. 現況:affected 判斷不認新設定路徑。期望:只改新設定或讀取腳本也選中 api/admin;改 API URL 後的 build 指向新 endpoint,無程式變更也不能命中舊 endpoint 產物。
4. 現況:看板 IDs 寫死。期望:假 GitHub client 驗證既有 issue/PR 事件對應不變、停用不要求 cloud/IDs/token 且零寫入、缺設定明確失敗、PR head 設定不被採用;涵蓋首次導入檔案不存在及 fork PR 缺 token,不為驗測而搬動真看板卡。
5. 現況:reset 有多重防呆。期望:純解析與命令組裝測試確認 production 仍不可選、未知 DB 命名仍拒絕、確認值不可省略;不執行真實 reset。
6. Node 讀取器測試不依賴 A1 package 或雲端登入;驗證 cloud/github 兩入口、stdout/stderr 協定、含換行與 shell 特殊字元的拒絕或安全傳遞,並檢查 workflow YAML/接線、附 dry-run 結果。真正 Deploy 驗證仍走既有 dev/staging/production 發布流程,先列環境實際版本、未部署差異與待跑 migration,不可拿本票 diff 代替完整部署範圍。

## 索引中保留而不在兩票改造的項目

`docs/project-initialization.md` 必須列出下列現有來源與後續責任,不能因沒有集中到新 package 就漏掉:

- 根 package 名稱、各 app `.env.example`、本機 `.env`、docker-compose 的 DB/port/volume、API 本地 MongoDB fallback、測試用 DB/bucket namespace。後續初始化處理實值,此輪不動本地連線或資料庫。
- 根組織 seed 名稱/描述、ROOT_ADMIN 初始化語意、資料 reset 與 full reset 差異,由 seed 所有權工作接續;一般部署保留使用者修改的既有規則不變。
- Vercel 的 front/Storybook 專案、建置與環境變數;repo/看板、WIF/IAM、DNS、Resend、GCS、資料庫與機密建立,均區分檔案設定與外部驗證。
- Figma 的 Library、品牌與畫面檔以及版本/變數對照;本輪不修改 Figma,其同步工具由後續工作包完成。
- 共用文件、skills 與專案文案分離;完整去品牌化、功能登記、初始化 skill 和建立底座 repo 依各自工作包處理。

索引只引用 `docs/branding.md`、`docs/env-registry.md`、`docs/deployment.md` 與本規格指向的正本,不再手抄一套品牌或資源清單。不得將本輪完成描述為新專案初始化或完整同步已完成。

## 交件前的規格核對

實作票引用同一個可取得的文件 commit。票面使用各節的「現況/期望」、可改/不可改與依賴,並標明文件例外。實作遇到契約缺口先回報主流程,由主流程統一更新規格,不能讓並行實作者各自決定。

首次派工只執行票面範圍;先產 PR 與驗證報告,由主流程審查與走既有發布程序。發布前檢查是所有部署的責任,另行自動化不屬本輪抽設定的完成聲明。
