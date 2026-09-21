# Issue tracker: GitHub

本 repo 的 issues 與 PRD 都放在 GitHub Issues,所有操作一律使用 `gh` CLI。

## 慣例

- **建立 issue**:`gh issue create --title "..." --body "..."`,多行內容用 heredoc。
- **讀取 issue**:`gh issue view <number> --json body,comments,labels`(Windows 沒有 jq,一律用 gh 內建的 `--jq`;`--comments` 純文字輸出在 PowerShell 會被截斷)。
- **列出 issues**:`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`,視情況加上 `--label` 與 `--state` 過濾。
- **在 issue 留言**:`gh issue comment <number> --body "..."`
- **加上 / 移除標籤**:`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **關閉**:`gh issue close <number> --comment "..."`

repo 由 `git remote -v` 推斷 — 在 clone 內執行時 `gh` 會自動處理。

## Pull requests 是否作為需求來源

**PRs as a request surface: no.** _(若此 repo 把外部 PR 視為 feature request,改為 `yes`;`/triage` 會讀取這個旗標。)_

設為 `yes` 時,PR 走與 issue 相同的標籤與狀態流程,改用對應的 `gh pr` 指令:

- **讀取 PR**:`gh pr view <number> --comments`,diff 用 `gh pr diff <number>`。
- **列出待 triage 的外部 PR**:`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`,只保留 `authorAssociation` 為 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的項目(排除 `OWNER`/`MEMBER`/`COLLABORATOR`)。
- **留言 / 標籤 / 關閉**:`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 與 PR 共用同一組編號,所以單看 `#42` 無法確定是哪種 — 先 `gh pr view 42`,失敗再 `gh issue view 42`。

## 當 skill 說「publish to the issue tracker」

建立一個 GitHub issue。

## Spec issue 撰寫規則(接手性)

目標:**沒有本地對話 session 的人,拿 repo + issue 就能接手**。

- **細節不重複進 issue** — 權限表、種子清單、schema 這類細節的正本在 repo 文件(`docs/modules/`、`docs/adr/`、schema 文件),issue 只做**精確指路**(提到數量或清單時,同句附上正本檔案)。
- **spec 引用的內容若 repo 沒有正本,先補文件再發 spec** — 只存在於對話或設計圖裡的細節,對接手者等於不存在。
- 每份 spec issue 附「**接手指南**」節:無 session 的閱讀順序(CLAUDE.md 文件地圖 → `docs/agents/domain.md` ADR 導讀 → 本 spec 的資料來源表)。
- **指路要能 grep 到**:引用 `docs/tmp/dis.md` 這類長備忘時,除了條目編號再給一個關鍵字(如「dis.md 二.B 第 15 項,搜『頁籤』」),編號不是標題、用 heading 搜不到。

拆票時的兩條教訓(第 2 段,2026-09-19):

