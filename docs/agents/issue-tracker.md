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
- **驗收條件要在該環境驗得到**:#69 寫「白名單外信箱在 dev 不寄」,但 dev 只有 root 一個帳號、信箱就是白名單,這條在 dev 根本驗不到。寫驗收前先問「這個環境有讓它成立的資料嗎」,沒有就改成單元測試覆蓋或註明需要的前置資料。

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

**已全部生效(2026-09-19 確認)**:secret `GH_PROJECT_TOKEN` 已設、workflow 已在 `main`,所以 PR 開啟 / 合 dev / 合 staging、issue 開啟 / 關閉都會自動移卡(PR 內文 `Closes #n` 的票在 release 進 main 時由 GitHub 自動關閉、再由自動化移到 Released)。**仍要手動的只有三格**:Ready(blocker 關閉時)、Dev 通過、Staging 通過(QA 者)。

**手動移卡指令**(Project #3,owner taiwanhua):

```
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAeiiKc4BjXhz --field-id PVTSSF_lAHOAeiiKc4BjXhzzhiME14 --single-select-option-id <OPTION_ID>
```

- `--project-id` 是 `PVT_kwHOAeiiKc4BjXhz`(整行單行,不要斷行 — PowerShell 沒有 `\` 續行)
- ITEM_ID:`gh project item-list 3 --owner taiwanhua --format json --limit 200 --jq '.items[] | select(.content.number==<票號>) | .id'`(預設只回 30 筆,新票不在裡面;`--jq` 直接取 id)
- OPTION_ID:Backlog=`2882aeb7` Ready=`e053bab2` In Progress=`5adedc57` In Review=`43e18a1a` Dev驗證中=`0eaa8179` Dev通過=`cc87d3d5` Staging驗證中=`e94980d1` Staging通過=`45c49925` Released=`e3445e43` Won't Do=`b6b968cd`

**Windows / PowerShell 注意**:`gh issue view --comments` 的純文字輸出會被截斷,改用 `--json body,comments`;`--add-assignee @me` 的 `@me` 要加引號(`"@me"`),否則被當成 splat 運算子。

**陷阱**:PR 內文的 `Closes #n` 只在合進**預設分支(main)**時自動關票 — 我們的 PR 合 `dev`,**不會自動關**;關票時機是 Released(手動 `gh issue close <n> --comment "<PR 連結>"`)。部署一律手動觸發(deploy.yml 僅 workflow_dispatch),merge 不會部署任何環境。

**實作 agent 的義務**:開工時移 In Progress + assign;開 PR 時移 In Review 且 PR 內文含 `Closes #<n>`;merge 後移 Dev 驗證中。移卡指令(欄位/選項 id 建板後記錄於本檔)。

## 實作一張票(接手 SOP,無對話 session 亦適用)

1. **讀**:票全文與留言 → Parent spec(含接手指南)→ CLAUDE.md → 相關規範與 ADR
2. **認領**:assign 給自己,看板移 In Progress
3. **開發**:TDD(先寫紅燈測試,測試只呼叫 spec 指定的接縫);feat 分支從 main 切,**命名含票號**:`feat/<票號>-<kebab 描述>`(如 `feat/25-base-schemas`)。**票有依賴時:從依賴票的 feat 分支切(stacked)** — main 上還沒有依賴內容,從 main 切會沒得開發;PR 一樣目標 dev,**依賴票的 PR 先合、自己後合**(合完 diff 自動只剩本票變更);依賴票被 review 改動時要 rebase 跟上。依賴票已 release 進 main 時,直接從 main 切即可(最常見)。線性依賴鏈是健康的(依序上);**兩票誰先上都無法獨立變綠 = 切票錯誤,併票**。**新 worktree 開工先**:`pnpm install` → `pnpm exec turbo run build --filter=@repo/graphql --filter=@repo/ui --filter=@repo/domain`,否則 lint / typecheck 一開始就對 `@repo/*` 的型別報「cannot be resolved」
4. **開 PR**:目標 `dev`,內文含 `Closes #<票號>`;測試/lint/typecheck 全綠才開;看板移 In Review
5. **不做**:不 merge、不動 main/dev/staging 本體;**docs 只改本票必然連動的兩種**:①本票新增/異動的模組 → 同 PR 維護 `docs/modules/<key>.md` 與 help.md(dis #18)②本票新增的環境變數 / 品牌元素 → 同 PR 更新 env-registry.md / branding.md(CLAUDE.md 規定)。其他文件錯誤(ADR、CONTEXT、規範)**不改**,寫進回報由主流程處理
6. **回報**:PR 連結、測試結果、**接手體驗報告**(找不到/矛盾/用猜的資訊 — 這是文件品質的回饋來源)

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
