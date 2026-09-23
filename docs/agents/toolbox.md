# 常用指令與 skill:什麼時機用什麼

給人與 AI 共用的速查表。每一節都附正本:指令以 `package.json` 的 scripts 與 `.github/workflows/*.yml` 為準,本檔與正本不一致時照正本做並回報。流程(何時認領、何時移卡)見 [issue-tracker.md](./issue-tracker.md);指令跑出怪現象先查 [pitfalls.md](./pitfalls.md)。

指令預設在 repo 根執行;PowerShell 與 Bash 兩種寫法不同時,兩種都列。

## 目錄

1. [gh:issue 與 PR](#ghissue-與-pr)
2. [手動觸發的 workflow:部署、E2E、資料庫還原](#手動觸發的-workflow部署e2e資料庫還原)
3. [自動跑的 workflow](#自動跑的-workflow)
4. [分支:對齊與重置 dev / staging](#分支對齊與重置-dev--staging)
5. [pnpm / turbo:建置、測試、格式](#pnpm--turbo建置測試格式)
6. [本機跑 E2E](#本機跑-e2e)
7. [mock 模式](#mock-模式)
8. [codegen 與資料庫(本機)](#codegen-與資料庫本機)
9. [Claude Code skill 對照表](#claude-code-skill-對照表)
10. [派工模板(給無 session 的 agent)](#派工模板給無-session-的-agent)
11. [批次 release(指路)](#批次-release指路)

## gh:issue 與 PR

| 情境                | 指令                                                                                                                                                    | 提醒                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 讀票(含留言)        | `gh issue view <n> --json title,body,comments,labels`                                                                                                   | 純文字 `--comments` 在 PowerShell 會被截斷                     |
| 從 JSON 取欄位      | `gh … --json <欄位> --jq '<filter>'`                                                                                                                    | 沒有外部 `jq`,一律用 `--jq`                                    |
| 認領                | `gh issue edit <n> --add-assignee "@me"`                                                                                                                | `@me` 要加引號                                                 |
| 開 PR               | `gh pr create --base dev --title "…" --body-file <scratchpad 檔>`                                                                                       | 內文先用 Write 寫成檔(heredoc 會被守衛擋);內文含 `Closes #<n>` |
| 多行 commit 訊息    | `git commit -F <scratchpad 檔>`                                                                                                                         | 單行用 `-m`                                                    |
| 看 PR 能不能合 / CI | `gh pr view <n> --json mergeable,statusCheckRollup`、`gh pr checks <n>`                                                                                 | `CONFLICTING` 時 CI 不會跑;不要加 `--required`                 |
| 輪詢 CI             | `until gh pr checks <n>; do sleep 30; done`(寫成一行)                                                                                                   | 多行迴圈會被守衛擋                                             |
| 移看板卡            | `gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAeiiKc4BjXhz --field-id PVTSSF_lAHOAeiiKc4BjXhzzhiME14 --single-select-option-id <OPTION_ID>` | ITEM_ID / OPTION_ID 的查法見 issue-tracker「看板」             |
| 查 workflow run     | `gh run list --workflow <檔名或名稱> --limit 5`、`gh run view <run-id> --log-failed`                                                                    | 手動 workflow 觸發後要自己查結果                               |

正本:[issue-tracker.md](./issue-tracker.md)、`.github/workflows/project-status.yml`

## 手動觸發的 workflow:部署、E2E、資料庫還原

三支都只有 `workflow_dispatch`,merge 不會觸發。UI 路徑一律是 GitHub → Actions → 選 workflow → Run workflow。

| workflow                     | 指令                                                                                      | 何時用                                                                | 副作用                                                                                                                                                       | 前置條件                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Deploy**(`deploy.yml`)     | `gh workflow run Deploy --ref <分支> -f environment=<dev\|staging\|production>`           | 一批票都合進 `dev` 後部署 dev;release 流程中部署 staging / production | 建 image、部署 Cloud Run,**成功後自動跑 `migrate → seed`**;只部署改到的 app(比對該環境目前部署的 SHA)                                                        | 分支與環境要對應:dev←`dev`、staging←`staging`、production←`main`,不對直接失敗;改了 `.dockerignore` / Dockerfile 要加 `-f force=true` |
| **E2E**(`e2e.yml`)           | `gh workflow run e2e.yml --ref <分支>`;只跑一條加 `-f grep="劇本 7"`                      | 改到權限解析、模組樹 / 路由防守、示範模組、角色矩陣的票,交件前跑一次  | 無:資料庫是 job 自己的拋棄式 container,不碰任何環境、不讀 Secret;會花不少 Actions 額度                                                                       | workflow 檔已在 `main`;跑的是 `--ref` 那個分支上的 spec 與 harness                                                                   |
| **Reset DB**(`reset-db.yml`) | `gh workflow run "Reset DB" --ref dev -f environment=<dev\|staging> -f mode=<data\|full>` | 驗收要反覆重建租戶與使用者時,把 dev / staging 的**資料庫**還原        | `data`:只刪人建的資料再補 seed,模組頁調過的開關 / 圖示保留;`full`:`dropDatabase → migrate → seed`,root 密碼回到 secret 當前值。不動 Cloud Run、不清 GCS 檔案 | 沒有 production 選項;指令端另有三道安全閥。會清掉別人正在驗收的資料,先確認沒人在用                                                   |

正本:`.github/workflows/deploy.yml`、`.github/workflows/e2e.yml`、`.github/workflows/reset-db.yml`、`docs/deployment.md`(三、手動操作)

## 自動跑的 workflow

| workflow                                 | 觸發                                                                                           | 看什麼                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **CI**(`ci.yml`)                         | PR 與 push 到 `main` / `dev` / `staging`;**只改文件時不跑**(`docs/**`、`*.md` 在 paths-ignore) | 格式檢查、codegen 產物與 schema 一致(GQL-05)、lint / typecheck / test、build(只跑受影響的 package) |
| **Docs**(`docs.yml`)                     | 同上,但**只在改到 md 時跑**                                                                    | `prettier --check`                                                                                 |
| **Project Status**(`project-status.yml`) | issue / PR 事件                                                                                | 自動移看板卡(規則見 issue-tracker「看板」)                                                         |

正本:`.github/workflows/ci.yml`、`.github/workflows/docs.yml`、`.github/workflows/project-status.yml`

## 分支:對齊與重置 dev / staging

| 情境                                               | 指令                                                                  | 提醒                                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 開工切分支                                         | `git fetch origin` → `git checkout -b feat/<票號>-<描述> origin/main` | 依賴票還沒進 `main` 時改從依賴票的分支切                                                                                                   |
| release 後對齊、或 `dev` 被汙染要**重置 dev 分支** | `git push --force origin origin/main:refs/heads/dev`(`staging` 同理)  | **只由主流程做**;先跑前置檢查(兩個 `git diff --stat` 為空、`gh pr list --base dev --state open`)。絕不把 `main` merge 回 `dev` / `staging` |
| 重置 dev 的**資料庫**                              | 見上一節 Reset DB                                                     | 分支重置與資料庫重置是兩件事                                                                                                               |
| 交叉 merge base(PR 顯示衝突、本地 merge-tree 乾淨) | 主流程 reset 該 base 後,`gh pr close <n>` → `gh pr reopen <n>`        | base 更新不觸發 `pull_request` 事件                                                                                                        |

正本:`docs/deployment.md`(二、Release 步驟第 4、6 點)、`CLAUDE.md`「Git 工作流程」

## pnpm / turbo:建置、測試、格式

| 情境                          | 指令                                                                                           | 提醒                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 新 worktree 第一件事          | `pnpm install`                                                                                 | 純文件票也要(沒裝就沒有 prettier)                                                   |
| 讓 `@repo/*` 型別解得開       | `pnpm exec turbo run build --filter=@repo/graphql --filter=@repo/ui --filter=@repo/domain`     | 程式票開工必做;db-migrator 的票也要                                                 |
| 整包驗收測試                  | `pnpm exec turbo run test --filter=@repo/admin`(`@repo/api`、`@repo/ui`、`@repo/domain`… 同理) | filter 寫全名;turbo 會先 build 依賴                                                 |
| 單檔測試:admin                | `cd apps/admin` → `pnpm run test -- <路徑片段>`                                                | script 已帶 `--experimental-vm-modules`,不要用 `pnpm exec jest`                     |
| 單檔測試:api                  | `cd apps/api` → `pnpm run test -- <路徑片段>`                                                  | 要下旗標時 jest 30 是 `--testPathPatterns`(複數)                                    |
| 單檔測試:ui                   | `cd packages/ui` → `pnpm run test -- <路徑片段>`                                               | 同 admin                                                                            |
| 取 `origin/main` 的測試數基準 | 在 main 的 checkout 進 package 目錄直接 `pnpm run test`                                        | 不要用 turbo:快取跨 worktree 共用,會拿到別人跑的舊結果(TEST-08「測試數的基準」)     |
| 交件前 lint / 型別            | 進各 package 目錄:`pnpm run lint`、`pnpm run check-types`                                      | **理由**:turbo 快取命中時只是重播舊 log,本機綠、CI 仍可能被 type-aware warning 擋下 |
| 全 repo 型別                  | `pnpm exec turbo run check-types`                                                              | 同上,看到 `cache hit` 不代表驗過本次改動                                            |
| 格式化 / 檢查                 | `pnpm format` / `pnpm run format:check`                                                        | 涵蓋 md / ts / tsx / js / json / yaml;改根 scripts 時直接跑 script 本人             |
| help.md 有沒有被打包          | `pnpm --filter @repo/admin build` → `pnpm --filter @repo/admin check:help-bundle`              | 新增 / 改 help.md 的票交件前跑;Dockerfile 也跑這一步                                |
| 查套件最新版                  | `npm view <pkg> version`                                                                       | 不照記憶寫版本號                                                                    |

正本:根 `package.json`、`apps/admin/package.json`、`apps/api/package.json`、`packages/ui/package.json`、`turbo.json`、`docs/standards/testing/testing.md`(TEST-08)

## 本機跑 E2E

| 情境                             | Bash                                             | PowerShell                                                       |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| 第一次:裝 chromium               | `pnpm --filter @repo/e2e e2e:browser`            | 同左                                                             |
| 全部劇本                         | `pnpm e2e`                                       | 同左                                                             |
| 只跑一條                         | `E2E_GREP="劇本 7" pnpm e2e`                     | `$env:E2E_GREP="劇本 7"; pnpm e2e`                               |
| 換埠(預設 api 5101 / admin 4301) | `E2E_API_PORT=5102 E2E_ADMIN_PORT=4302 pnpm e2e` | `$env:E2E_API_PORT="5102"; $env:E2E_ADMIN_PORT="4302"; pnpm e2e` |
| 反覆跑同一條,不重 build          | 加 `E2E_SKIP_BUILD=1`                            | 加 `$env:E2E_SKIP_BUILD="1";`                                    |
| 接在自己起好的 stack 上除錯      | 加 `E2E_SKIP_STACK=1`                            | 加 `$env:E2E_SKIP_STACK="1";`                                    |

- `pnpm e2e` 自己做完 build → 起 Mongo(`mongodb-memory-server`)→ migrate / seed → 起 api 與 admin → 跑完收掉;報告在 `apps/e2e/playwright-report/`。
- 劇本 11 / 15 要 Docker Desktop 開著(fake GCS 容器),沒有就這兩條 skip、其餘照跑。
- `--` 之後的旗標穿不過 `pnpm --filter`,所以選劇本走 `E2E_GREP`;agent 在 worktree 裡用 Bash 下 `VAR=…` 前綴會被守衛擋,用 PowerShell 那一欄。
- 埠一改,admin 要重 build(api 端點是 build 時烘進 bundle 的),不要同時加 `E2E_SKIP_BUILD`。

正本:`apps/e2e/README.md`、`apps/e2e/.env.example`、`apps/e2e/src/config.ts`

## mock 模式

| 情境                      | 指令                                                              | 提醒                                                                                      |
| ------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 起 admin 的 mock 模式     | `pnpm --filter @repo/admin dev:mock --port <自選埠> --strictPort` | **不要在 `--port` 前加 `--`**(加了 vite 會忽略,照樣從 3002 靜默跳埠);網址以 `Local:` 為準 |
| 換租戶管理員視角 / 登入頁 | 網址加 `?view=tenant` / `?auth=off`                               | 預設自動登入 root、各頁都有假資料                                                         |
| PR 截圖                   | 見 issue-tracker「admin 票的交付要求」                            | 截圖前確認畫面裡看得到自己的改動                                                          |

正本:`apps/admin/package.json`(`dev:mock`)、`apps/admin/vite.mock.config.ts`、`docs/standards/testing/testing.md`(TEST-08「mock 開發模式」)

## codegen 與資料庫(本機)

| 情境                       | 指令                                                                                                                                                              | 提醒                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 改了 api 的 GraphQL schema | `pnpm --filter @repo/api schema:generate` → `pnpm --filter @repo/graphql generate`(依序)                                                                          | `apps/api/schema.gql` 與 `packages/graphql/src/generated` 同一個 commit(GQL-05);第一次先 build `@repo/domain` |
| 本機 migrate / seed        | `pnpm --filter @repo/db-migrator migrate`、`… seed`、`… migrate:status`                                                                                           | 需要 `MONGODB_URI`;seed 另需 `ROOT_ADMIN_*`(見 env-registry)                                                  |
| 本機還原資料庫(Bash)       | `RESET_ALLOW_ENV=dev MONGODB_URI=mongodb://127.0.0.1:27017/cookhome-dev pnpm --filter @repo/db-migrator reset --mode=data --confirm=cookhome-dev`                 | 資料庫名要以 `-dev` 結尾,否則被當 production 拒絕;`--confirm` 要等於資料庫名                                  |
| 本機還原資料庫(PowerShell) | `$env:RESET_ALLOW_ENV="dev"; $env:MONGODB_URI="mongodb://127.0.0.1:27017/cookhome-dev"; pnpm --filter @repo/db-migrator reset --mode=data --confirm=cookhome-dev` | `--mode=full` 會整庫重建                                                                                      |

正本:`apps/api/package.json`、`packages/graphql/package.json`、`apps/db-migrator/package.json`、`apps/db-migrator/src/reset/reset-safety.ts`、`docs/env-registry.md`

## Claude Code skill 對照表

「用哪個」欄是在 Claude Code 裡的呼叫名稱。repo 自帶的三個 skill 放在 `.agents/skills/`(版本鎖在 `skills-lock.json`);repo 自製的 skill 放在 `.claude/skills/<名稱>/`。

| 情境                                                 | 用哪個                                                        | 一句提醒                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 自己交件前掃一次 diff 的 bug                         | `/code-review`(內建)                                          | 可指定 PR 號或分支;`--fix` 會直接改工作目錄,文件票不需要                                                     |
| review 一張 PR 是否守規範、是否照票做                | `mattpocock-skills:code-review`                               | Standards / Spec 兩軸並行;給它比較的起點(如 `origin/main`)與票號,引用規則編號回報                            |
| 改完後清理重複、過度複雜的程式                       | `/simplify`(內建)                                             | 只管品質不找 bug;會直接套用修改,跑完重看 diff                                                                |
| 動到登入、權限、上傳、金鑰相關的程式                 | `/security-review`(內建)                                      | 針對目前分支的待合變更                                                                                       |
| 產生 CLAUDE.md                                       | `/init`(內建)                                                 | 本 repo 已有 `CLAUDE.md`,**不要跑**;要改入口文件開獨立文件票                                                 |
| 先寫紅燈測試再實作                                   | `mattpocock-skills:tdd`                                       | 測試只呼叫 spec 指定的接縫;api 打真的 `/graphql`(TEST-07)、admin 走 MSW(TEST-08)                             |
| 難纏的 bug、效能退化                                 | `mattpocock-skills:diagnosing-bugs`                           | 先重現再下手;先查 pitfalls,很多「壞掉」其實是快取或埠                                                        |
| 查官方文件 / API 事實                                | `mattpocock-skills:research`                                  | 它會在 repo 寫一份 Markdown,先講好路徑,不要混進本票 commit                                                   |
| 改 `CONTEXT.md` 詞彙或寫 ADR                         | `mattpocock-skills:domain-modeling`                           | 規則本文由文件票寫;新詞連 `_Avoid_` 一起寫                                                                   |
| 設計模組介面、決定接縫放哪                           | `mattpocock-skills:codebase-design`                           | 結論要寫回模組文件或規範,不留在對話裡                                                                        |
| rebase / merge 衝突                                  | `mattpocock-skills:resolving-merge-conflicts`                 | 衝突對象是還沒 release 的 feat 時改走疊分支,不要 rebase 到 `dev`(pitfalls)                                   |
| 新增後台 CRUD 模組(固定欄位)                         | `/module-scaffold`(repo 自製)                                 | 先選 `plan`(四輪問答 → 規格卡 → 可產 issue)或 `build`(照規格卡與 module-scaffold.md 實作);動態表單模組不適用 |
| 在動手前把計畫問到底                                 | `mattpocock-skills:grilling`                                  | 適合拆票前、裁決「二選一」前                                                                                 |
| 寫給 agent 看的文件(skill、`AGENTS.md`、`CLAUDE.md`) | `mattpocock-skills:writing-for-agents`                        | 每段附正本路徑                                                                                               |
| 只有人能做的步驟(建 Secret、第三方後台)              | `mattpocock-skills:wizard`                                    | 產出互動式腳本讓人跑;agent 不經手任何密碼 / 金鑰                                                             |
| 狀態模型或 UI 走向拿不定                             | `mattpocock-skills:prototype`                                 | 丟棄式原型,不進正式程式碼                                                                                    |
| 照 Figma 稿實作畫面                                  | `figma:figma-design-to-code`                                  | 呼叫 `get_design_context` 前必載;節點 id 給到列層級,規範 `docs/standards/general/figma.md`                   |
| 在 Figma 裡改稿、建元件                              | `figma:figma-use`(寫入前必載)+ `figma:figma-generate-library` | 動到品牌文字 / 色彩同步 `docs/branding.md`                                                                   |
| 把程式裡的頁面畫進 Figma                             | `figma:figma-generate-design`(搭配 `figma:figma-use`)         | 用設計系統的元件與變數,不要寫死數值                                                                          |
| mock 模式截圖、看畫面                                | `claude-in-chrome`                                            | 開自己的分頁、連自己起的埠;截圖前確認看得到本次改動                                                          |
| review 文件的文字                                    | `writing-guidelines`(repo 自帶)                               | 本 repo 另有「文件不寫日期、段落、票號」的通則(`docs/standards/general/structure.md`)                        |
| review UI 的可及性與介面慣例                         | `web-design-guidelines`(repo 自帶)                            | 結論引用 `docs/standards/react/` 的規則編號                                                                  |
| 寫 / review React 元件的效能                         | `vercel-react-best-practices`(repo 自帶)                      | 與 `docs/standards/react/` 衝突時以 repo 規範為準                                                            |

正本:`.agents/skills/`、`skills-lock.json`、`.claude/skills/`;內建與外掛 skill 以 Claude Code 當下列出的清單為準

## 派工模板(給無 session 的 agent)

主流程派工時複製下面這段,把 `<…>` 換掉。重點是讓 agent 只靠 repo + issue 就能做完。

```
你是無本地對話 session 的接手 agent,實作 GitHub issue taiwanhua/cookhome#<票號>(<一句話標題>)。以繁體中文工作與回報。

## 接手順序
1. 讀根目錄 CLAUDE.md → docs/agents/issue-tracker.md(SOP、交件報告格式)→ docs/agents/pitfalls.md → gh issue view <票號> --json title,body,comments(票面的「可改 / 不可改」嚴格遵守)。
2. 讀相關文件:<docs/modules/<key>.md、docs/concepts/<檔>、規範索引 docs/standards/README.md 裡相關的檔>。
3. 指令查 docs/agents/toolbox.md,與 package.json / workflow 對不上時以後者為準。

## 範圍
- 要做:<逐條;裁決寫死,不留二選一>
- 不可改:<檔案清單;CLAUDE.md 明確寫可改或不可改>
- 並行的票:<票號與它負責的檔案,避免撞檔>

## 分支 / 交件
- 你在獨立 worktree;git fetch origin && git checkout -b <feat|docs>/<票號>-<描述> origin/main(有依賴就從依賴票的分支切)。
- 開工:pnpm install;程式票再 build @repo/graphql / ui / domain。看板移 In Progress、assign 自己。
- commit 訊息結尾照 session 提供的 attribution 行。
- PR base dev,內文含 Closes #<票號>,內文先寫成檔再 --body-file;看板票卡移 In Review。
- 不 merge、不動 main / dev / staging;不處理任何密碼 / 金鑰。

## 交件報告
PR 連結、改動檔案清單、測試結果(與基準比較)、截圖或 E2E run 連結、文件與程式不合處、規則回饋、CI 狀態、接手體驗(找不到 / 矛盾 / 用猜的)。
```

正本:[issue-tracker.md](./issue-tracker.md)「實作一張票」與「交件報告格式」

## 批次 release(指路)

- 一批票各自合 `dev`、各自合 `staging`,累積後走一次 `staging → main` 的 release PR + 一次 production 部署;例外只有「產物依賴」才單獨先 release。
- 步驟:逐一合 `staging` → `gh workflow run Deploy --ref staging -f environment=staging` + smoke → release PR 合 `main` → `gh workflow run Deploy --ref main -f environment=production` + smoke → 對齊 `dev` / `staging` → 關票、刪已合併的遠端分支。
- 每一步的前置檢查與指令細節**只在 deployment.md 寫**,這裡不重複。

正本:`docs/deployment.md`(二、分支模型與 CI/CD 流程 → Release 步驟)