- **同一個行為只歸一張票**:#66(殼)與 #68(密碼頁)都寫了「`mustChangePassword` → 導向改密碼頁」,兩位實作者各做一次、主流程還得對齊。導向、守衛這種橫跨畫面的行為,拆票時指定唯一的 owner 票,另一張只寫「沿用 #n」。
- **共用函式不要指定「誰定義」,直接給簽章與所屬檔案**:#186 / #187 都寫「由 #187 定義、#186 改用」,實際 #186 先合,兩邊各寫一份同語意的函式再對齊。票上寫 `orgs/owner-protection.service.ts` 的 `assertTenantTopOperableBy(operator, org, action)`,誰先到誰寫、後到的 rebase 改用。
- **二選一不留給實作者**:票上寫「保留但恆 false,或移除並同步 admin」這種選項,兩張並行的票會各選一邊;主流程在拆票時就選定。
- **同一模組兩張票並行時,先約定檔案層級的分工**(誰負責拆測試檔、誰改共用 harness),規則共用反而不是問題(#186 / #187 各長出一份 `org-manager-test-support.ts`)。
- **驗收回報附當時的 dev 部署版本(release PR 或 commit)**,否則「當下看到、事後重現不出來」的項目無從判斷是已被修掉還是條件沒對上(#186 的展開箭頭)。
- **驗收條件要在該環境驗得到**:#69 寫「白名單外信箱在 dev 不寄」,但 dev 只有 root 一個帳號、信箱就是白名單,這條在 dev 根本驗不到。寫驗收前先問「這個環境有讓它成立的資料嗎」,沒有就改成單元測試覆蓋或註明需要的前置資料。
- **部署後抓一次 bundle 驗「打包資產」**(#259,2026-09-21):凡是**跟著 build 烘進產物的非程式檔**(admin 的 `src/md/module-help/*.help.md` 模組說明、i18n 字典、範本…),部署完要直接抓該環境的 bundle 確認內容真的在裡面 —— 本機 `pnpm build` 正常不代表 image 正常(`.dockerignore` 的 `**/*.md` 曾把整包說明擋在 build context 外,三環境「?」全部 disabled 卻沒有任何一步失敗)。做法:瀏覽器開該環境 admin → DevTools Network 抓 `assets/index-*.js` → 搜一個一定會出現的字串(說明用「這個模組做什麼」),命中 0 次就是沒打包進去。Dockerfile 的 `check:help-bundle` 已擋住 help.md 這一類,新增別種打包資產時要同步補一條檢查(見 `docs/deployment.md` 第二節)。

## 怎麼分辨一張 issue 的種類

| 這張 issue 是什麼           | 判斷方式                                                                     | 下一步                                                    |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Spec(規格,不可直接開發)** | 標題 `Spec:` 開頭、內文為 spec 模板、**沒有** `## Parent` 段                 | 對它跑 /to-tickets 拆票                                   |
| **Ticket(開發票)**          | 內文**有** `## Parent` 指回 spec + 驗收條件                                  | 依看板 Status 行動(見下);掛 `needs-info` 者先解開內列問題 |
| 「可 code-review 的」       | **不存在這種 issue** — review 的對象是 PR:票完成 → PR → /code-review → merge |                                                           |

## 票的生命週期:GitHub Projects 看板(唯一真相)

狀態一律以 **Project「CookHome」的 Status 欄位**為準;標籤只當資格註記(`needs-info`、`wontfix` 等),**不用標籤表示狀態**。

| Status         | 意義(對應 3 分支流程)                                                                     | 誰在何時移卡   |
| -------------- | ----------------------------------------------------------------------------------------- | -------------- |
| Backlog        | 票已開但 Blocked by 尚有 open                                                             | 拆票時放入     |
| Ready          | blockers 全關,可認領                                                                      | blocker 關閉時 |
| In Progress    | 已認領開工(assign 給自己)                                                                 | 實作者開工時   |
| In Review      | PR 已開啟(內文必含 `Closes #<票號>` 建立連結)                                             | 實作者開 PR 時 |
| Dev 驗證中     | PR 已合 `dev` → 等手動部署 dev(`gh workflow run Deploy --ref dev -f environment=dev`)+ QA | merge 時       |
| Dev 通過       | dev QA 通過,等合 `staging`                                                                | QA 者          |
| Staging 驗證中 | 已合 `staging` → 等手動部署 staging + QA                                                  | merge 時       |
| Staging 通過   | staging QA 通過,等 release                                                                | QA 者          |
| Released       | `staging` 已合回 `main` 並部署 production;**此時關閉 issue**                              | release 時     |
| Won't Do       | 決定不做(issue 以 not planned 關閉)                                                       | 決策時         |

Spec issue 不上板(看板只放票);staging 的 PR 內文也要含 `Closes #<票號>` 或 `Refs #<票號>`,自動化才找得到票。

**自動化**(`.github/workflows/project-status.yml`):issue opened → 入板 Backlog;issue closed → Released(not planned → Won't Do);PR 開啟(目標 dev)→ In Review;PR 合 dev → Dev 驗證中;PR 合 staging → Staging 驗證中。其餘欄位手動移卡。

**「PR 開啟 → In Review」只移 PR 自己的卡**(2026-09-20 確認):PR 進板是一張獨立的卡,`Closes #n` 連到的**票卡不會跟著動**,實作者要自己把票卡移到 In Review(下方手動移卡指令)。合 dev / 合 staging 的兩格同理,看到 PR 卡動了不代表票卡動了。

**已全部生效(2026-09-19 確認)**:secret `GH_PROJECT_TOKEN` 已設、workflow 已在 `main`,所以 PR 開啟 / 合 dev / 合 staging、issue 開啟 / 關閉都會自動移卡(PR 內文 `Closes #n` 的票在 release 進 main 時由 GitHub 自動關閉、再由自動化移到 Released)。**仍要手動的只有三格**:Ready(blocker 關閉時)、Dev 通過、Staging 通過(QA 者)。

**手動移卡指令**(Project #3,owner taiwanhua):

```
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAeiiKc4BjXhz --field-id PVTSSF_lAHOAeiiKc4BjXhzzhiME14 --single-select-option-id <OPTION_ID>
```

- `--project-id` 是 `PVT_kwHOAeiiKc4BjXhz`(整行單行,不要斷行 — PowerShell 沒有 `\` 續行)
- ITEM_ID:`gh project item-list 3 --owner taiwanhua --format json --limit 200 --jq '.items[] | select(.content.number==<票號>) | {id, status}'`(預設只回 30 筆,新票不在裡面;連 `status` 一起取,才知道現在在哪一格、要不要移)
- OPTION_ID:Backlog=`2882aeb7` Ready=`e053bab2` In Progress=`5adedc57` In Review=`43e18a1a` Dev驗證中=`0eaa8179` Dev通過=`cc87d3d5` Staging驗證中=`e94980d1` Staging通過=`45c49925` Released=`e3445e43` Won't Do=`b6b968cd`

**看板欄位在 UI 的位置**(重建看板時對得起來):Project「CookHome」→ 右上 … → Settings → Fields → `Status` 的選項清單,順序即上表。

**改含中文的檔案**:PowerShell 的 cp950 stdout 會把繁中印成亂碼、`sed -i` 對含 CJK 的行常靜默不生效;最可靠的做法是 `python - <<'PY'` 寫精準取代腳本(worktree 守衛不擋這種 heredoc,但**寫 `.md` 要加 `newline="\n"`**,否則寫出 CRLF、`format:check` 立刻紅),或直接用 Write / Edit 工具。這台機器沒有外部 `jq`,只有 `gh --jq`;filter 名一律寫全名 `@repo/admin`(`--filter=admin` 找不到套件)。其餘守衛細節見下方「worktree 裡的 Bash 守衛與寫檔」。

**Windows / PowerShell 注意**:`gh issue view --comments` 的純文字輸出會被截斷,改用 `--json body,comments`;`--add-assignee @me` 的 `@me` 要加引號(`"@me"`),否則被當成 splat 運算子。

**陷阱**:PR 內文的 `Closes #n` 只在合進**預設分支(main)**時自動關票 — 我們的 PR 合 `dev`,**不會自動關**;關票時機是 Released(手動 `gh issue close <n> --comment "<PR 連結>"`)。部署一律手動觸發(deploy.yml 僅 workflow_dispatch),merge 不會部署任何環境。

**實作 agent 的義務**:開工時移 In Progress + assign;開 PR 時移 In Review 且 PR 內文含 `Closes #<n>`;merge 後移 Dev 驗證中。移卡指令(欄位/選項 id 建板後記錄於本檔)。

## 實作一張票(接手 SOP,無對話 session 亦適用)

1. **讀**:票全文與留言 → Parent spec(含接手指南)→ CLAUDE.md → 相關規範與 ADR
2. **認領**:assign 給自己,看板移 In Progress
3. **開發**:TDD(先寫紅燈測試,測試只呼叫 spec 指定的接縫);feat 分支從 main 切,**命名含票號**:`feat/<票號>-<kebab 描述>`(如 `feat/25-base-schemas`)。**票有依賴時:從依賴票的 feat 分支切(stacked)** — main 上還沒有依賴內容,從 main 切會沒得開發;PR 一樣目標 dev,**依賴票的 PR 先合、自己後合**(合完 diff 自動只剩本票變更);依賴票被 review 改動時要 rebase 跟上。依賴票已 release 進 main 時,直接從 main 切即可(最常見)。線性依賴鏈是健康的(依序上);**兩票誰先上都無法獨立變綠 = 切票錯誤,併票**。**新 worktree 開工先**:`pnpm install` → `pnpm exec turbo run build --filter=@repo/graphql --filter=@repo/ui --filter=@repo/domain`,否則 lint / typecheck 一開始就對 `@repo/*` 的型別報「cannot be resolved」。開工的兩個環境動作見下方「`.claude/hook-typecheck-off`」與「worktree 裡的 Bash 守衛與寫檔」兩節。改檔名為 PascalCase 的重構要**先在該包啟用 `frontend-style` 再搬檔**(基礎設定的 `unicorn/filename-case` 會連目錄名一起檢查)
   **動到 api 的 GraphQL schema 時**(resolver / model / input / `*.graphql` document),交件前依序跑 `pnpm --filter @repo/api schema:generate` 與 `pnpm --filter @repo/graphql generate`,把 `apps/api/schema.gql` 與 `packages/graphql/src/generated` 兩份產物一起進 commit(GQL-05)。api-only 的票也一樣 —— CI 的 `codegen 產物與 schema 一致` 一步會擋(#160)。

4. **開 PR**:目標 `dev`,內文含 `Closes #<票號>`;測試/lint/typecheck 全綠才開;看板移 In Review
   - **admin 票要附 mock 模式截圖**(#194,2026-09-22):`pnpm --filter @repo/admin dev:mock` 起在 `http://localhost:3002`(自動登入 root、各頁都有假資料;`?view=tenant` 換租戶視角、`?auth=off` 看登入頁),截改動到的每一頁貼進 PR 內文,逐張寫明「哪一頁、什麼狀態」。**不必有 dev 帳號、不必等部署** —— 版面問題在 PR 階段就看得到,不要留到 dev 驗證。跑法與實作細節見 `docs/standards/testing/testing.md` TEST-08 的「mock 開發模式」
5. **不做**:不 merge、不動 main/dev/staging 本體;**docs 只改本票必然連動的兩種**:①本票新增/異動的模組 → 同 PR 維護 `docs/modules/<key>.md` 與 help.md(dis #18)②本票新增的環境變數 / 品牌元素 → 同 PR 更新 env-registry.md / branding.md(CLAUDE.md 規定)。其他文件錯誤(ADR、CONTEXT、規範)**不改**,寫進回報由主流程處理
6. **回報**:PR 連結、測試結果、**接手體驗報告**(找不到/矛盾/用猜的資訊 — 這是文件品質的回饋來源)

### `.claude/hook-typecheck-off`

**重構型的票**(先搬檔再修 import,中途型別必紅)與**只改文件的票**,在 repo 根建空檔 `.claude/hook-typecheck-off`(已 gitignore),PostToolUse hook 就只跑 ESLint。

- **開工第一件事、單獨一行指令做,做完 `ls .claude/` 確認** — 有人把它串在複合指令裡,被 worktree 守衛整條擋掉而不自知,結果每改一個檔都等一次 typecheck。
- **交件前刪掉**,並自己跑一次 `pnpm exec turbo run check-types` 與 `pnpm run format:check`(文件票只需後者)。

### worktree 裡的 Bash 守衛與寫檔

守衛對含 `$(...)`、管線、迴圈的指令會拒絕,習慣寫**平鋪的單行指令**。已知的幾個坑:

- **寫檔用 Write / Edit 工具**;`python - <<'PY'` 的單檔精準取代可用,但**一支腳本裡用 `pathlib` 批次寫多個檔會被判定太複雜而擋掉**,逐檔改回 Write(#203)。
- **python 寫 `.md` 要 `newline="\n"`**:Windows 預設會寫成 CRLF,`format:check` 立刻紅。
- **這台機器沒有外部 `jq`**:含 `jq` 的指令不是報錯而是**靜默失敗**(輸出空的),一律用 `gh --jq`。
- **CI 輪詢用平鋪的單行 `until`**(`until gh pr checks <n>; do sleep 30; done` 這種寫在一行),多行 / 巢狀的迴圈會被擋。**不要加 `--required`**(2026-09-22,#290):免費方案沒有 branch protection、也就沒有 required checks,`gh pr checks --required` 永遠回 `no required checks`(非零退出),迴圈會一直轉到逾時,看起來像 CI 卡住。不帶旗標時它看的是 PR 上所有的 check。
- **`git stash` 的堆疊與主 checkout、其他 worktree 共用**:不要用裸 `git stash` / `git stash pop`(會撈到別的 session 的東西),要用時 `git stash push -u -m "<票號>-<標記>"`,取回前先 `git stash list` 找到**自己那一筆當下的 `stash@{n}`**再 apply;更安全的做法是開一個 WIP commit。
- **turbo 的快取跨 worktree 共用**:別的 worktree 先跑過同一份輸入,`pnpm exec turbo run test --filter=…` 會 `cache hit, replaying logs`(甚至 `FULL TURBO`)—— 驗收自己的改動沒問題(輸入變了就不會命中),但**取「`origin/main` 的測試數基準」時會拿到別人跑的舊結果**。取基準要進 package 目錄直接跑 jest,見 `docs/standards/testing/testing.md` TEST-08 的「測試數的基準」。
- 暫存檔放 scratchpad 且**檔名帶票號**(多個 agent 共用同一個 scratchpad)。

### 開 PR 之後的等待(CI 與 mergeable)

- **PR 對 `dev` 是 `CONFLICTING` 時,GitHub 根本不建 merge ref、CI 一個 check 都不會跑**,`gh pr checks --watch` 會永遠等下去。開 PR 後先看 `gh pr view <n> --json mergeable`,`CONFLICTING` 就先 rebase 到最新的 `origin/main` 再說(#206)。**沒有 merge ref 連帶讓 `project-status.yml` 也不跑** —— PR 卡與票卡都不會自動移格,看到看板沒動先查 `mergeable`,不要以為自動化壞了。
- **rebase 之後還是 `CONFLICTING`、本地 `git merge-tree --write-tree origin/dev HEAD` 卻乾淨 = 交叉 merge base**(`dev` 與 `staging` 都會發生:feat 從 `main` 切,而兩條線各自合過同一批票)。這不是實作者能單獨解的:要由主流程把該 base reset 到 `main`(`git push --force origin origin/main:refs/heads/dev`,`staging` 同;前置檢查見 `docs/deployment.md` 二、Release 步驟第 4 點),**base 更新後還要把 PR `gh pr close <n>` → `gh pr reopen <n>`** 才會觸發 CI(base 變動不算 `pull_request` 事件)。遇到就回報,不要自己去改 `dev` / `staging`。
- **release 一批一次**:各票各自合 `dev`、各自合 `staging`,累積成一批後才走一次 release PR + 一次部署(`dev` 的部署也等該批最後一張合完才觸發),release 完由主流程把 `dev` / `staging` reset 對齊 `main`;只有產物依賴的票才單獨先 release。所以「合進 `dev` 了但還沒部署」是正常的,不必追問。
- **剛開 PR 時 Actions 可能排隊很久**(沒有 check 不等於失敗),**force-push 之後 `mergeable` 會短暫回 `UNKNOWN`** —— 等幾秒重查,不要據此判斷有衝突(#203)。
- **交件前跑一次 `pnpm format`**(#195 起 `format:check` 涵蓋 md 與 ts / tsx / js / json / yaml,CI 會擋未格式化的檔)。`main` 已一次性重排過,所以跑完只會看到自己改到的檔案,不必再挑 diff。

### 拆票時要寫清楚的幾件事(第 4 段補充,2026-09-20)

- **seed 類的票要明寫「連帶修 api 既有測試的斷言屬於本票」**:動了種子數量 / 內容,別人寫死數字的測試一定會紅(#202 改了 44 / 64 筆就連帶修 `permission.test.ts`)。
- **跨頁共用的測試 harness 要指定歸屬**:分工清單只寫「頁面 + 自己的 handler 檔」時,兩張票都要動的 `*-handlers.ts` / `*-test-support.ts` 會變成沒人認領的衝突點(#211)。
- **已知會超過 `max-lines` 400 的檔案,拆票時就直接指定兩個檔名**,不要讓實作者自行決定怎麼拆(#210 的 `data-scope-rule.ts`)。
- **「二選一」不留給實作者,並指定 owner 票**:尤其是**過渡做法的退場時機**(第 3 段的指派角色過渡寫法拖到 #211 才退場,期間兩套判準並存)。
- **規格要寫明邊界條件**:例如「停用的角色不可選」要補「**已持有 + 已停用**時仍可取消」,否則照字面實作會讓人永遠拔不掉那個角色(#211)。
- **寫入端點要不要套自鎖,拆票時就裁決**(2026-09-22 補,#292):`SELF_LOCK` 守的是「關掉就再也開不回來」。換圖示、改顯示名這類**隨時改得回來**的寫入不套(`setModuleIcon` 連自己模組的圖示都換得了);會讓操作者失去繼續操作能力的才套。票上直接寫「套 / 不套 + 一句理由」,不要讓實作者從既有端點推。
- **input 欄位「缺席」與 `null` 的語意要寫明**(2026-09-22 補,GQL-06):兩者同義(都是清空 / 回預設)還是要分開處理(缺席 = 不動、`null` = 清空),差一個字就是兩種實作與兩組測試。票上寫死,並指明落庫是 `$set: null` 還是 `$unset`(ADR-0002:初始 seed 值欄位一律寫 `null`)。
- **「僅確認、不改」的項目要標出來**(2026-09-22 補,#299):驗收清單裡混著「要改的」與「只是去確認它本來就對的」時,實作者會把後者也動一遍(#299 的模組詳情面板本來就正確,差點被一起改成列表頁的版型)。票上分兩節寫:「要改的」與「確認後不動的(附為什麼不動)」。
- **文件正本歸屬要指定到「哪張票寫」**(2026-09-21 補):同段的文件票與實作票會寫到同一份 `docs/modules/<key>.md` —— #262(文件)與 #260(實作)各寫了一版「權限容器」節,合起來就是衝突。拆票時直接分:**規則本文(模組文件的行為說明、ADR、`docs/standards/`)只由文件票寫;實作票只碰自己必然連動的兩處 —— `docs/modules/<key>.md` 的「api 介面」小節與 `apps/admin/src/md/module-help/<key>.help.md`**。實作發現規則本文寫錯,不要就地改,寫進 PR 的「規則回饋」由文件票收。

### 新套件的版本怎麼查

**一律 `npm view <pkg> version` 查 registry 上的最新版**(CLAUDE.md「版本查 registry」指的就是這個),不要照記憶或別處抄的版本號寫;同時確認與既有同家族套件的主 / 次版本一致(`@mui/x-date-pickers` 要對齊已裝的 `@mui/x-tree-view`)。

## 當 skill 說「fetch the relevant ticket」

執行 `gh issue view <number> --comments`。

## Wayfinding 操作

供 `/wayfinder` 使用。**map(地圖)** 是一個 issue,**child(子票)** 是掛在它底下的 tickets。

- **Map**:一個貼上 `wayfinder:map` 標籤的 issue,內文放 Notes / Decisions-so-far / Fog。`gh issue create --label wayfinder:map`。
- **Child ticket**:以 GitHub sub-issue 連到 map 的 issue(透過 `gh api` 呼叫 sub-issues endpoint)。若 sub-issues 未啟用,退而求其次:把子票加進 map 內文的 task list,並在子票內文開頭寫 `Part of #<map>`。標籤:`wayfinder:<type>`(`research`/`prototype`/`grilling`/`task`)。被認領後,子票 assign 給負責的開發者。
- **Blocking(阻擋關係)**:用 GitHub **原生 issue dependencies** — 這是正式且 UI 可見的表示法。新增阻擋邊:`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`,其中 `<blocker-db-id>` 是阻擋者的 **database id** 數值(`gh api repos/<owner>/<repo>/issues/<n> --jq .id`,_不是_ `#number` 或 `node_id`)。GitHub 會回報 `issue_dependencies_summary.blocked_by`(只計 open 的阻擋者 — 即即時的門檻)。若 dependencies 不可用,退而求其次:在子票內文開頭寫一行 `Blocked by: #<n>, #<n>`。所有阻擋者都關閉後,子票即解除阻擋。
- **Frontier query(找下一張可做的票)**:列出 map 底下 open 的子票(`gh issue list --state open`,範圍限定在 map 的 sub-issues / task list),排除仍有 open 阻擋者(`issue_dependencies_summary.blocked_by > 0`,或 `Blocked by` 行中仍有 open issue)或已有 assignee 的票;依 map 順序取第一張。
- **Claim(認領)**:`gh issue edit <n> --add-assignee @me` — 這是 session 的第一個寫入動作。
- **Resolve(解決)**:`gh issue comment <n> --body "<answer>"`,接著 `gh issue close <n>`,最後把 context 指標(gist + 連結)補到 map 的 Decisions-so-far。
