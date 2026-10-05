# 底座跨專案維護與同步計畫

本文件只保留尚未完成的跨 repo 版本升級、回收與整體演練。現有行為見下列正式文件;實作進度、驗收及部署結果以 issue/PR 為準。

## 正式文件入口

- [架構與維護歸屬](../architecture.md#底座與專案的維護歸屬):底座核心、專案內容與固定組裝。
- [前端架構](../concepts/frontend-architecture.md)、[資料層](../concepts/data-layer-and-isolation.md)、STRUCT-12:頁面、help、API 與資料登記契約。
- [設定交付](../concepts/data-layer-and-isolation.md#種子資料與遷移)、[操作](../deployment.md#設定與資料更新)、ADR-0002:seed/migration 來源、受管定義、更新與重置。
- [初始化操作](../agents/project-bootstrap.md)、[初始化索引](../project-initialization.md)、[品牌註冊表](../branding.md)、[部署](../deployment.md):專案值、設定來源與操作。
- [Figma 資源](../branding.md#設計資源登記)、[品牌同步操作](../agents/toolbox.md#figma-品牌同步):Library、專案品牌補套與驗證紀錄。

接手先讀 `CLAUDE.md`、[協作規則](../agents/collaboration.md)、負責的 issue 全文與留言。未定介面依 [issue tracker](../agents/issue-tracker.md) 固定規格後才進 Ready;未完成範圍以本計畫為準,現有工具與設計資源以正式文件及驗證產物為準。完成的內容依 STRUCT-11 歸入既有正本並從本計畫移除。

## F:正式版本升級、回收與整體演練

已確認的目標:

- 向下同步以正式版本為單位,不跟每次 main commit。優先讓專案持續升級,舊版修補只作例外,不預設長期多版本支援線。
- 底座發布後,agent 為引用專案準備升級分支及 PR,分析影響、整合相容性並測試;不確定行為列待決,使用者審查合併及發布。
- 引用專案 PR 主動辨識底座改動與共用價值,提出回收建議,由使用者決定整理與納入;不自動接受回收。
- 升級保留專案品牌、設定、客製頁、帳號、組織與業務資料;資料轉換走明確 migration,不能以 reset 取代。
- 底座治理頁原版持續更新,不得整個 `system/` 排除升級;客製版須檢查 API、權限及互動相容性。依賴宣告整合後更新 lockfile,不整份選上游或本地。
- 升級報告列出新增能力及 wildcard 影響,區分種子模板、既有租戶副本與個別權限角色;Figma 接受更新及品牌補套納入同一次驗收。
- 發布前比對目標環境實際版本、main 累積未部署差異與待執行 migration,列出資料修改、刪除範圍及恢復限制;不能只檢查本批 PR。

正式 tag/Release、採用版本記錄與共同祖先操作見初始化及 deployment 正本。以下是本批工具的實作契約,尚未代表功能已交付。

### 共用入口與來源

第一版由人員、Claude 或 Codex 呼叫 Node CLI,明示本次要處理的本機 repo 清單。需要 clone 時使用既有 `gh repo clone`;不新增排程、bot token、中央名冊或自動合併。後續 GitHub Actions 可呼叫同一入口,不影響核心工具契約。

- 引用版本沿用根 `package.json.wowgoBase` 的 repository、tag、完整 commit;專案身分沿用 `deploy/project/github.json.expectedRepository`。部署設定沿用 `scripts/project-settings/config.mjs`,不得改成另一份格式。
- 核對正規化後的 origin 與 expectedRepository;底座來源核對 wowgoBase.repository。只接受 GitHub HTTPS/SSH 身分,拒絕不明 host 或含認證資訊的 URL,輸出不得帶 credential。Git remotes 只是本機快取;topics 最多是發現候選,不是完整名單或版本正本。
- 所有 `gh` 呼叫明示 `--repo owner/repo`,不得讓 origin/upstream 選擇改變操作對象。沿用現有 git/gh 登入;Cloud Run 與 DB 授權另行核對。
- CLI 使用固定執行檔及參數陣列,不拼接 shell。JSON 輸出到 stdout,錯誤摘要到 stderr;查詢或操作失敗用非零 exit。報告是生成產物,不是另一份人工帳本。
- 工具不 push、不開 PR、不 merge 到環境分支、不部署、不 reset DB、不 stash 或清除使用者工作樹。agent 完成整合與驗證後,依既有 gh/SOP 提交與開 draft PR;同 head 已有 PR 就沿用。

### F1:跨 repo 升級與回收

入口為 `node scripts/base-sync/run.mjs`:

| 命令         | 介面與結果                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inspect`    | `--project <repo-root> --from <commit> --to <commit>`。唯讀核對身分、採用版本與完整差異;逐檔列底座共用候選、專案保護範圍、固定組裝/混合檔、已發布資料來源與未知範圍。包含自動套入且沒有 Git conflict 的差異。                    |
| `upgrade`    | `--project <repo-root> [--project <另一 repo-root> ...] --tag <version> --worktree-root <directory>`。逐案核對正式來源,從 origin/main 建隔離工作樹與 feature 分支,正常三方 merge 並保留未提交結果供 agent 整合。                 |
| `contribute` | `--project <source-root> --commit <full-sha> --base <base-root> --worktree-root <directory>`。只接受已明選、只有一個 parent 的來源 commit;精確差異以該 parent 為基準,從底座最新 origin/main 準備 common-only contribution 分支。 |

升級驗證 annotated tag、正式 GitHub Release(非 draft/prerelease)、tag object/full commit、已採用版本與 ancestry。以獨立底座 ref 保存 tag,不覆蓋專案自己的同名 tag。既有同名版本改指不同內容須拒絕。升級必須產生正常 merge ancestry,不使用 ours strategy、squash、cherry-pick 或 rebase。

重跑依 repo、origin/main 基線、tag object/commit、branch/worktree 及實際 Git merge 狀態核對,不能只靠名稱猜測。符合者回報現有分支、PR 與衝突/待審狀態,不重做 merge、不覆蓋手動整合;不符即停止。main 前進須回報依 deployment 重建,不自動 reset/rebase/強推。必要的可重建執行資訊可保存在 Git 本機 metadata,不是新的人工版本來源。

回收以精確來源 commit 與 parent 記錄 provenance,不把整個專案分支 merge 回底座。含專案、混合或未知路徑先拒絕,由 agent 拆成 common-only commit;不自動選 hunk。路徑共用不代表語意通用,仍須讀 exact delta 排除品牌或業務耦合,由使用者決定納入。已發布 migration/seed 快照不得改寫。

agent 逐項整合全部差異,保留品牌/front/專案值/業務來源/cloud/env/receipt,固定組裝與治理原版仍更新。依賴宣告整合後重產 lock,不整份選 ours/theirs。升級 PR 記錄新增能力、API/權限/客製頁相容性、wildcard 對模板/既有租戶副本/個別角色的影響、資料變更與 Figma 接受/補套狀態;未知不得寫通過。publish 前核對 Base ancestry 與採用記錄。

### F2:既有資料狀態的唯讀 JSON

擴充現有 `migrate:status` / `update --status` 的 `--json`,文字 status 保持相容。`--json` 僅適用 status,與 update/down/reset/unlock 等寫入命令混用必須在連線前拒絕。查詢沿現有 `planUpdate`、changelog、journal 與鎖,不取得鎖、不建立 collection、不寫 journal 或業務資料。

輸出是一個 JSON object,不混文字 log、raw error、URI/密碼或業務文件:

| 欄位                   | 固定形狀與意義                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`        | `1`                                                                                                                                                                   |
| `generatedAt`          | ISO string                                                                                                                                                            |
| `sourceCommit`         | 執行來源 checkout 的 full SHA;外部/未追蹤/有相關未提交改動的 source-root 或 registry 無法證明來源時為 `null`,不採用 GITHUB_SHA 猜測                                   |
| `lastAttempt`          | `RunSummary` 或 `null`,最近開始的一次執行                                                                                                                             |
| `lastSuccessfulUpdate` | `RunSummary` 或 `null`,成功且已完成的 update/reset-data/reset-full,依完成時間取最後一筆,排除 migrate-down                                                             |
| `subsequentRuns`       | 除基準自身外,startedAt 或 finishedAt 大於等於基準 startedAt 的 runs,按 startedAt/runId 穩定排序;同毫秒與重疊均保留供審查。沒有成功基準為 `null`,有基準但無後續為 `[]` |
| `migrations.applied`   | `[{fileName,origin,appliedAt}]`                                                                                                                                       |
| `migrations.pending`   | `[{fileName,origin}]`                                                                                                                                                 |
| `migrations.orphaned`  | `[{fileName,appliedAt}]`,依 fileName 排序                                                                                                                             |
| `migrations.open`      | `[{fileName,status,runId,releaseCommit}]`                                                                                                                             |
| `definitions.open`     | `[{kind,key,revision,runId}]`,沿既有 findUnfinishedUpdate 的未完成安裝查詢,按 kind/key/revision 排序                                                                  |
| `lock`                 | `null` 或 `{owner,runId,operation,releaseCommit,startedAt}`                                                                                                           |

`RunSummary` 固定為 `{runId,operation,status,stage,releaseCommit,startedAt,finishedAt}`;日期為 ISO 或依原始 nullable 欄位為 null,releaseCommit 只有合法 full SHA 才輸出,否則 null。migration 來源排序沿現有 plan。歷史成功不等於目前資料版本;其後失敗、rollback 或 reset 可能已改部分資料,不能忽略 subsequentRuns/open/lock/changelog。

來源漂移或查詢失敗必須非零 exit,不造空成功陣列。exit 0 只代表讀取完成,不代表可安全部署;不提供自動 `safetyPassed`。

### F1:發布前環境與累積資料差異

入口放在既有 `scripts/project-settings/preflight.mjs`,參數為 `--environment <dev|staging|production> --target <full-sha>`。目標 SHA 必須等於執行 checkout;未提交來源改動須拒絕,不能以某 commit 名義執行其他來源。沿用既有 config 讀取器,不新增部署設定。

逐一讀 API/admin **正在承接流量**的 revision 及其 image 版本,混合流量保留全部 revision,不以最新建立的 revision 代替。Cloud Run 常回 digest,須經 Artifact Registry 的 docker tags list 核對相同 image 與 exact digest,再解析現有部署 tag(SHA 或 admin 的 SHA 加環境尾碼)。短 SHA 必須由本 repo Git 唯一解析為完整 commit;多個相異 commit、無法取得或無法對應的 digest 明列 unknown,不猜測。由每個已知基準比較到 target 的全部累積差異,不限當次 PR。

DB 使用同 checkout 的既有 migrator status JSON,經受控子行程讀取現有 MONGODB_URI 或設定指定的 Secret。不能將 API image SHA 當作 DB 設定版本。gcloud/DB 存取不足、來源不符、未完成執行、無成功基準等列為未核對或問題,不能報成沒有待部署差異。Secret 值只在記憶體/子行程環境傳遞,不輸出、不存產物。

輸出至少含 schemaVersion、generatedAt、targetCommit、environment、各應用 revision/traffic/commit/baseline diff、DB status、資料來源變更及 `issues`。issues 使用固定 code、scope、相關 files/revisions,不輸出敏感原始錯誤。exit 0 只代表報告生成;未核對事項仍留在 issues,不可直接接成自動部署核准。agent 須閱讀 migration/seed/definition 差異,提供資料修改與刪除範圍、恢復限制及必要的人員判斷。

### 驗收與文件收斂

使用少量整合案例驗證真 Git 共同祖先、衝突、無衝突時自動套入的專案值、重跑、main/tag 變動與 common-only 回收;外部 gh/gcloud 只替換系統邊界。DB 用現有隔離 Mongo 測試,證明失敗/down 不冒充成功基準,JSON 查詢前後無寫入。資料/外部存取未知須明示,不以 mock 宣稱真雲端通過。

現有 CI 的 project-settings job 加入 root CLI 測試,不另造重複 workflow。沒有改變的 Figma 來源/scope 沿用既有證據;新的實際寫入才按既有前置與回讀,不重做 E 首次全量搬遷。

完成後依 STRUCT-11 把操作與規則歸入既有 architecture、deployment、toolbox、ADR 及共用 agent 入口,從本計畫移除完成內容。issue/PR 保留歷史,Claude 或其他接手者只靠 repo + issue 即可續做。

初始化與手動接軌/升級操作見上列正本。整體演練需以不同品牌、新增業務模組及替換治理頁的引用專案,升級共用 UI、API、seed 與 Figma;再回收一項通用修正,發布並再次向下升級。驗收須能從 repo 與操作文件重現,不能只以計畫或 skill 檔存在判定完成。
