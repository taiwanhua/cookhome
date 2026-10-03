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

以下為建立機制的已確認要求,尚需初始化工具與演練:

- 底座名稱與預定 repo 名稱為 `wowgo-base`。底座與每個引用專案各有獨立 repo,CookHome 保留自己的品牌與業務;不以同一 repo 的長期分支管理各專案。
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
4. 新專案從選定底座 tag 的完整歷史建立自己的分支,建立時就用 `--no-tags` 加下節的明確 refspec,不把底座 tag 寫進專案的 `refs/tags/`。`origin` 指向新專案 repo、`upstream` 指向底座;只推指定專案分支。初始化沿用現有 TypeScript/JSON/env 來源;不以複製檔案後 `git init`、淺層 clone 或 GitHub Template 按鈕替代。初次設定提交在正式 tag 之後,原 tag 不改動。
5. CookHome 另走一次首次接軌 PR:依下節差異表正常合併底座首版,逐項保留 CookHome 的 project 來源、前台、部署值與資料相容差異。抽離所需的共用修正已由步驟 1 交付,底座候選版額外發現的共用修正須另列差異並審查。合併結果相對 CookHome `main` 只能有明列的共用修正,中性化的專案差異須為零,即使 Git 完全沒有 conflict 也一樣。合併提交必須包含底座版本的祖先;後續升級才有清楚的比較起點。

