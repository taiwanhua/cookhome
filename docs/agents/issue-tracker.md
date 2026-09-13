# Issue tracker: GitHub

本 repo 的 issues 與 PRD 都放在 GitHub Issues,所有操作一律使用 `gh` CLI。

## 慣例

- **建立 issue**:`gh issue create --title "..." --body "..."`,多行內容用 heredoc。
- **讀取 issue**:`gh issue view <number> --comments`,用 `jq` 過濾留言,同時撈取 labels。
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

## 怎麼分辨一張 issue 的種類

| 這張 issue 是什麼 | 判斷方式 | 下一步 |
|---|---|---|
| **Spec(規格,不可直接開發)** | 標題 `Spec:` 開頭、內文為 spec 模板、**沒有** `## Parent` 段 | 對它跑 /to-tickets 拆票 |
| **Ticket(開發票)** | 內文**有** `## Parent` 指回 spec + 驗收條件 | 依看板 Status 行動(見下);掛 `needs-info` 者先解開內列問題 |
| 「可 code-review 的」 | **不存在這種 issue** — review 的對象是 PR:票完成 → PR → /code-review → merge | |

## 票的生命週期:GitHub Projects 看板(唯一真相)

狀態一律以 **Project「CookHome」的 Status 欄位**為準;標籤只當資格註記(`needs-info`、`wontfix` 等),**不用標籤表示狀態**。

| Status | 意義(對應 3 分支流程) | 誰在何時移卡 |
|---|---|---|
| Backlog | 票已開但 Blocked by 尚有 open | 拆票時放入 |
| Ready | blockers 全關,可認領 | blocker 關閉時 |
| In Progress | 已認領開工(assign 給自己) | 實作者開工時 |
| In Review | PR 已開啟(內文必含 `Closes #<票號>` 建立連結) | 實作者開 PR 時 |
| Dev 驗證中 | PR 已合 `dev` → 等手動部署 dev(`gh workflow run Deploy --ref dev -f environment=dev`)+ QA | merge 時 |
| Dev 通過 | dev QA 通過,等合 `staging` | QA 者 |
| Staging 驗證中 | 已合 `staging` → 等手動部署 staging + QA | merge 時 |
| Staging 通過 | staging QA 通過,等 release | QA 者 |
| Released | `staging` 已合回 `main` 並部署 production;**此時關閉 issue** | release 時 |
| Won't Do | 決定不做(issue 以 not planned 關閉) | 決策時 |

Spec issue 不上板(看板只放票);staging 的 PR 內文也要含 `Closes #<票號>` 或 `Refs #<票號>`,自動化才找得到票。

**自動化**(`.github/workflows/project-status.yml`,需 repo secret `GH_PROJECT_TOKEN` — PAT classic 勾 project scope):issue opened → 入板 Backlog;issue closed → Released(not planned → Won't Do);PR 開啟(目標 dev)→ In Review;PR 合 dev → Dev 驗證中;PR 合 staging → Staging 驗證中。其餘欄位手動移卡。

**手動移卡指令**(Project #3,owner taiwanhua):

```
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAeiiKc4BjXhz \
  --field-id PVTSSF_lAHOAeiiKc4BjXhzzhiME14 --single-select-option-id <OPTION_ID>
# ITEM_ID:gh project item-list 3 --owner taiwanhua --format json 依 issue 號查
# OPTION_ID:Backlog=2882aeb7 Ready=e053bab2 In Progress=5adedc57 In Review=43e18a1a
#           Dev驗證中=0eaa8179 Dev通過=cc87d3d5 Staging驗證中=e94980d1 Staging通過=45c49925
#           Released=e3445e43 Won't Do=b6b968cd
```

**陷阱**:PR 內文的 `Closes #n` 只在合進**預設分支(main)**時自動關票 — 我們的 PR 合 `dev`,**不會自動關**;關票時機是 Released(手動 `gh issue close <n> --comment "<PR 連結>"`)。部署一律手動觸發(deploy.yml 僅 workflow_dispatch),merge 不會部署任何環境。

**實作 agent 的義務**:開工時移 In Progress + assign;開 PR 時移 In Review 且 PR 內文含 `Closes #<n>`;merge 後移 Dev 驗證中。移卡指令(欄位/選項 id 建板後記錄於本檔)。

## 實作一張票(接手 SOP,無對話 session 亦適用)

1. **讀**:票全文與留言 → Parent spec(含接手指南)→ CLAUDE.md → 相關規範與 ADR
2. **認領**:assign 給自己,看板移 In Progress
3. **開發**:TDD(先寫紅燈測試,測試只呼叫 spec 指定的接縫);feat 分支一律從 main 切
4. **開 PR**:目標 `dev`,內文含 `Closes #<票號>`;測試/lint/typecheck 全綠才開;看板移 In Review
5. **不做**:不 merge、不動 main/dev/staging 本體、不改 docs(發現文件錯誤寫進回報)
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
