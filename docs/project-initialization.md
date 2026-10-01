# 專案初始化索引

本索引指出新專案要設定的內容、目前正本及完成判準。它不保存第二份品牌、環境變數或資源值,也不是已可執行的初始化 skill。專案設定的抽離提案見[設定與部署識別規格草案](plans/project-settings.md),整體範圍見[底座同步計畫](plans/base-sync.md)。

狀態必須分開記錄:「已提供」表示輸入已完整;「已建立」表示檔案或外部資源已存在;「已驗證」表示該專案的實際讀取或連線檢查通過。CookHome 既有設定不代表新專案已具備資源,以下不替未建立的專案填入成功狀態。

## 品牌與公開設定

| 項目                                   | 現有正本                                                        | 初始化驗證                                          |
| -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| 名稱、色彩、HTML title、信件與瀏覽器鍵 | `docs/branding.md` 與其逐列指向的程式                           | 所有消費處讀到專案值;穩定識別不因顯示名稱修改而變動 |
| 前台 metadata 與業務文案               | `packages/i18n/messages/<locale>/front.json`                    | 支援語系完整,SEO 文字符合專案                       |
| 前台風格與 favicon                     | `apps/front/src/app/[locale]/styles.css`、各 app 的 public 目錄 | 資產可讀,前台風格由專案決定                         |
| 專案設定 package                       | 尚未實作;提案為 `packages/project-config/src/project/`          | A1 驗收後才改成本欄正本,不可先指向不存在的實作      |

A1 完成時只替換本節與品牌註冊表對應列的指路;不把完整設定值貼到本索引。

## 部署與工具識別

| 項目                                                 | 現有正本                                                                                   | 初始化驗證                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Repo 與看板識別                                      | `deploy/project/github.json`(`expectedRepository`、`projectStatus`)                        | 讀取器 github scope 以新 repo 身分解析成功;不用看板時 `projectStatus.enabled` 設為 `false`  |
| 標籤與流程                                           | `docs/agents/issue-tracker.md`、`.github/workflows/project-status.yml`                     | 新看板的狀態選項與流程對得上;`GH_PROJECT_TOKEN` 與預設分支另行設定                          |
| GCP/WIF、registry、Cloud Run、Secret 名稱、seed 帳號 | `deploy/project/cloud.json`;說明見 `docs/deployment.md`「專案部署設定」                    | 讀取器 cloud scope 三環境解析成功;目標為新專案,部署身分與執行身分的權限分別核對             |
| API 非機密執行期設定                                 | `deploy/env/*.yaml`、`docs/env-registry.md`                                                | 每環境都有適合的網域、bucket、開關及其他必要值                                              |
| Secret 值                                            | `docs/env-registry.md` 所列 Secret Manager / GitHub Secrets                                | 透過既有機制建立與驗證,值不回寫文件、repo 或公開設定                                        |
| Vercel front/Storybook                               | `docs/deployment.md`                                                                       | 專案、root directory、build 與各環境 endpoint 均已設好                                      |
| DNS、Resend、GCS、資料庫                             | `docs/deployment.md`、`docs/env-registry.md`                                               | DNS/寄件網域、bucket IAM/CORS、DB 帳號與環境隔離逐項驗證                                    |
| 設定讀取與驗證                                       | `scripts/project-settings/`(`read-config.mjs` 兩個入口、測試);CI 的 `project-settings` job | `node --test scripts/project-settings/*.test.mjs` 通過;以新專案的 repo 名稱跑兩個入口都成功 |

本節每一項要分三種狀態記錄,互不代替:

- **已提供**:兩份 JSON 填的是新專案的值(repo、GCP 專案、服務名、網址、Secret 名稱、看板 ID),讀取器解析成功。這只證明檔案內容完整、格式正確。
- **已建立**:GCP 專案、Artifact Registry、WIF pool / provider、部署用 service account 與 IAM、Cloud Run 服務與網域對應、Secret Manager 的各個 secret、GitHub 看板與 `GH_PROJECT_TOKEN`、預設分支,都由初始化工作在外部建立;設定檔不會建立任何資源。
- **已驗證**:以新專案實際跑過 Deploy(認證、build、部署、migrate → seed)與看板移卡。讀取器與離線測試通過不算這一項。

CookHome 的兩份 JSON 是從原本寫在 workflow 裡的值搬過來的,對 CookHome 而言外部資源早已存在;新專案複製 repo 後,在改掉 `expectedRepository` 之前 workflow 會在認證前失敗,不會動到 CookHome 的資源。外部資源由初始化工作建立,不得因檔案已填好就標為已建立或已驗證。

## 本機與測試環境

- 根 `package.json` 名稱、各 app `.env.example` 與未追蹤的本機 `.env` 必須按專案設定;範例不含真正憑證。
- `docker-compose.yml` 的容器、port、DB 與 volume,以及 `apps/e2e/docker-compose.yml` 的專案名要考慮多專案共存;調整不能讓既有 CookHome volume 或資料庫被換成另一個空庫。
- `apps/api/src/app.module.ts` 的本地 MongoDB fallback 與 db-migrator 範例仍含專案名稱;確切抽離由後續初始化工作處理。未知 DB 名稱仍須被 reset 安全檢查拒絕。
- 測試環境變數與命令見 `docs/agents/toolbox.md`、`apps/e2e/.env.example`、`apps/e2e/src/config.ts`;測試使用隔離資料庫,不沿用正式 URI。

本節是既有位置清單,不宣稱本機隔離已通過兩專案演練;該演練納入初始化工作,不混入 A1/A2 的完成聲明。

## 初始資料

根組織名稱/描述、ROOT_ADMIN 輸入與 seed 欄位所有權見[初始化盤點](tmp/project-bootstrap-inventory.md)及其指向的 runner/registry。新專案初始化前指定值,一般部署保留 UI 修改;只有完整還原才依專案初值重建。更換 ROOT_ADMIN_ACCOUNT 會視為建立另一帳號,不是原帳號改名。

此索引不執行 seed/reset。示範初建啟用及授權關聯只補不刪的規則照舊;使用者與業務資料不因初始化規格整理而搬移或清除。

## 設計與開發工具

- Figma 檔案、Library 及品牌映射見 `docs/branding.md` 與底座同步計畫。新專案需獨立確認引用權限、品牌補套與元件連結,正式 CookHome 設計檔不是本輪操作目標。
- agent 入口為 `CLAUDE.md`,共同接手規則見 `docs/agents/collaboration.md`;必要設定不得僅存在某工具私有記憶。
- skills、共用文件與專案文案的分離隨對應工作包維護。初始化 skill 尚未完成,不能用「檔案都改完」取代完整建立/驗證紀錄。