[GitHub Template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) 會以單一新 commit 建立 repo,不能用來保留此流程需要的共同歷史。[Git clone](https://git-scm.com/docs/git-clone) 可保留歷史,從 tag 建立時須明確建立專案分支,不留在 detached HEAD。

底座第一個 repo 的 owner、可見性、首版號與首次建庫審查路徑仍須固定。新 repo 首次寫入不等於 CookHome 已發布;底座程式版本發布與引用專案的環境部署須分開驗收。外部資源未建時,不得標成「已建立」或「已驗證」。

### 合併時保留專案內容

升級分支從引用專案的已發布 `main` 建立,取指定 tag 並核對完整 commit,採一般三方合併與 merge commit。Git 的自動合併只比較文字變更,不了解維護歸屬:專案某檔沒有改過,上游變更它時可能完全沒有衝突。因此合併後要審查全部差異,不是只處理 conflict。

首次接軌與升級分支須另訂對齊方式:若等待期間 `main` 前進,從新 `main` 重建升級分支,重新合併同一底座版本並重做專案保留與驗證,不對含底座 merge 的分支跑一般 rebase。PR 進 `dev`、`staging`、`main` 全程保留 merge commit,每段以 `git merge-base --is-ancestor <底座 commit> <合併結果>` 驗證。實作前須在既有 deployment 操作正本明列此特例;一般功能分支維持現行 rebase 規則。

| 差異種類                                                                                        | 處理方式                                                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 底座程式與共用契約                                                                              | 接入新版本,核對權限、租戶隔離、API 與資料相容性                                                  |
| `src/project/`、project seed、專案前台/文案/資產、`deploy/project/`、`deploy/env/` 與本機專案值 | 保留專案版本;底座預設值的新增、修改、刪除也要攔下審查。契約新增必填值時明確補值,不可整檔照抄底座 |
| 固定組裝入口、workflow、共用文件中含專案識別的段落                                              | 逐段整合,共用機制要更新,專案目標要保留;不得整個檔案或 `system/` 排除升級                         |
| GraphQL schema/generated、lockfile 等衍生產物                                                   | 先整合人工來源,再依既有命令重產,不直接整份選一方                                                 |
| 已發布 migration/seed 快照                                                                      | 保留原檔與身分,不可藉抽離改寫或重編;新增依現有 base/project 契約                                 |

歸屬以[架構](../architecture.md#底座與專案的維護歸屬)與[初始化索引](../project-initialization.md)為準,不另建一份手工維護的 glob 清單。需人工補的專案值與客製相容調整寫進同一個升級 PR。不得用 `merge -s ours` 跳過整個底座版本,也不得以 squash/cherry-pick 代替向下升級的 ancestry;回收獨立共用修正才使用整理過的 commit 或 patch。

底座 tag 與引用專案自己的 tag 不共用本機標籤名稱。抓底座版本使用 `--no-tags` 加明確 refspec,例如把底座的 `refs/tags/<tag>` 抓到 `refs/remotes/upstream/releases/<tag>`;核對 tag 解析的 commit 後合併。版本來源、tag、完整 commit 必須可從版控及升級 PR 找到;長期欄位與自動檢查由 F 固定,不得只存在某台電腦的 remote 設定。

### 已查明的抽離缺口

| 範圍與現有入口                                                                                     | 待交付結果                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/project-settings/config.mjs`、`deploy/project/cloud.json`、CI 的 `project-settings` job   | 現在 cloud 三環境必填。延伸同一份 JSON 與讀取器表達「尚未啟用雲端」,離線 CI 可驗設定,Deploy/Reset 在認證前明確停止;已配置的 CookHome 三環境維持原行為       |
| `apps/api/src/app.module.ts`、`docker-compose.yml`、`apps/e2e/docker-compose.yml`、E2E config      | API 缺 URI 時不再落到 CookHome 庫;以既有 env 機制隔離 DB、compose 名稱、port、volume 與 bucket。CookHome 現有 volume 必須延續,不得換成新空庫                |
| `apps/api/src/database/database.module.ts` 與 project Recipe 登記                                  | 底座候選版移除 Recipe import 與精確相容項;CookHome 保留這個經審查的既有相容差異,不新增可任意跳過租戶隔離的 project 開關。首次接軌與後續升級逐段整合這個入口 |
| API auth/資料層測試、admin 改密碼測試與 MSW 的 Recipe 探針                                         | 共用測試改以既有底座 operation 或隔離 test fixture 驗證,使空 project 登記仍可建置。CookHome 的食譜行為另由專案測試驗證                                      |
| `apps/front/src/components/HomeView/`、`packages/i18n/messages/*/front.json`、project GraphQL 文件 | 底座提供中性首頁,移除食譜查詢與文案,保留 front。移除業務 API/document 後依 GQL-05 同步重產 schema/hooks;CookHome 自己保留食譜前台                           |
| project-config、project seed settings、各 app `.env.example`、根 `package.json`                    | 底座填自己的預設,沿用原契約,`legacySideNavStorageKey` 為 null;不全域取代測試夾具、migration 歷史或共用套件的 `@repo/` 名稱                                  |
| `apps/db-migrator/migrations/*.js` 與 `src/update/migration-sources.ts`                            | 根目錄九支 legacy migration 維持不可變,新內容進 `base/` 或 `project/`。在空庫驗證全部歷史 migration 與 seed 的初建/重跑,不可只因讀過其中一支便宣稱相容      |
| `CLAUDE.md`、`CONTEXT.md`、品牌/初始化索引及版控 skill 入口                                        | 共用說明使用底座與專案詞彙,專案識別集中指路;底座候選版移除 CookHome 資源指向。初始化 skill 沿用共同操作文件,不靠 `.codex/` 或未追蹤副本                     |

Recipe 的相容差異是既有業務保留的代價,不是新增模組的範本。新的資料登記繼續強制 BaseRepository、租戶隔離與組織資料檢查。歷史夾具裡的 CookHome 字串可以保留;檢查重點是實際執行與部署的目標是否仍指向 CookHome。

### 工作順序與驗收

| 工作單元                     | 依賴與交付                                                                                                                        | 寫入責任                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 雲端未啟用狀態               | 先固定 JSON/讀取器相容契約,補離線 CI 與 Deploy/Reset 的停用測試;CookHome 真值不變                                                 | Claude 程式/測試,文件票收正式操作規則               |
| 本機隔離與共用測試去業務依賴 | 固定 env 來源及現有 volume 延續方式,核對 schema CLI/測試入口,再實作與驗收                                                         | Claude 程式/測試;與上項的 workflow 修改須先分檔     |
| 底座候選版                   | 共用修正及去業務探針測試先交付;獨立 clone 做中性化與空登記,這一步才移除底座候選版的 Recipe 相容 import/清單                       | Claude 為候選版程式 owner,主流程審查                |
| CookHome 首次接軌            | 底座版本可取得後,在 CookHome 獨立分支整合並驗證專案內容保留;與候選版分成兩票                                                      | 另一張票指定唯一 Claude owner,主流程審查            |
| 新專案初始化 skill           | 候選版契約固定後,依現有索引逐項收集輸入、寫入原格式、列缺項及驗證;失敗與重跑保留已有 project 內容                                 | Claude 實作,共用操作文件為正本、各工具 skill 只指路 |
| 共用指引與專案識別分離       | 隨上述程式的實際契約收斂 CONTEXT、品牌/初始化索引、deployment 與共同操作文件;各 repo 的入口另歸該 repo 文件票,不與程式 owner 同寫 | 文件票唯一 owner;完成後移除此計畫對應內容           |
| 正式建庫與兩專案演練         | owner/可見性、首版/tag、外部資源建立方式及各項輸入固定後執行                                                                      | 主流程建庫/版本發布;依個別環境授權驗資源            |

上表是拆票邊界,不是已開工或已完成的聲明。程式票只有在輸入格式、行為、檔案 owner 與前置條件固定後才進 Ready;未定項不能留給不同實作者各選一套。

整批驗收須同時包含:

- 新品牌專案保留完整三 app;空 project API/GraphQL 登記可 build,後台治理、表單、流程與示範模組可用,前台呈現自己的品牌。
- 初始化只改所列專案來源;已存在的專案重跑不靜默覆寫客製內容,不讀取來源 repo 的 `.env` 或機密。
- 兩份隔離空庫初建與重跑,受管表單/流程內容一致,組織 ID/帳號/分派各自獨立。測試腳本只操作明確建立的拋棄式資料庫。
- 兩個專案同機啟動時,DB、volume、port、儲存與 E2E compose 名稱不互踩;停止一邊不停止另一邊。E2E 是否觸發仍依既有 issue tracker。
- CookHome 首次接軌保留品牌、食譜、專案設定與資料;再升一版仍保留客製。覆蓋「上游改了專案未修改的預設值而 Git 無衝突」的案例。
- 回收一個只有共用修正的 commit,確認沒有把專案品牌/部署值帶回底座,再發布新版本向下驗證。完整 Figma 與發布自動化仍依 E、F 驗收。

尚須固定的介面:雲端停用設定的精確相容形狀、本機 env 輸入及 port 分配、初始化命令與重跑策略、底座版本欄位、建庫目標與首次審查流程、外部資源建立/驗證。這些定案後才開相應程式票;不為尚未確定的介面新增另一份暫存規格。

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

待定的具體方案包括 annotated tag/Release、tag 不移動、版本/commit 記錄、回收分支起點、升級的共同祖先、引用專案清單、觸發器、憑證權限、失敗回報與重試。正式版本與保留共同歷史是已確認原則,這些操作細節仍須設計。

前置是 D、E。整體演練需以不同品牌、新增業務模組及替換治理頁的引用專案,升級共用 UI、API、seed 與 Figma;再回收一項通用修正,發布並再次向下升級。驗收須能從 repo 與操作文件重現,不能只以計畫或 skill 檔存在判定完成。
