# 新專案初始化與 seed 欄位盤點

本文件把已確認的維護邊界轉成檔案與資料檢查清單,供後續抽離及初始化 skill 實作。目標是已確認要求或明確標示的建議。根組織初始值保護及 API 改值/清空後重跑 seed 的驗收與發布證據由 [根組織修正票](https://github.com/taiwanhua/cookhome/issues/597)追蹤。其餘初始化工具尚未實作;盤點不執行真實環境 seed/reset、檢查雲端實際設定或改動 Figma。

範圍為目前 repo 的主要初始化入口與 seed registry 全部登記種類。品牌搜尋只是輔助,另外核對不含品牌字串的固定 ID、啟動入口及外部資源。尚未執行新 repo 建立或升級演練,不能將本清單當成已驗證的 bootstrap 工具。

上層決策、本批交付及後續工作包見 [底座同步計畫](../plans/base-sync.md),組裝入口證據見 [底座維護邊界盤點](base-boundary-inventory.md);環境變數名稱與存放規則以 `docs/env-registry.md` 為準。

## 先區分四種執行方式

| 情境                  | 初始值欄位                                    | 系統定義                                      | 使用者與業務資料                                     |
| --------------------- | --------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| 新專案空庫初始化      | 寫入該專案指定的 seed 值                      | 建立底座及專案宣告                            | 只建立必要初始帳號與選定示範資料                     |
| 一般部署或底座升級    | 已存在的值保留,欄位不存在時補初值             | 僅同步宣告擁有的欄位;必要結構調整走 migration | 不清庫,不覆蓋非 seed 管理的資料                      |
| 清業務資料 data reset | 依現行 reset 規則保留 seed 記錄,再跑一般 seed | 遷移紀錄保留;依 registry 保留設定記錄         | 清除人建資料,保留指定 root 帳號;示範業務表清空後重種 |
| 完整還原 full reset   | 丟棄舊修改,重新寫入該專案 seed 值             | 清庫後重新 migrate/seed                       | 舊資料清除,重建初始帳號與示範資料;不是備份復原       |

現有 `apps/db-migrator/src/reset/run.ts` 已區分 full/data;`reset-plan.ts`、`reset-runner.ts` 定義 data 清理範圍。完整還原不同於只清業務資料。既有 production reset 禁止規則不因本次討論而改變。

## Seed runner 的實際規則

正本為 `apps/db-migrator/src/seed/seed-declaration.ts` 與 `seed-runner.ts`。

- documents 預設以 `key` 查找;可用 `keyField` 指定其他識別欄位。未指定初始值保護清單時,只有 `enabled` 受保護。
- `initialSeedValueFields` 是完整替換清單,不是追加到預設。值已存在時保留,包括 `null`、`false`、空字串;欄位不存在才補值。
- 其餘宣告欄位以 `$set` 同步;宣告外欄位不刪,未宣告的文件不自動刪。刪除宣告不等於刪除舊資料或停用舊功能。
- 同識別鍵的非系統文件可能被認養;`adoptBy` 可找額外候選。現有保護不區分底座與專案擁有者,新組裝必須先檢查撞 key,不能只依 `isSystem` 判定來源。
- relations 只補缺少的關聯,不刪多出的關聯,已定案保留此行為。刪除 seed 授權宣告只會停止補建,資料庫既有授權仍保留;實際撤銷由人員管理操作或另行明確授權的 migration 處理,不新增自動清理。
- `seedRef` 以 collection/key 解析環境內 ID;不能把某環境的實際 ID 複製到另一環境。

## Registry 逐項欄位盤點

以下路徑除另註外,相對 `apps/db-migrator/seeds/`。runner 共通寫入識別鍵、`isSystem`、時間戳;本表聚焦宣告的業務欄位。完整還原皆重新套用專案當時的宣告,不保留原 ID。

| 登記種類與來源                            | 現行一般 seed 同步欄位                                                                             | 現行保留欄位或限制                                                                   | 目標與待處理差異                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `orgs`, `orgs.ts`                         | `parentId`、`ancestors`                                                                            | 根組織修正保護 `name`、`description`、`enabled`、`settings`;未宣告的 logo 等欄位不碰 | API 明確清空根描述存 null,缺席不動;根階層屬系統不變條件,初始化與升級須沿用                                            |
| `roles`, `roles.ts`                       | 兩個種子角色的 `name`、`description`、`settings`                                                   | `enabled`;不是所有租戶角色都由此同步                                                 | 系統角色定義與租戶副本分開;不要因根名稱要保護而把所有種子欄位一律改成只初始化                                         |
| `roleOwners`, `roles.ts`                  | 補齊根組織與兩個種子角色的擁有關聯                                                                 | 已有關聯保留,其他關聯不刪                                                            | 底座不變條件;移除或轉移須明確 migration                                                                               |
| `rootAdmin`, `root-admin.ts`              | 僅在指定 account 不存在時建立使用者與所屬/授權關聯                                                 | 帳號存在即完全不動,不重設 email/密碼/角色                                            | 新專案先指定 ROOT_ADMIN 三個輸入。修改 account 會視為另一帳號,不是改名;初始化工具須明確區分                           |
| `fieldCategories`, `field-categories.ts`  | 系統類別 `name`、`description`                                                                     | `enabled`;未宣告的類別不碰                                                           | 底座與專案類別分開登記;新增同 key 會認養,升級預覽需揭露                                                               |
| `fields`, `fields.ts`                     | 全域選項的 `categoryId`、`orgId`、`value`、`label`、`order`                                        | `enabled`;租戶自訂選項不在認養條件                                                   | 認養可將 root 建的同類別/value 選項轉全域種子;這會改擁有範圍,不能視為普通補資料                                       |
| `modules`, `modules.ts`                   | `name`、`parentId`、`ancestors`、`route`、`sidebarType`、`order`、`engine`、有宣告的 `description` | `enabled`、`icon`、`settings`                                                        | 已定案保留新建 enabled=true,包含示範模組;開關與租戶分配由人員維護,一般 seed 保留 UI 停用、圖示與列表設定              |
| `permissions`, `modules.ts`               | `moduleId`、`name`、有宣告的 `description`、`settings`、`source`                                   | `enabled`;match 排除 dynamic 權限                                                    | 同層 wildcard 新動作政策已定案。permissions.settings 目前會被同步,不能誤稱所有 settings 都受保護                      |
| `dataScopeTargets`, `modules.ts`          | `collection`、`name`、有宣告的 `description`、`fields`;識別用 `moduleKey`                          | 沒有宣告 enabled;資料範圍規則本身不是這份 seed                                       | 目標欄位定義可更新,既有規則若引用被移除欄位需做相容性處理                                                             |
| `tenantAdminBindings`, `role-bindings.ts` | 所有非根專屬模組及同層 wildcard 補進租戶管理員種子模板                                             | 已有租戶副本不自動更新;舊模板關聯不刪                                                | 保留現行模板與只補不刪的機制,示範開關與租戶分配由人員維護;升級報告區分模板與既有租戶副本,不默認新增自動排除示範的策略 |
| `demoItemsOne/Two`, `demo-items.ts`       | 示範名稱、備註、分類、狀態、org/module/tenant 等宣告欄位;每表 5 筆                                 | `enabled`;`deletedAt`、附件路徑等未宣告欄位不碰                                      | 現有政策刻意讓示範內容隨 seed 復原,與真實業務資料分開。正式環境可有假資料;模組啟用與租戶分配由人員維護                |

執行期的租戶/帳號、租戶角色副本、自訂欄位、表單/流程版本、提交、審核實例、資料範圍規則與稽核紀錄不在此 registry 中。一般 seed 不會全面重建這些資料;升級 migration 若碰到它們,必須列出影響及保留要求。

## 初始化檔案清單

「抽離時處理」指把散落值變成可注入設定或獨立專案內容;目標是之後建立新專案只填設定,不再逐檔搜尋取代。本輪未新增以下設定介面。

| 現有檔案                                                                                                                                 | 新專案需要指定或抽離的內容                                                       | 升級時如何處理                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `package.json`                                                                                                                           | 根專案名稱;保留 `@repo/` workspace 套件命名                                      | 底座工具依賴與專案依賴整合,名稱保留                            |
| `packages/ui/src/theme/brands/cookhome.ts`、`theme/index.ts`                                                                             | 專案品牌色盤與匯出;底座保留目前橘色作中性預設                                    | 品牌值歸專案,色盤算法與元件由底座更新                          |
| `apps/admin/src/app/providers/AppProviders.tsx`、`apps/storybook/.storybook/preview.tsx`                                                 | 改成注入專案品牌,不直接引用 CookHome                                             | 保留品牌輸入,接受 provider 與展示工具更新                      |
| `packages/i18n/messages/zh-TW/common.json`、`messages/en/common.json`                                                                    | 品牌文字                                                                         | 專案品牌覆寫與共用訊息合成                                     |
| `packages/i18n/messages/zh-TW/front.json`、`messages/en/front.json`                                                                      | 前台標題、描述與食譜文案                                                         | 食譜與 SEO 內容留 CookHome,底座提供中性文案                    |
| `packages/i18n/src/index.ts`                                                                                                             | 共用、專案文案合成入口與覆寫規則                                                 | 驗缺 key、參數與兩語系一致性                                   |
| `apps/admin/index.html`、`mock.html`、`public/favicon.ico`                                                                               | 頁面標題與 favicon;mock 標題也需一致                                             | 專案資產不被替換回預設                                         |
| `apps/front/public/favicon.ico`、`src/app/[locale]/layout.tsx`                                                                           | 前台 favicon、metadata 的專案文案來源                                            | 保留專案 SEO,升級框架接線                                      |
| `apps/front/src/components/AppProviders.tsx`、`src/app/[locale]/styles.css`                                                              | 前台畫面與風格為專案客製,目前未接 AppThemeProvider 不列為底座缺陷;依專案需要設計 | 保留專案風格;不要求接共用主題或跟隨 admin 主色                 |
| `apps/front/src/components/HomeView/HomeView.tsx`、`RecipeList.tsx`、`src/app/[locale]/page.tsx`                                         | 食譜首頁移為 CookHome 業務組裝,底座仍保留完整 front                              | 專案首頁不被底座預設首頁覆寫                                   |
| `apps/admin/src/lib/color-mode.ts`、`color-mode-init.ts`                                                                                 | 儲存鍵從專案 slug 產生;首幀與 provider 同源                                      | CookHome 抽離沿用舊鍵;新專案用新 namespace                     |
| `apps/admin/src/lib/locale.ts`、`route-tabs.ts`、`auth/session-channel.ts`、`src/stores/useSideNavStore.ts`                              | 語系、頁籤、跨分頁 session、側欄儲存鍵及 legacy 鍵遷移                           | 升級保留值;避免登入 session 跨專案混用                         |
| `apps/admin/vite.config.ts`、`vite.mock.config.ts`                                                                                       | plugin 名稱含品牌,抽離時一次改成通用名稱                                         | 後續新專案不用再改這些名稱                                     |
| `apps/api/src/mail/mail-templates.ts`                                                                                                    | 寄件人、品牌名、署名,由專案 mail 設定提供                                        | 通用模板更新保留專案值                                         |
| `apps/api/src/app.module.ts`、`apps/admin/src/app/module-pages.tsx`、`app/routes.tsx`                                                    | 核心與專案模組分開組裝;API 食譜 import、專案頁面/替換登記                        | 固定合成入口接受底座更新;同 key 需明確替換                     |
| `apps/db-migrator/seeds/orgs.ts`、`registry.ts`、`modules.ts`、`role-bindings.ts`                                                        | 專案初始值與宣告歸屬;示範模組初建啟用照舊,開關及分配由人員維護                   | 依上方欄位表,不得直接覆蓋專案宣告                              |
| `apps/api/.env.example`、`apps/admin/.env.example`、`apps/front/.env.example`                                                            | 專案本地 DB 與 endpoint 範例;真實值放不入版控的環境檔                            | 範例可新增 key,不取代使用者本機實值                            |
| `apps/api/src/app.module.ts`、`apps/db-migrator/src/cli.ts`、`migrate-mongo-config.js`、`src/reset/reset-safety.ts`                      | API 的本地 DB fallback 含品牌;其餘有品牌範例文字。reset 的環境辨識依 DB 名後綴   | fallback 與範例中性化;驗未知命名仍拒絕 reset,不弱化限制        |
| `docker-compose.yml`                                                                                                                     | 容器名稱、本地 DB、port/volume 隔離策略                                          | 新專案可同機運作,升級不得誤接其他專案資料                      |
| `deploy/env/dev.yaml`、`staging.yaml`、`production.yaml`                                                                                 | 後台 URL、cookie domain、私有/公開 bucket、環境功能開關                          | 保留專案值,只提示新增或移除設定                                |
| `.github/workflows/deploy.yml`、`reset-db.yml`                                                                                           | GCP registry/WIF/service account/服務名/secret 名稱/URL/root 帳號與信箱          | 共用程序與專案參數分開;升級不得指回 CookHome                   |
| `.github/workflows/project-status.yml`                                                                                                   | Project ID、欄位 ID、狀態 option IDs 與 GH_PROJECT_TOKEN                         | 這些 ID 不含品牌字串也須重設;選擇不用看板時不可誤操作舊看板    |
| `.github/workflows/ci.yml`、`e2e.yml`、`apps/e2e/.env.example`、`src/config.ts`、`docker-compose.yml`                                    | 測試 DB/port/bucket namespace、root 測試輸入                                     | 保留核心劇本,補專案測試;不可將測試假憑證當正式設定             |
| `apps/api/Dockerfile`、`apps/admin/Dockerfile`、`apps/admin/src/mock/`、`src/test/msw/`、`apps/e2e/src/fixtures/`                        | 品牌命中含註解、示例與測試資料,抽離時分類中性化                                  | 不把每個字串命中都當成正式品牌設定;測試跟對應行為一起更新      |
| `CLAUDE.md`、`AGENTS.md`、`CONTEXT.md`、`docs/agents/issue-tracker.md`、`docs/branding.md`、`docs/env-registry.md`、`docs/deployment.md` | 共用規則、術語與專案 repo/品牌/環境實值分開;同步維護文件入口                     | 正式規則不可因專案檔整份覆蓋而漏更新                           |
| `.claude/skills/module-scaffold/`、`.agents/skills/module-scaffold/`、`docs/agents/module-scaffold.md`                                   | 正本位置、引用鏈及新組裝路徑;`.agents` 本地副本尚未追蹤                          | 未釐清前不批次加入本地設定;第三方 skills 依版本來源管理        |
| `docs/standards/general/figma.md`、`docs/branding.md`                                                                                    | 共用 Library 與專案檔/節點對照分開,專案品牌 variable key 對照                    | 接受更新後補套品牌與驗收;Git 版本/Library 更新的對照格式待設計 |

## 不在 repo 裡的初始化項目

所有新專案需要分別設定的項目都要納入初始化,由 skill 引導使用者提供,不能只列出含品牌名稱的檔案。以下依 `docs/deployment.md` 與 `docs/env-registry.md` 列出待建立/核對項目,未登入外部服務查驗:

- Git repo 與 main/dev/staging 流程、Actions 設定、GitHub Project/labels、GH_PROJECT_TOKEN;建立 repo 必須保留底座共同歷史。
- GCP project、啟用服務、WIF 對新 repo 的限制、部署及執行身分 IAM、Artifact Registry、Cloud Run 服務、domain mapping。
- Secret Manager 的 MONGODB_URI、FIELD_ENCRYPTION_KEY、JWT_SECRET、RESEND_API_KEY、ROOT_ADMIN_PASSWORD 及環境對應;新專案不得沿用 CookHome 的密鑰值。
- MongoDB 資料庫、帳號與環境隔離;GCS 公私 bucket、IAM、CORS、簽名權限。
- DNS、cookie domain、Resend 寄件網域驗證;Vercel 的 front/Storybook 專案、root directory、建置設定、各環境 endpoint 與部署入口。
- Figma 底座 Library、專案品牌 Library 與畫面檔引用、發布與接受更新權限。
- 開發工具與外部整合的專案設定:agent/skill 的專案引用、issue tracker、看板、CI 與所需帳號/權限。選擇不使用的整合也須明確停用或移除專案引用,避免照搬既有專案目標。

初始化 skill 必須引導使用者提供品牌、雲端、開發工具、資料庫及其他專案獨有輸入,將「已提供設定」「外部資源已建立」「驗證通過」分開記錄;機密值依環境註冊表指定位置提供,不寫入版控。只改完檔案不算專案已可部署。

## 驗收案例與實作順序

根組織修正票驗證真 GraphQL 改值/清空後的一般 seed 保留、缺欄位明確清空存 null、重複清空不新增稽核,以及 data reset 保留、full reset 回 seed。測試與部署結果以該票/PR 為準。專案設定、三個登記入口與初始化工具另行抽離,以下跨專案整合案例仍待演練:

1. 空庫用新專案 seed 建立名稱與描述 A,UI 改 B;一般 seed 及底座升級後仍為 B;full reset 回 A。
2. 初始值欄位設為 null/false/空值仍保留;欄位不存在時補值;更新系統定義仍可落地。
3. 示範模組初建維持啟用,人員手動停用後重跑 seed 不重啟;租戶分配由人員維護,驗收不自動新增停用或排除模板的策略。
4. 新動作被同層 wildcard 涵蓋,個別權限角色不擴權;全新模組的分配由明確授權決定。升級報告區分超級管理員、模板與租戶副本。
5. root 帳號存在時一般 seed 不改密碼/信箱;更換初始化 account 必須預覽新增帳號影響。
6. 同 key 衝突與認養在寫入前揭露;移除授權宣告後既有綁定照舊保留,不自動撤銷。需要撤銷時另由人員操作或明確遷移處理。
7. 新專案品牌套入 admin、Storybook、信件與 Figma;前台依專案獨立設計,檢查自己的品牌、metadata 與風格。底座升級後兩者的品牌、客製頁及新增業務模組都保留。

根組織 name 與 description 的目標已定案,修正票須包含 API 清空路徑才算完整驗收。其餘尚未核定的欄位維持現有規則,不把本次決策擴大成「所有 UI 能改的種子都不更新」。示範初建啟用與刪除授權宣告不自動撤銷均維持現行行為。
