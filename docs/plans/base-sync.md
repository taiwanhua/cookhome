# 底座跨專案維護與同步計畫

本文件只保留尚未完成的初始化、Figma 與跨 repo 同步工作。現有行為見下列正式文件;實作進度、驗收及部署結果以 issue/PR 為準。

## 正式文件入口

- [架構與維護歸屬](../architecture.md#底座與專案的維護歸屬):底座核心、專案內容與固定組裝。
- [前端架構](../concepts/frontend-architecture.md)、[資料層](../concepts/data-layer-and-isolation.md)、STRUCT-12:頁面、help、API 與資料登記契約。
- [設定交付](../concepts/data-layer-and-isolation.md#種子資料與遷移)、[操作](../deployment.md#設定與資料更新)、ADR-0002:seed/migration 來源、受管定義、更新與重置。
- [初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[部署](../deployment.md):專案值、設定來源與操作。
- [Figma 隔離測試](../branding.md#隔離品牌相容性測試):測試資產、可重現結果與限制。

接手先讀 `CLAUDE.md`、[協作規則](../agents/collaboration.md)、負責的 issue 全文與留言。未定介面依 [issue tracker](../agents/issue-tracker.md) 固定規格後才進 Ready;本計畫不代表外部資源已建立或工具已啟用。完成的內容依 STRUCT-11 歸入既有正本並從本計畫移除。

## D:新專案初始化與底座基線

初始化與重跑操作、雙工具 skill 及採用版本欄位見[共用初始化操作](../agents/project-bootstrap.md)。下面保留候選版與實際演練的工作,不另維護同一套初始化步驟。

以下為建立機制的已確認要求,尚需初始化工具與演練:

- 底座名稱為 `wowgo-base`,repo 為 `taiwanhua/wowgo-base`,可見性為 Public(公開)。底座與每個引用專案各有獨立 repo,CookHome 保留自己的品牌與業務;不以同一 repo 的長期分支管理各專案。
- 新專案從底座正式版本建立並保留共同 Git 歷史,固定帶完整 front、admin、api。GitHub Template 按鈕不能直接視為保留共同歷史的保證。
- 共用文件、skills、註解盡量去除專案品牌;專案值留在自己的來源,共用名詞進 `CONTEXT.md`。
- 初始化 skill 以[初始化索引](../project-initialization.md)為清單,引導全部品牌、repo/看板、開發工具、資料庫、環境變數、雲端、寄信、網域及設計資源輸入;分開記錄已提供、已建立、已驗證。
- 初始化與升級分開;重跑初始化不能破壞既有資料,新專案不能沿用 CookHome 的資源目標或密鑰。
- 不同工具的 skill 入口沿用共同文件,不以未核定本機副本作必要依賴。module-scaffold 與設計流程整合仍列於 [待辦](../tmp/dis.md),E2E 觸發依 issue tracker。

### 抽離與建立路徑

以下是待實作的建立流程。底座 repo、初始化工具及正式底座 tag 均尚未建立;本機 Git 演練的結果只能證明合併方式,不能代替應用、資料庫或 Figma 驗收。

1. 先在 CookHome 依既有分支流程交付可共用的前置修正,保持 CookHome 品牌與業務可用。以完成驗收的 `main` commit 作為抽離起點,記錄完整 SHA。
2. 在獨立 clone 建立底座候選分支,保留該起點的完整祖先,不複製未追蹤檔、個人工具設定或 `.env`。底座候選版使用自己的中性預設與空 project 登記,保留完整三 app、治理、表單、流程、申請中心及示範模組。
3. 審查抽離差異、通過完整驗證後才建立第一個正式底座版本。向新 repo 只推明確指定的分支與 tag,不用 `push --mirror` 或 `push --all` 帶入 CookHome 的工作分支。保留歷史表示抽離前的 CookHome 程式與文件仍可從祖先讀到,不是刪除歷史中的品牌。
4. 新專案從選定底座 tag 的完整歷史建立自己的分支,建立時就用 `--no-tags` 加明確 refspec,不把底座 tag 寫進專案的 `refs/tags/`。`origin` 指向新專案 repo、`upstream` 指向底座;只推指定專案分支。初始化沿用現有 TypeScript/JSON/env 來源;不以複製檔案後 `git init`、淺層 clone 或 GitHub Template 按鈕替代。初次設定提交在正式 tag 之後,原 tag 不改動。
5. CookHome 另走一次首次接軌 PR:依 deployment 的保留規則正常合併底座首版,逐項保留 CookHome 的 project 來源、前台、部署值與資料相容差異。抽離所需的共用修正已由步驟 1 交付,底座候選版額外發現的共用修正須另列差異並審查。合併結果相對 CookHome `main` 只能有明列的共用修正,中性化的專案差異須為零,即使 Git 完全沒有 conflict 也一樣。合併提交必須包含底座版本的祖先;後續升級才有清楚的比較起點。

[GitHub Template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) 會以單一新 commit 建立 repo,不能用來保留此流程需要的共同歷史。[Git clone](https://git-scm.com/docs/git-clone) 可保留歷史,從 tag 建立時須明確建立專案分支,不留在 detached HEAD。

底座 repo 為 `taiwanhua/wowgo-base`、Public;首版採不可移動的 annotated tag v0.1.0 與 GitHub Release,須完成候選版審查後才發布。新 repo 首次寫入不等於 CookHome 已發布;底座程式版本發布與引用專案的環境部署須分開驗收。外部資源未建時,不得標成「已建立」或「已驗證」。

### 合併與版本識別

首次接軌及升級的 Git 操作、專案保留與 main 前進後重建規則,見 [deployment](../deployment.md#底座首次接軌與版本升級)。Git 演練已驗機制,尚須以實際候選版與引用專案驗收,不能只靠沒有衝突判定安全。

引用專案在根 package.json 的 wowgoBase 記錄來源、tag 與完整 commit,契約見共用初始化操作;自動升級檢查仍待 F 實作。

### 已查明的抽離缺口

| 範圍與現有入口                                                                                     | 待交付結果                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/project-settings/config.mjs`、`deploy/project/cloud.json`、CI 的 `project-settings` job   | 候選版使用現有 enabled:false 格式,核對自己的 repository;CookHome 三環境維持原值                                                                             |
| `apps/api/src/app.module.ts`、`docker-compose.yml`、`apps/e2e/docker-compose.yml`、E2E config      | 以現有必填 URI 與 env 設定兩專案各自的 DB、compose 名稱、port、volume 與 bucket,完成實際隔離驗收;CookHome 現有 volume 須延續                                |
| `apps/api/src/database/database.module.ts` 與 project Recipe 登記                                  | 底座候選版移除 Recipe import 與精確相容項;CookHome 保留這個經審查的既有相容差異,不新增可任意跳過租戶隔離的 project 開關。首次接軌與後續升級逐段整合這個入口 |
| API auth/資料層測試、admin 改密碼測試與 MSW 的 Recipe 探針                                         | 以去除業務探針依賴的共用測試驗空 project 登記;候選版另核對移除 Recipe 後的精確豁免與正式產物                                                                |
| `apps/front/src/components/HomeView/`、`packages/i18n/messages/*/front.json`、project GraphQL 文件 | 底座提供中性首頁,移除食譜查詢與文案,保留 front。移除業務 API/document 後依 GQL-05 同步重產 schema/hooks;CookHome 自己保留食譜前台                           |
| project-config、project seed settings、各 app `.env.example`、根 `package.json`                    | 底座填自己的預設,沿用原契約,`legacySideNavStorageKey` 為 null;不全域取代測試夾具、migration 歷史或共用套件的 `@repo/` 名稱                                  |
| `apps/db-migrator/migrations/*.js` 與 `src/update/migration-sources.ts`                            | 根目錄九支 legacy migration 維持不可變,新內容進 `base/` 或 `project/`。在空庫驗證全部歷史 migration 與 seed 的初建/重跑,不可只因讀過其中一支便宣稱相容      |
| `CLAUDE.md`、`CONTEXT.md`、品牌/初始化索引及版控 skill 入口                                        | 共用說明使用底座與專案詞彙,專案識別集中指路;底座候選版移除 CookHome 資源指向。初始化 skill 沿用共同操作文件,不靠 `.codex/` 或未追蹤副本                     |

Recipe 的相容差異是既有業務保留的代價,不是新增模組的範本。新的資料登記繼續強制 BaseRepository、租戶隔離與組織資料檢查。歷史夾具裡的 CookHome 字串可以保留;檢查重點是實際執行與部署的目標是否仍指向 CookHome。

### 工作順序與驗收

雲端停用與本機隔離的現行契約分別見 [deployment](../deployment.md#專案部署設定deployproject) 與[初始化索引](../project-initialization.md#本機與測試環境),設定仍使用既有 JSON/env。候選版須填自己的值並驗證資源隔離。

共用授權測試使用 test-only public resolver 與底座 ModuleTree operation;Recipe 公開/CRUD/精確 ESLint 豁免驗證留在專案測試。候選版移除 Recipe 相容項時,須補專案來源零裸查豁免的斷言,不能一起刪去防止新增豁免的保護。

| 工作單元               | 依賴與交付                                                                                                                        | 寫入責任                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 底座候選版             | 共用修正及去業務探針測試先交付;獨立 clone 做中性化與空登記,這一步才移除底座候選版的 Recipe 相容 import/清單                       | Claude 為候選版程式 owner,主流程審查      |
| CookHome 首次接軌      | 底座版本可取得後,在 CookHome 獨立分支整合並驗證專案內容保留;與候選版分成兩票                                                      | 另一張票指定唯一 Claude owner,主流程審查  |
| 共用指引與專案識別分離 | 隨上述程式的實際契約收斂 CONTEXT、品牌/初始化索引、deployment 與共同操作文件;各 repo 的入口另歸該 repo 文件票,不與程式 owner 同寫 | 文件票唯一 owner;完成後移除此計畫對應內容 |
| 正式建庫與兩專案演練   | 在已定的公開 repo 目標,待首版/tag、外部資源建立方式及各項輸入固定後執行                                                           | 主流程建庫/版本發布;依個別環境授權驗資源  |

上表是拆票邊界,不是已開工或已完成的聲明。程式票只有在輸入格式、行為、檔案 owner 與前置條件固定後才進 Ready;未定項不能留給不同實作者各選一套。

整批驗收須同時包含:

- 新品牌專案保留完整三 app;空 project API/GraphQL 登記可 build,後台治理、表單、流程與示範模組可用,前台呈現自己的品牌。
- 初始化只改所列專案來源;已存在的專案重跑不靜默覆寫客製內容,不讀取來源 repo 的 `.env` 或機密。
- 兩份隔離空庫初建與重跑,受管表單/流程內容一致,組織 ID/帳號/分派各自獨立。測試腳本只操作明確建立的拋棄式資料庫。
- 兩個專案同機啟動時,DB、volume、port、儲存與 E2E compose 名稱不互踩;停止一邊不停止另一邊。E2E 是否觸發仍依既有 issue tracker。
- CookHome 首次接軌保留品牌、食譜、專案設定與資料;再升一版仍保留客製。覆蓋「上游改了專案未修改的預設值而 Git 無衝突」的案例。
- 回收一個只有共用修正的 commit,確認沒有把專案品牌/部署值帶回底座,再發布新版本向下驗證。完整 Figma 與發布自動化仍依 E、F 驗收。

尚須以正式候選版完成首次建庫審查、新品牌初始化/重跑、雙專案隔離、外部資源建立與驗證。先固定每項實際目標與輸入,不以 skill 檔案存在代替演練。

## E:Figma 品牌與版本同步

規劃底座共用 Library、每專案品牌 Library 與業務畫面檔分開。設計稿統一畫亮色;專案品牌不以占用底座 mode 表示。正式檔案拆分、Git/Library 版本對照及通用補套工具尚待實作。

同步流程須包含底座發布、專案接受更新、補套品牌、檢查元件連結與客製內容。新增實例及切換變體也要檢查;單次 Swap library 不是永久全檔主題規則。既有可行性與限制見品牌註冊表的隔離測試,不能當作所有正式元件已通過。

待固定 token/key 對照與版本識別,補驗新增 token、刪除重建圖層、所有正式元件,並在獨立測試檔證明補套可重跑、component key 不變、幾何更新及客製文字保留。此工作依品牌契約設計,可與初始化工具分開進行;操作正式 Figma 資產須另依任務授權。

## F:正式版本升級、回收與整體演練

已確認的目標:

- 向下同步以正式版本為單位,不跟每次 main commit。優先讓專案持續升級,舊版修補只作例外,不預設長期多版本支援線。
- 底座發布後,agent 為引用專案準備升級分支及 PR,分析影響、整合相容性並測試;不確定行為列待決,使用者審查合併及發布。
- 引用專案 PR 主動辨識底座改動與共用價值,提出回收建議,由使用者決定整理與納入;不自動接受回收。
- 升級保留專案品牌、設定、客製頁、帳號、組織與業務資料;資料轉換走明確 migration,不能以 reset 取代。
- 底座治理頁原版持續更新,不得整個 `system/` 排除升級;客製版須檢查 API、權限及互動相容性。依賴宣告整合後更新 lockfile,不整份選上游或本地。
- 升級報告列出新增能力及 wildcard 影響,區分種子模板、既有租戶副本與個別權限角色;Figma 接受更新及品牌補套納入同一次驗收。

正式 tag/Release、採用版本記錄與共同祖先操作見初始化及 deployment 正本。仍待設計回收分支起點、引用專案清單、觸發器、憑證權限、失敗回報與重試,並完成實際向下升級與回收工具。

前置是 D、E。整體演練需以不同品牌、新增業務模組及替換治理頁的引用專案,升級共用 UI、API、seed 與 Figma;再回收一項通用修正,發布並再次向下升級。驗收須能從 repo 與操作文件重現,不能只以計畫或 skill 檔存在判定完成。
