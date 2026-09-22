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

**改含中文的檔案**:PowerShell 的 cp950 stdout 會把繁中印成亂碼、`sed -i` 對含 CJK 的行常靜默不生效;最可靠的做法是 `python - <<'PY'` 寫精準取代腳本(worktree 守衛不擋這種 heredoc,但**寫 `.md` 要加 `newline="\n"`**,否則寫出 CRLF、`format:check` 立刻紅),或直接用 Write / Edit 工具。**全形 / 半形標點很容易混進去而沒有任何一關會擋**(2026-09-22,#321):用 python 寫測試文案或 `packages/i18n` 的 zh-TW 字典時,全形問號「?」、全形逗號「,」與半形版本肉眼幾乎一樣,prettier 不管、lint 也不管,只有跟斷言比對時才發現。寫完用 `grep` 對那一行原樣比對一次(或直接從既有文案複製貼上),不要憑記憶打標點。這台機器沒有外部 `jq`,只有 `gh --jq`;filter 名一律寫全名 `@repo/admin`(`--filter=admin` 找不到套件)。其餘守衛細節見下方「worktree 裡的 Bash 守衛與寫檔」。

**`Edit` 工具對「含 CJK + 大量空白」的 markdown 表格列常常比對不到**(2026-09-22,#313 / #322 各撞一次):prettier 排過的表格列,欄寬是用**半形空白補到對齊 CJK 寬度**的,肉眼與複製貼上都還原不回原樣,`Edit` 於是報「String to replace not found」。做法:**改用 `python - <<'PY'` 以 `line.startswith("| \`KEY\`")`定位那一列**(表格列的開頭是穩定的),換掉整列或在它後面插一列,寫檔記得`newline="\n"`,寫完跑 `pnpm exec prettier --write <檔>`讓它重排欄寬。**不要為了讓`Edit` 比對得到而手動調空白**。

**`packages/i18n` 的 JSON 一律用 Edit / Write 改那幾個字面字元,不要用腳本做全檔替換**(2026-09-23,#374):字典是一整包兩語系對照的資料,腳本的「把 A 換成 B」很容易掃到別的 namespace 裡同名的 key 或同樣的字串。**新增 zh-TW 字串時,標點用「從既有條目複製」或碼位 dump 比對**一次(`python -c "print([hex(ord(c)) for c in s])"`),CookHome 的慣例是:**半形** `,` `:` `?` `(` `)` `;`、**全形** `「」` `。` `—`。

**Windows / PowerShell 注意**:`gh issue view --comments` 的純文字輸出會被截斷,改用 `--json body,comments`;`--add-assignee @me` 的 `@me` 要加引號(`"@me"`),否則被當成 splat 運算子。

**陷阱**:PR 內文的 `Closes #n` 只在合進**預設分支(main)**時自動關票 — 我們的 PR 合 `dev`,**不會自動關**;關票時機是 Released(手動 `gh issue close <n> --comment "<PR 連結>"`)。部署一律手動觸發(deploy.yml 僅 workflow_dispatch),merge 不會部署任何環境。

**實作 agent 的義務**:開工時移 In Progress + assign;開 PR 時移 In Review 且 PR 內文含 `Closes #<n>`;merge 後移 Dev 驗證中。移卡指令(欄位/選項 id 建板後記錄於本檔)。

## 實作一張票(接手 SOP,無對話 session 亦適用)

1. **讀**:票全文與留言 → Parent spec(含接手指南)→ CLAUDE.md → 相關規範與 ADR
2. **認領**:assign 給自己,看板移 In Progress
3. **開發**:TDD(先寫紅燈測試,測試只呼叫 spec 指定的接縫);feat 分支從 main 切,**命名含票號**:`feat/<票號>-<kebab 描述>`(如 `feat/25-base-schemas`)。**票有依賴時:從依賴票的 feat 分支切(stacked)** — main 上還沒有依賴內容,從 main 切會沒得開發;PR 一樣目標 dev,**依賴票的 PR 先合、自己後合**(合完 diff 自動只剩本票變更);依賴票被 review 改動時要 rebase 跟上。依賴票已 release 進 main 時,直接從 main 切即可(最常見)。線性依賴鏈是健康的(依序上);**兩票誰先上都無法獨立變綠 = 切票錯誤,併票**。**新 worktree 開工先**:`pnpm install` → `pnpm exec turbo run build --filter=@repo/graphql --filter=@repo/ui --filter=@repo/domain`,否則 lint / typecheck 一開始就對 `@repo/*` 的型別報「cannot be resolved」。**這一步對 `apps/db-migrator` 的票同樣必要**(2026-09-23,#364):它的 `seeds/module-declaration.ts` 依賴 `@repo/domain/module-icon`,沒 build 過連 `check-types` 都跑不起來。**純文件票也要先 `pnpm install`**(2026-09-22,#313 / #322 各撞一次):新 worktree 沒有 `node_modules`,**連 prettier 都沒有** —— PostToolUse hook 與 `pnpm run format:check` 會一路報「Command "prettier" not found」,看起來像 hook 壞了。開工的兩個環境動作見下方「`.claude/hook-typecheck-off`」與「worktree 裡的 Bash 守衛與寫檔」兩節。改檔名為 PascalCase 的重構要**先在該包啟用 `frontend-style` 再搬檔**(基礎設定的 `unicorn/filename-case` 會連目錄名一起檢查)
   **動到 api 的 GraphQL schema 時**(resolver / model / input / `*.graphql` document),交件前依序跑 `pnpm --filter @repo/api schema:generate` 與 `pnpm --filter @repo/graphql generate`,把 `apps/api/schema.gql` 與 `packages/graphql/src/generated` 兩份產物一起進 commit(GQL-05)。api-only 的票也一樣 —— CI 的 `codegen 產物與 schema 一致` 一步會擋(#160)。

4. **開 PR**:目標 `dev`,內文含 `Closes #<票號>`;測試/lint/typecheck 全綠才開;看板移 In Review。**動到 admin 的票另有交付要求**,見下方「admin 票的交付要求」一節
5. **不做**:不 merge、不動 main/dev/staging 本體;**docs 只改本票必然連動的兩種**:①本票新增/異動的模組 → 同 PR 維護 `docs/modules/<key>.md` 與 help.md(dis #18)②本票新增的環境變數 / 品牌元素 → 同 PR 更新 env-registry.md / branding.md(CLAUDE.md 規定)。其他文件錯誤(ADR、CONTEXT、規範)**不改**,寫進回報由主流程處理
6. **回報**:PR 連結、測試結果、**接手體驗報告**(找不到/矛盾/用猜的資訊 — 這是文件品質的回饋來源)

### admin 票的交付要求(#194,2026-09-22)

**凡是動到 `apps/admin` 畫面的票,PR 內文一律附 mock 模式截圖。**(位置定在這裡:它不只屬於「開 PR」那一步 —— 起 mock 模式是開發期間就該做的事,交件只是把截圖貼上。)

```
pnpm --filter @repo/admin dev:mock -- --port <自選埠> --strictPort
```

- **埠不要寫死 3002、也不要憑記憶打網址**(2026-09-23 改寫;#360 / #373 / #375 / #372 / #374 **連續五次**回報,其中一次是連到主 checkout 上一次沒關掉的 server):`3002` 只是偏好值,被占用時 Vite **靜默跳埠**。起的時候指定自己的埠 + `--strictPort`(占用就直接失敗),**網址以終端印出的 `Local:` 那一行為準**。
- **截圖前先開自己的分頁、並確認畫面裡看得到自己這次的改動**(改文案就找那句文案、改版面就看那塊版面)。看到的是別的 worktree 的畫面時,截圖會長得「完全正常」,沒有任何一關會擋。
- 自動登入 root、各頁都有假資料;`?view=tenant` 換租戶管理員視角、`?auth=off` 看登入頁。
- **改動到的每一頁各截一張**貼進 PR 內文,逐張寫明「哪一頁、什麼狀態」;彈窗類的改動要各截開啟前後。
- **不必有 dev 帳號、不必等部署** —— 版面問題在 PR 階段就看得到,不要留到 dev 驗證再回報。
- 跑法與實作細節(入口獨立、共用端點的 handler 正本、`msw/node` 的 alias stub、自動關閉的提示怎麼截、MUI Dialog 的按鈕點不到時怎麼辦)見 `docs/standards/testing/testing.md` TEST-08 的「mock 開發模式」。

### 權限 / 示範模組的票:交件前手動觸發一次劇本 E2E(#378,2026-09-23)

改到**權限解析、模組樹 / 路由防守、示範模組、角色矩陣**的票,交件前手動觸發一次
`gh workflow run e2e.yml --ref <你的分支>`(只有 `workflow_dispatch`、**不在 ci.yml 內**,所以 PR 的 CI 不會跑它),
把 run 連結與結果附在 PR 上。`-f grep="劇本 7"` 可只跑其中一條。
跑法與目前覆蓋到哪幾條見 `docs/standards/testing/testing.md` 的 TEST-05 / TEST-11 與
`docs/testing/permission-scenarios.md` 的「E2E」欄。

### `.claude/hook-typecheck-off`

**重構型的票**(先搬檔再修 import,中途型別必紅)與**只改文件的票**,在 repo 根建空檔 `.claude/hook-typecheck-off`(已 gitignore),PostToolUse hook 就只跑 ESLint。

- **開工第一件事、單獨一行指令做,做完 `ls .claude/` 確認** — 有人把它串在複合指令裡,被 worktree 守衛整條擋掉而不自知,結果每改一個檔都等一次 typecheck。
- **建不起來就略過,不要卡在這裡**(2026-09-23 改寫,#313 / #322 / #375 三次回報):auto mode 的指令分類器有時會把建檔指令整條擋下來,這只是「每次寫檔多等一次 typecheck」,**對交件結果沒有任何影響**。試一次不成就往下做,不要繞路(改用 python 寫、改路徑、關掉 hook…)。
- **交件前刪掉**,並自己跑一次 `pnpm exec turbo run check-types` 與 `pnpm run format:check`(文件票只需後者)。

### worktree 裡的 Bash 守衛與寫檔

守衛對含 `$(...)`、管線、迴圈的指令會拒絕,習慣寫**平鋪的單行指令**。已知的幾個坑:

- **寫檔用 Write / Edit 工具**;`python - <<'PY'` 的單檔精準取代可用,但**一支腳本裡用 `pathlib` 批次寫多個檔會被判定太複雜而擋掉**,逐檔改回 Write(#203)。
- **把多行內容餵給指令的 heredoc 會被擋**(2026-09-22,#183 / #309):`gh pr create --body-file -` 配 heredoc、`git commit -F -` 配 heredoc、`gh issue comment --body-file -` 都一樣。做法是**先把內容用 Write 工具寫成 scratchpad 裡的檔**(檔名帶票號),再 `gh pr create --body-file <那個檔>` / `git commit -F <那個檔>`。commit 訊息只有一行時用 `-m` 即可,多行(含 `Co-Authored-By` 那兩行)就走檔案。
- **turbo 的 global hash 不含 root `package.json` 的 `scripts`**(2026-09-22,#195):改的是根目錄的 script(`format`、`format:check` 這種)時,`turbo run …` 仍會 `cache hit` —— **快取命中不代表你的改動被驗過**。這類票要直接跑那個 script 本人(`pnpm run format:check`),或在 PR 上以 CI 的結果為準。
- **python 寫 `.md` 要 `newline="\n"`**:Windows 預設會寫成 CRLF,`format:check` 立刻紅。
- **這台機器沒有外部 `jq`**:含 `jq` 的指令不是報錯而是**靜默失敗**(輸出空的),一律用 `gh --jq`。
- **CI 輪詢用平鋪的單行 `until`**(`until gh pr checks <n>; do sleep 30; done` 這種寫在一行),多行 / 巢狀的迴圈會被擋。**不要加 `--required`**(2026-09-22,#290):免費方案沒有 branch protection、也就沒有 required checks,`gh pr checks --required` 永遠回 `no required checks`(非零退出),迴圈會一直轉到逾時,看起來像 CI 卡住。不帶旗標時它看的是 PR 上所有的 check。
- **`git stash` 的堆疊與主 checkout、其他 worktree 共用**:不要用裸 `git stash` / `git stash pop`(會撈到別的 session 的東西),要用時 `git stash push -u -m "<票號>-<標記>"`,取回前先 `git stash list` 找到**自己那一筆當下的 `stash@{n}`**再 apply;更安全的做法是開一個 WIP commit。
- **turbo 的快取跨 worktree 共用**:別的 worktree 先跑過同一份輸入,`pnpm exec turbo run test --filter=…` 會 `cache hit, replaying logs`(甚至 `FULL TURBO`)—— 驗收自己的改動沒問題(輸入變了就不會命中),但**取「`origin/main` 的測試數基準」時會拿到別人跑的舊結果**。取基準要進 package 目錄直接跑 jest,見 `docs/standards/testing/testing.md` TEST-08 的「測試數的基準」。**交件前的 `lint` 與 `check-types` 同理**(2026-09-23,#362 被 CI 擋下兩個 type-aware warning 就是快取命中所致):`cd apps/admin && pnpm run lint && pnpm run check-types`,不要只看 turbo 的綠燈。
- **PostToolUse 的 ESLint 對「先加 import、下一次編輯才用到它」的中間態必紅**(2026-09-23,#376):那一刻檔案裡確實有一個沒用到的 import,規則沒有錯。兩種做法都可以,挑一種:**把 import 與用到它的那段合併成一次 `Edit`**,或**接受中間態那次紅**、下一次編輯完成後自然轉綠。不要為了閃它去關 hook 或改 lint 設定。
- **跑測試**:整包驗收 `pnpm exec turbo run test --filter=@repo/admin`(filter 寫全名);**只跑一個檔就進那個 package 的目錄下 `pnpm run test -- <路徑片段>`**,三個包都一樣。`pnpm --filter <pkg> test -- …` 會把 `--` 一起傳進去(`No tests found`)、`pnpm exec jest` 少了 `--experimental-vm-modules` 會直接炸;要下旗標時 **jest 30 的參數是 `--testPathPatterns`(複數)**,`apps/api` 也不例外(#344)。完整說明與取基準的做法見 `docs/standards/testing/testing.md` TEST-08。
- 暫存檔放 scratchpad 且**檔名帶票號**(多個 agent 共用同一個 scratchpad)。

### 開 PR 之後的等待(CI 與 mergeable)

- **PR 對 `dev` 是 `CONFLICTING` 時,GitHub 根本不建 merge ref、CI 一個 check 都不會跑**,`gh pr checks --watch` 會永遠等下去。開 PR 後先看 `gh pr view <n> --json mergeable`,`CONFLICTING` 就先 rebase 到最新的 `origin/main` 再說(#206)。**沒有 merge ref 連帶讓 `project-status.yml` 也不跑** —— PR 卡與票卡都不會自動移格,看到看板沒動先查 `mergeable`,不要以為自動化壞了。
- **rebase 之後還是 `CONFLICTING`、本地 `git merge-tree --write-tree origin/dev HEAD` 卻乾淨 = 交叉 merge base**(`dev` 與 `staging` 都會發生:feat 從 `main` 切,而兩條線各自合過同一批票)。這不是實作者能單獨解的:要由主流程把該 base reset 到 `main`(指令與前置檢查見 `docs/deployment.md` 二、Release 步驟第 4 點,那是正本),**base 更新後還要把 PR `gh pr close <n>` → `gh pr reopen <n>`** 才會觸發 CI(base 變動不算 `pull_request` 事件)。遇到就回報,**不要自己去改 `dev` / `staging`**。
- **release 一批一次**:各票各自合 `dev`、各自合 `staging`,累積成一批後才走一次 release PR + 一次部署(`dev` 的部署也等該批最後一張合完才觸發),release 完由主流程把 `dev` / `staging` reset 對齊 `main`。所以「合進 `dev` 了但還沒部署」是正常的,不必追問。**release 與分支對齊的步驟正本是 `docs/deployment.md` 二、Release 步驟(對齊分支在第 4 點)** —— 這裡與 CLAUDE.md 只是指路,指令以那邊為準。
- **剛開 PR 時 Actions 可能排隊很久**(沒有 check 不等於失敗),**force-push 之後 `mergeable` 會短暫回 `UNKNOWN`** —— 等幾秒重查,不要據此判斷有衝突(#203)。
- **交件前跑一次 `pnpm format`**(#195 起 `format:check` 涵蓋 md 與 ts / tsx / js / json / yaml,CI 會擋未格式化的檔)。`main` 已一次性重排過,所以跑完只會看到自己改到的檔案,不必再挑 diff。

### 新增一個「只手動觸發」的 workflow 時怎麼驗(2026-09-23,#378)

`workflow_dispatch` 有一條 GitHub 的硬限制:**workflow 檔必須已經在預設分支(`main`)上,`gh workflow run` 才叫得動它**。新開的 workflow 還在 feat 分支上,所以「交件前手動跑一次」對它自己是做不到的(`e2e.yml` 就是這樣 —— 建立它的那張票沒辦法先跑一次 e2e,只能等 release 進 `main` 之後)。

交件前想真的驗它跑得起來:**暫時加一段 `push: branches: [<你的 feat 分支>]`** → push 一次讓它跑 → 綠了之後**把那段移除**再開 PR / 合併。PR 內文附那次 run 的連結並註明「驗證用的 push trigger 已移除」。

- **不要把 `push` trigger 留著合進去** —— 手動觸發的 workflow 通常很貴(e2e 要 build + 起 Mongo + 開瀏覽器),留著等於每次 push 都燒 Actions 額度。
- 同理,**「交件前手動觸發一次 e2e」這條要求對 `e2e.yml` 本身的那張票不成立**,寫驗收條件時要避開這種自我指涉。

### 拆票時的硬規則(第 5 段補充,2026-09-22;#183 / #246 / #161 / #319 / #318 / #320 / #344 / #321)

下一節(第 4 段補充)是「要寫清楚」的提醒,這一節是**不照做就會出事**的幾條,拆票時逐條對過:

- **重整「驗收遺留票」的範圍前,先逐項對 `git log` 確認哪些已經修掉**:遺留清單是驗收當下寫的,之後合進來的票常常順手修掉其中幾項。做法:`git log --oneline origin/main | grep <票號>`、或 `git log --oneline --grep=<票號>` 逐項搜,已修的**在票上劃掉並註明是哪個 commit / PR 修的**,不要留著讓實作者重做一次(#183)。
- **裁決寫死在票上,不寫「建議①」**:票上出現「建議」「可考慮」「二選一」時,兩張並行的票會各選一邊,主流程還要回頭對齊。**拆票時就選定並寫一句理由**;真的還沒想清楚,就不要把那部分放進這一批。踩過的:#161 的孤兒檔清理只寫「建議①」、#246 的「候選清單回哪些人」由實作者自行決定為「管理範圍內 + eligible 旗標」、#194 的「worker 放 `public/`」(那個選項會違反「dist 不含 worker」)。
- **同一批會碰到同一個檔案的票,票上列一張分工表**:哪張票建檔、哪張票只能追加、共用的 harness / handler 歸誰。#161 與 #318 同批動 `apps/api/src/storage/`,兩邊各自改一次同一組規則常數。分工表寫在兩張票上(只寫在其中一張等於沒寫)。
- **spec 與設計稿「各說一半」的欄位要在票上點名**:`status` 還是 `enabled` 是狀態欄、是 `name` 還是 `title` —— 這種半句差異實作者只會看到其中一邊,做完才發現對不上(#320)。拆票時把該模組的欄位名逐一對過 schema(`apps/api/src/database/schemas/*.schema.ts`)再寫進票。
- **「某功能還沒實作、所以被別的測試借去當反例」的耦合要在票上標出**:#321 的殼測試拿「示範模組2」當「未實作的佔位頁」,等模組2 真的實作出來,5 個殼測試同時紅,實作者一度以為自己抽壞了。票上寫明「本票會讓 X 的測試失去反例,連帶修 X 屬於本票」;更好的做法是**反例改用永不實作的夾具**(先例 `test/msw/module-fixtures.ts` 的 `placeholderModules`)。
- **對照組模組的 i18n 與測試夾具「各自一份」要明寫**,不留給實作者裁決(#321):示範模組1 / 模組2 這種「同版型的對照組」,共用一份字典或夾具看起來省事,實際上兩邊只要有一處要分歧就得拆回去,而且拆的時候兩張票都已經合了。
- **seed 類的票除了「連帶修既有斷言」(下一節第 1 條)還有兩件**(#319):①**加業務資料會讓 root 視角的既有測試「多出資料」** —— root 看得到全部,清單筆數、分頁、樹的節點數都會變,受影響的不只是「數字寫死」的那幾個;②**拆票前先查現有 seeds 能引用到什麼**(`apps/db-migrator/seeds/`),能沿用既有的組織 / 角色 / 欄位就不要新增,新增一筆的連帶成本是上面那一整串。
- **要讓程式票順手改 ADR / 規範,票面要寫明例外**(#344):issue-tracker 的規則是「規則本文(ADR、`docs/standards/`、模組文件的行為說明)只由文件票寫」,但拆票時常寫「順便在 ADR-00xx 補一句」,兩條形式上相衝。做法:**票上明寫「本票例外可改 `ADR-00xx` 第 N 段,只改這一段」**;沒寫就一律留給文件票,實作票把發現寫進 PR 的「規則回饋」。**`docs/modules/<key>.md` 的「admin 頁面」節與 `docs/agents/module-scaffold.md` 同樣算規則本文**(2026-09-23 補,#359):實作票要動它們也要在票面明寫例外,否則實作者會在「我該不該改」上卡一次。
- **`CLAUDE.md` 在每張票上都要明確歸進「可改」或「不可改」**(2026-09-23 補,#313 / #322 各遇一次灰區):它既是規則本文、又常被順手指路,不寫的話實作者只能猜。預設是**不可改**(它是入口文件,改動影響每一個 agent);真的要改就開一張獨立的文件票。
- **拆票的指路要先開檔確認,不要憑記憶指先例**(2026-09-23 補,#359 踩到):#359 的票面寫「列表 Switch 對齊使用者管理列表」,但使用者管理的停用是 `Button`、啟用欄是 `Tag`,真正的列表 Switch 先例是 `FieldManagerPage/FieldOptionsPanel/FieldOptionsTable.tsx`(含無權限時退回 `Tag`)。**指錯先例比不指更糟** —— 實作者會照著一個不存在的東西做。寫票時把那個檔案打開看一眼,並在票上寫到**檔案路徑**。
- **名字相近的元件 / 函式要在票上點名是哪一支**(2026-09-23 補,#362):`OrgPickerDialog`(勾選所屬組織)與 `OrgChangeDialog`(移除確認)只差一個詞,票面寫「組織彈窗」時兩邊都對得上。同一頁有兩支以上同族元件時,票上寫**完整檔名**。
- **票面提到的欄位要逐一對過 schema,「推導出來的欄位」尤其要**(2026-09-23 補,#364;延伸自下一條的「spec 與設計稿各說一半」):#364 的票面寫 `roles.kind` 是判準,但 schema 裡根本沒有這個欄位(只有 `key` / `isSystem`,`kind` 是 api 依操作者算出來的回傳欄位)。**判準類的欄位要寫「正本在哪」而不只是欄位名** —— 該票真正的判準正本是 db-migrator 的 **registry 宣告清單**(`apps/db-migrator/seeds/registry.ts`),不是任何一個資料庫欄位。
- **要 root-only 就直接指定 `system.org-manager.tenant-ops` 容器底下的 key**(2026-09-23 補,#374):`isRootOnly` 是**模組**的旗標、不是權限的旗標(ADR-0004 / ADR-0009:模板複製時整個模組被扣除),所以票上寫「這個動作要 root-only」等於沒寫 —— 要寫成「權限 key 掛在 `…tenant-ops` 底下」。已有的先例是 `tenant-ops.provision` / `revoke-provision` / `transfer-owner`。
- **「驗收缺口」類的票,開票時附原始 payload 與操作順序**(2026-09-23 補,#363):「矩陣存錯了」這種回報,實作者拿不到當時送出去的東西就只能重現、猜條件。#363 最後是靠使用者事後補的 input 才確認引擎本身沒問題(問題在顯示樹)。票上放:**送出的 payload**、**操作順序**(先點什麼再點什麼)、**當時的環境與版本**(dev 的 release PR / commit)。
- **「逐一檢查同型」類的驗收項,要求 PR 列出「確認不動」的結論**(2026-09-23 補,#372):票上寫「把其他同類的地方也檢查一遍」時,只改到的那幾處會進 diff,**檢查過但不必改的那些在 PR 上完全看不見** —— review 的人無從分辨「檢查過沒問題」與「漏了」。票面直接要求:PR 內文列出逐項結論,不動的寫一句為什麼。
- **驗收項寫成「現況 / 期望」兩行**(2026-09-23 補,#373):只寫期望時,實作者要先自己猜現在長什麼樣才知道差在哪;兩行寫清楚,連帶讓「其實已經是對的」那幾項當場消掉(同上一節的「僅確認、不改」)。**引用 Figma 時節點 id 給到列層級**(給到整張畫布等於沒給)。
- **清單類端點的三件事在票上寫死**(2026-09-23 補,#377):①**候選清單的端點**(「可見且尚未加入」這種)直接寫進票面,不要讓實作者從既有端點推;②**「直接成員」還是「子樹成員」**這類欄位語意在票上點名(兩者數字對不起來是對的,但沒寫就會被當成 bug);③**mutation 的 payload 回不回清單**寫死(回了就有兩份可能不一致的真相,不回就要在票上寫「加完失效哪幾把 query」)。
- **「等某票合併後再派」不要用 `needs-info` 標籤**(2026-09-23 補,#377):那個標籤的語意是「票面本身有問題要先解開」,拿來表示等待會讓 triage 看不懂。改在票面寫一行 `Blocked by: #<n>`(看板的 Backlog / Ready 兩格就是吃這個)。
- **`apps/` 還是 `packages/` 這種「放哪裡」的二選一,拆票時裁決**(2026-09-23 補,#378):e2e harness 要當一個 app 還是一個 package、共用元件先放 `components/` 還是直接進 `@repo/ui` —— 這類問題實作者兩邊都做得出來,但選錯的代價是之後整包搬。票上寫選哪邊 + 一句理由(同本節「裁決寫死在票上」)。
- **票面引用「錯誤解讀」的慣例時照實際的寫法寫**(2026-09-23 補,#376):admin 的慣例是 **`<ns>ErrorOf(error)` 取出 code、再 `tErrors(code)` 取文案**(正本 `docs/standards/react/data-fetching.md` DATA-06),**沒有 `messageOf` 這種東西**。票面憑印象造一個不存在的函式名,實作者會先花時間找它。**訊息形狀與要顯示的文案一起對**(#375:`login` 的訊息要帶 `name` 才顯示得出「歡迎,某某」)—— 只寫其中一半,做完才發現對不上。

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
