# CookHome 部署架構與操作手冊

> 三環境分支模型(`dev` / `staging` / `main`),www / erp / api 運行於自訂網域;api 與 admin **一律手動觸發部署**。本檔是部署、release 與分支對齊的操作正本。

## 一、架構總覽

```
                        Cloudflare DNS(cookhome.online)
                              │ 灰雲(DNS only)
        ┌─────────────────────┼──────────────────────┐
   www / 裸網域              erp                     api
        │                     │                      │
   ┌────▼─────┐        ┌──────▼───────┐      ┌───────▼──────┐
   │  Vercel  │        │  Cloud Run   │      │  Cloud Run   │
   │  front   │──build─▶│cookhome-admin│      │ cookhome-api │
   │ (Next.js)│  時打api │ (nginx 靜態) │      │  (NestJS)    │
   └──────────┘        └──────────────┘      └───────┬──────┘
                                                     │ MONGODB_URI
                                             ┌───────▼──────┐   來自 Secret Manager
                                             │ MongoDB Atlas │
                                             │ cookhome-dev  │
                                             │ M0, asia-east1│
                                             └──────────────┘

dev / staging 環境:同構的一套(front=dev./staging.、admin=erp-dev./erp-staging.、api=api-dev./api-staging.cookhome.online),由對應分支部署
```

### 環境對照(分支 ↔ 環境)

|                         | dev(開發測試)                         | staging(預發布)                           | production                        |
| ----------------------- | ------------------------------------- | ----------------------------------------- | --------------------------------- |
| 對應分支                | `dev`                                 | `staging`                                 | `main`                            |
| api                     | `api-dev.cookhome.online`(Sandbox 開) | `api-staging.cookhome.online`(Sandbox 關) | `api.cookhome.online`(Sandbox 關) |
| admin                   | `erp-dev.cookhome.online`             | `erp-staging.cookhome.online`             | `erp.cookhome.online`             |
| front                   | `dev.cookhome.online`                 | `staging.cookhome.online`                 | `www.cookhome.online`             |
| 資料庫(同一 M0 cluster) | db `cookhome-dev`                     | db `cookhome-staging`                     | db `cookhome`                     |
| secret                  | `mongodb-uri-dev`                     | `mongodb-uri-staging`                     | `mongodb-uri`                     |
| 審核流程通知信          | 開(`WORKFLOW_MAIL_ENABLED`)           | 關                                        | 關                                |
| 收件白名單              | 不設(不限收件人)                      | 不設                                      | 不設                              |
| api / admin 部署        | 手動觸發 deploy.yml                   | 手動觸發 deploy.yml                       | 手動觸發 deploy.yml               |
| front 部署              | Vercel 隨分支 push 自動建置           | 同左                                      | 同左                              |

上兩列對應 `WORKFLOW_MAIL_ENABLED`、`MAIL_ALLOWLIST`;GraphQL Sandbox(`GRAPHQL_SANDBOX`)只有 dev 開。各環境的值與理由以 `docs/env-registry.md` 為正本。

### 資源清單

| 資源                | 識別                                                                                                                                                                  | 費用            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| GCP 專案            | `cookhome-online`(region 預設 asia-east1)                                                                                                                             | —               |
| Artifact Registry   | `asia-east1-docker.pkg.dev/cookhome-online/cookhome`                                                                                                                  | 儲存費 ~NT$1/月 |
| Cloud Run ×6        | api / admin 各 ×(prod, staging, dev)(全部 min=0 / max=2)                                                                                                              | 無流量 = $0     |
| Secret Manager      | 三環境各一份(`-dev` / `-staging` / 無後綴):`mongodb-uri`、`field-encryption-key`、`root-admin-password`、`jwt-secret`、`resend-api-key`;清單見 `docs/env-registry.md` | ~$0             |
| GCS bucket ×6       | 私有 `cookhome-assets-dev` / `-staging` / `-prod`(uniform access、封鎖公開存取);公開讀 `cookhome-public-dev` / `-staging` / `-prod`(ADR-0010;建立與授權見四、)        | 空 bucket = $0  |
| WIF + 部署身分      | pool `github` / provider `github-oidc` / SA `github-deployer`(只認 taiwanhua/cookhome)                                                                                | $0              |
| Budget              | NT$600/月,50%/90%/100% 郵件警告                                                                                                                                       | $0              |
| MongoDB Atlas       | cluster `cookhome-dev`(M0)                                                                                                                                            | $0              |
| Cloudflare / Vercel | DNS 代管 / front(Hobby)                                                                                                                                               | $0              |
| Vercel 第二專案     | `cookhome-design` → `design.cookhome.online`(Storybook,root `apps/storybook`,output `storybook-static`,只建 main:Ignored Build Step = Only build production)          | $0              |

正本:`deploy/project/cloud.json`(GCP 專案、區域、registry、WIF、各環境的服務名 / API 網址 / Secret 名稱 / seed 帳號)、`deploy/project/github.json`(repo 與看板識別)、`.github/workflows/deploy.yml`(接線)、`deploy/env/<環境>.yaml`、`docs/env-registry.md`(secret 與變數清單)

## 二、分支模型與 CI/CD 流程

### 分支模型

```
main(= production)
  │  feat 分支一律從 main 切出
  ├─▶ feat/xxx ──PR──▶ dev(整合測試環境;可被汙染,可隨時 reset 回 main)
  │        │  測試通過、確定要上線的 feat,「逐一」PR 合併 ──▶ staging(預發布驗證)
  │        ▼
  ◀────── staging ──PR 合回 main = 正式發布
release 後:dev / staging reset 對齊 main;進行中的 feat 分支 rebase 到最新 main
```

- **feat 分支從 `origin/main` 切**。依賴的票還沒進 `main` 時,從前一張票的 feat 分支尾端切(疊票);**不從 `dev` / `staging` 切**,那兩條線上有別批未 release 的東西。
- **feat 對齊只用 rebase**:release 後 rebase 到最新 `origin/main`;疊票的前一張被改寫(review 修改、或已 release 進 `main`)時,用 `git rebase --onto <新基底> <前票原本的尾端>` 把本票的 commit 搬過去。**絕不把 `main` / `dev` / `staging` merge 進 feat**:merge commit 會把別票的內容帶進本票的 PR,之後每一條線的 diff 都對不準。
- **共通修正先單獨 release**:CI、測試工具這類每張票都受益的修正,開自己的分支、單獨走一次 release 進 `main`,不等功能批。已經開工的疊票鏈缺這個修正時,把那個 commit `cherry-pick` 到鏈的底部分支,不 merge `dev`。
- `dev` / `staging` 只由 PR 合入,與 `main` 對齊只用 reset(見下面 Release 步驟第 4 點)。

### CI(ci.yml)

所有 PR 與 push 到 `main` / `dev` / `staging` 自動跑。`paths-ignore` 是 `docs/**`、根目錄 `*.md`、`.claude/**`、`.agents/**`:只改這些路徑時 ci.yml 不跑。`docs.yml` 的 `paths` 只有 `docs/**`、`*.md`、`**/*.md`,改到任何 md 就跑同一個 `format:check`。兩者合起來:

- 只改 `docs/**` 或 md → 只跑 `docs.yml`。
- 只改 `.claude/**`、`.agents/**` 裡的非 md 檔(settings、hook 腳本、skill 附檔)→ **兩支都不跑**,prettier 要自己在本機跑。
- `apps/admin/src/md/**` 的 help.md 會被 build 進 admin,不在忽略清單內 → 兩支都跑。

**job 圖**:拆成多個 job,各佔一台 runner 並行,牆鐘最短優先。

```
project-settings             專案部署設定與讀取器的測試 + 三環境解析(每次都跑,不看受影響清單)
prepare ─┬─ format-codegen   prettier --check(每次都跑)+ codegen 產物與 schema 一致(GQL-05)
         ├─ lint-typecheck   turbo run lint check-types
         ├─ test-api-1 / 2   api 的 jest 以 --shard=1/2、2/2 分兩片,各自一個 MongoDB service container
         ├─ test-admin-1 / 2 admin 的 jest 同樣分兩片(先 turbo build admin 的依賴)
         ├─ test-others      api / admin 以外的 turbo run test(domain / ui / i18n / logger / db-migrator …)
         └─ build            turbo run build(front 受影響時先 build 並啟動 api,給 ISR 預渲染打)
以上全部 ─→ verify           總結:任一 job failure / cancelled 就紅,skipped 算過
```

- **PR 的必要檢查只看 `verify`**;紅的時候看是哪一個 job 紅,job 名稱就是壞的類別。
- **受影響過濾**:`prepare` 用 `turbo ls --affected` 算出「改到的 package + 依賴它們的 package」,轉成 `--filter=<pkg>` 清單交給下游 job。api / admin 不在清單就跳過各自的兩個 shard;清單空就跳過 lint / test / build。改到 `.github/**` 或拿不到 base(首推、force push)時退回全跑。codegen 一致性檢查只在 api 或 `@repo/graphql` 受影響時跑;prettier 不看清單,每次都跑。
- **turbo 快取**:`.turbo/cache` 用 `actions/cache` 在 run 之間保存,每個跑 turbo 的 job 各一把 key(lockfile hash + job 名 + commit),找不到時退回同 lockfile 的最近一份;沒改到的 package 的 lint / typecheck / build 直接 `cache hit`。存回前刪掉 7 天前的項目,快取才不會無限長大;lockfile 一變就從頭累積。api 的 shard 不走 turbo(jest 直接吃 `@repo/domain` 原始碼),沒有快取。
- **本機重現某一片**:api 是 `pnpm --filter @repo/api exec jest --shard=1/2`;admin 是 `pnpm --filter @repo/admin exec node --experimental-vm-modules node_modules/jest/bin/jest.js --shard=1/2`(要先有依賴的 dist)。不能寫成 `pnpm run test -- --shard=1/2`,參數會被 jest 當成路徑 pattern。
- **逾時**:`prepare` 10 分、`verify` 5 分、其餘 20 分,卡死的 jest 不會燒到預設的 6 小時。
- `build` job 起 api 時給假的 `JWT_SECRET`(api 缺它就啟動失敗)。

### CD(deploy.yml)

**只能手動觸發,merge 不會自動部署。**

- UI:Actions → Deploy → Run workflow →「Use workflow from」選分支 + environment 選環境。
- CLI:`gh workflow run Deploy --ref dev -f environment=dev`(staging 同理;production 的 ref 是 `main`)。
- **防呆**:分支與環境不對應直接失敗(dev ← `dev`、staging ← `staging`、production ← `main`)。
- **部署目標讀專案設定**:checkout 之後、雲端認證之前,先以讀取器解析 `deploy/project/*.json` 並核對 repo 身分;不符或缺值就停在這一步(見下方「專案部署設定」)。
- **只部署改到的 app**:讀 Cloud Run 上目前跑的 image tag(= 上次部署的 git SHA)當 base,`turbo ls --affected` 判斷 api / admin / db-migrator 有沒有受影響,沒受影響的步驟整個跳過。turbo 看不到的部署設定另外判斷(`scripts/project-settings/deploy-affected.mjs`):`deploy/project/` 或 `scripts/project-settings/` 有改時 api 與 admin 都重建(API 網址烘在 admin image,只改網址也要重建);`deploy/env/` 或 `deploy.yml` 本身有改時只有 api 視為受影響。判斷結果印在 run 的 notice。要全部重部署加 `-f force=true`;讀不到 tag(第一次部署)或 base 不在歷史裡(force push 過)時自動全部部署。
- **image**:tag = 該分支 HEAD 的 git SHA;admin 每環境各建一顆(`VITE_GRAPHQL_ENDPOINT` = 設定的 `apiUrl` 加 `/graphql`,以 `--build-arg` 烘入)。
- **api 的環境變數**:非機密整包來自 `deploy/env/<環境>.yaml`(`--env-vars-file`),機密來自 Secret Manager(`--set-secrets`);見四、。
- **部署成功後自動跑 `migrate → seed`**(ADR-0002;只在 api 或 db-migrator 受影響時):CI runner 以 `github-deployer` 身分讀該環境的 `mongodb-uri*` 與 `root-admin-password*`,執行 `pnpm --filter @repo/db-migrator migrate` 再 `seed`。seed 摘要「新增 N / 更新 M / 認養 A / 未變 K」印在 Actions log:第一次跑應全為新增,之後每次應為 0 / 0 / 0 / K;任何 seed 宣告以識別鍵(或 `adoptBy`)對到一筆人在畫面建的文件(`isSystem` 不是 `true`)時,那一次會出現認養:文件轉成種子、`_id` 不動,之後重跑就是更新 / 未變。runner 只裝 db-migrator 及其依賴(`MONGOMS_DISABLE_POSTINSTALL=1` 略過測試用 mongod 下載)。
- **front 不走 deploy.yml**:Vercel 在分支 push 時自動建置(`main` → production、`staging` / `dev` → 各自的分支網域);要不靠 commit 重建用 Deploy Hook(見四、「Vercel 補充設定」)。

### 專案部署設定(deploy/project)

deploy / reset 的雲端目標與看板識別不寫在 workflow 裡,正本是兩份 JSON;workflow 只負責讀取、驗證與接線。換成另一個專案時改這兩份檔,不改 workflow。

| 檔案                         | 內容                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy/project/github.json` | `expectedRepository`(owner/repo 的唯一正本)、`projectStatus`(看板是否啟用、project 與 Status 欄位的 ID、十個狀態選項的 ID)                                                        |
| `deploy/project/cloud.json`  | `gcp`(專案、區域、Artifact Registry、WIF provider、部署用 service account)、`environments.dev / staging / production`(api / admin 服務名、API 網址、seed 帳號與信箱、Secret 名稱) |

- **只放非機密設定與 Secret「名稱」**;Secret 的值仍在 Secret Manager / GitHub Secrets。api 的非機密執行期變數仍只在 `deploy/env/<環境>.yaml`,不複製到這裡。
- **讀取器**:`scripts/project-settings/config.mjs` 是唯一的讀取 / 驗證模組,CLI 是 `read-config.mjs`,只用 Node 內建模組(不需先 `pnpm install`)。兩個入口:

  ```bash
  node scripts/project-settings/read-config.mjs --scope cloud --environment <dev|staging|production> --repository <owner/repo>
  node scripts/project-settings/read-config.mjs --scope github --repository <owner/repo>
  ```

  cloud scope 讀兩份 JSON;github scope 只讀 `github.json`,不需要 cloud 設定或部署環境。看板停用時不要求看板 IDs/options,仍須通過 repo 身分檢查。

  成功時 stdout 是一行 JSON(固定的鍵),失敗時 stdout 無輸出、stderr 一行說明、退出碼非零。在 repo 根執行;本機想看某環境會解析出什麼就直接跑。

- **驗證**:`schemaVersion` 不認得、`--repository` 與 `expectedRepository` 不同、環境不是三個之一、缺欄位或多出未知欄位、值的格式不對或含控制字元,一律失敗,不回退任何預設值。workflow 傳入的 repository 取自 GitHub 的 context,所以把 repo 複製成另一個專案後,沒改設定就跑不到原專案的資源:deploy / reset 在雲端認證前停止,看板在任何寫入前停止。
- **傳值方式**:workflow 把讀取器的輸出映射成固定的 step 輸出(`write-github-output.mjs`),再經各 step 的 `env:` 以 `"$VAR"` 傳給命令;設定值不內插進 `run` 的程式文本。
- **改這些檔的後果**:部署時 api 與 admin 都會重建(見上方「只部署改到的 app」)。CI 的 `project-settings` job 每次都跑讀取器測試與三環境的解析,不看受影響清單。
- **看板(`project-status.yml`)只讀預設分支上的設定與腳本**:PR 事件也不讀 PR 分支的內容,所以看板設定或腳本的改動要 release 到 `main` 之後才生效。設定無效或 fork PR 拿不到 token 時明確失敗、不移卡,由主流程依 `docs/agents/issue-tracker.md`「手動移卡」處理。`projectStatus.enabled` 設為 `false` 就完全不呼叫看板 API,也不需要 token。
- **設定檔寫好不等於外部資源存在**:WIF、IAM、網域、Secret、看板都要另外建立並驗證(`docs/project-initialization.md`)。

正本:`deploy/project/cloud.json`、`deploy/project/github.json`、`scripts/project-settings/`(讀取器與測試)

### 其他 workflow

| workflow                                 | 觸發                                             | 做什麼                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reset DB**(`reset-db.yml`)             | 只能手動;只有 dev / staging                      | 資料庫還原(`data` / `full`);操作見三、「資料庫還原」,規則正本是 ADR-0002「還原(reset)」                                                            |
| **E2E**(`e2e.yml`)                       | 只能手動,不在 ci.yml 內                          | 權限劇本 E2E(`gh workflow run e2e.yml --ref <分支>`,可加 `-f grep="劇本 7"`);資料庫是拋棄式 service container,不碰任何環境與 Secret;時機見 TEST-05 |
| **Docs**(`docs.yml`)                     | PR 與三分支 push,只在改到 `docs/**` 或任何 md 時 | `pnpm run format:check`                                                                                                                            |
| **Project Status**(`project-status.yml`) | issue / PR 事件                                  | 自動移看板卡,規則見 `docs/agents/issue-tracker.md`「看板」                                                                                         |

### Release 步驟

**release 一批一次**:同一批票各自 PR 合進 `dev`、各自 PR 合進 `staging`,累積成一批之後才走一次 release(一個 `staging → main` 的 PR + 一次 production 部署)。`dev` 的部署也等該批最後一張合完才觸發,不要一張一部署。例外只有**產物依賴**:後面的票要拿前面的票已上線的產物才做得下去時,前面那張單獨先 release。

每次都照這五步(票的看板狀態見 `docs/agents/issue-tracker.md`):

1. dev 的 CI 綠 → 要上線的 feat 分支**逐一** PR 合進 `staging`(PR 內文帶 `Refs #<票號>`,看板自動化才找得到票)。這批就是 `dev` 上的全部時,合完 `git diff --stat origin/dev origin/staging` 應為空。
2. `gh workflow run Deploy --ref staging -f environment=staging` → 對 `api-staging` 打一個 smoke(例:登入 mutation 帶錯帳密,回 `INVALID_CREDENTIALS`)。
3. PR `staging → main`、合併 → `gh workflow run Deploy --ref main -f environment=production` → 同樣 smoke。
4. **release PR 一合進 `main`,立刻把 `dev` 與 `staging` reset 到 `main`(force push)**。本點是全 repo 的正本:其他文件提到分支對齊時一律指回這裡,CLAUDE.md 只留一行摘要,不一致時以本點為準。由主流程做;它也是 `dev` 被汙染時的救援手段。**對齊只有 reset 這一種做法**:不把 `main` merge 回 `dev` / `staging`,也不用空合併,那只會讓兩條線各自長出 merge commit、歷史繼續分岔。先做前置檢查再推:

   ```
   git fetch origin
   git diff --stat origin/main origin/dev
   git diff --stat origin/main origin/staging
   gh pr list --base dev --state open
   git push --force origin origin/main:refs/heads/dev
   git push --force origin origin/main:refs/heads/staging
   ```

   兩個 `git diff --stat` 為**空**,代表該批已全部進 `main`、reset 不會丟東西。`dev` 的 diff 不空時,對照 `gh pr list` 與 diff 內容,確認多出來的只是「已合進 `dev` 但不在這批 release 裡」的 feat:是的話**照樣 reset**,reset 後替那些 feat 重新開 PR 合進 `dev`(原 PR 已是 merged,不能再 merge);有說不出來源的差異就先停下來查,不要推。reset 之後,從 `main` 切出來的分支對 `dev` / `staging` 都只剩一個 merge base。它不需要切分支,也不動本地工作目錄。

5. 關票(`gh issue close <n> --comment "<release PR>"`)→ 自動化移到 Released;刪已合併的遠端分支;進行中的 feat 分支 rebase 到最新 `main`。

### 交叉 merge base

feat 一律從 `main` 切,而 `dev` / `staging` 各自往前走一條線;同一批票在兩條線上各合一次之後,新的 PR 就可能有兩個 merge base(`dev` 與 `staging` 都會發生)。

- **徵兆**:GitHub 顯示 `CONFLICTING`,但本地 `git merge-tree --write-tree origin/<base> <feat>` 乾淨。
- **後果**:GitHub 不建 merge ref ⇒ 這張 PR 一個 Actions run 都不會跑,CI 沒結果、`project-status.yml` 也不會移卡(看板停在原格不是自動化壞了)。
- **處理**:主流程照 Release 步驟第 4 點把該 base reset 到 `main`(reset 後 base 與 `main` 是同一個 commit,交叉 merge base 直接消失;base 上有未 release 的 feat 就 reset 後再合回去),**接著把 PR close → reopen** 才會重跑 CI(base 更新本身不觸發 `pull_request` 事件)。實作者不自己改 `dev` / `staging`。

### 建置產物的規則

- **Docker build context 排除 `.md`,但 admin 的 help.md 是程式資產**:根目錄 `.dockerignore` 有 `**/*.md`(文件不進 image),而 `apps/admin/src/md/module-help/**/*.help.md` 是 Vite 在 build 時以 `import.meta.glob` 內嵌進 bundle 的程式資產。被排除時本機 `pnpm build` 照樣正常,CI 建出來的 image 卻讓每頁的「?」全部 disabled,而且沒有任何一步會失敗。例外寫在 `.dockerignore`(`!apps/admin/src/md/**/*.md`,必須排在 `**/*.md` 之後才生效);防回歸檢查在 `apps/admin/Dockerfile` 的 builder stage:build 之後 `RUN pnpm --filter @repo/admin check:help-bundle`(腳本 `apps/admin/scripts/check-help-bundle.mjs`,比對每份說明的內容是否出現在 `dist/assets/*.js`;掃不到說明檔也算失敗)。**再有這類「跟著 build 烘進產物的非程式檔」**(i18n 字典、範本、憑證…),一律同時做兩件事:在 `.dockerignore` 補例外 + 在 Dockerfile 加一條驗產物的檢查。
- **admin 的靜態檔快取:`index.html` = `no-cache`、`/assets/` = `immutable` 一年**(`apps/admin/nginx.conf`)。`index.html` 是唯一指向「這次部署的 bundle 檔名」的入口,一旦被快取,部署後重新整理仍會載入上一版 HTML 與它指向的 `assets/index-<hash>.js`;`/assets/` 底下的檔名帶 content hash,內容一變檔名就變,可以永久快取。`no-cache` 是「每次都先向伺服器驗證」(ETag 命中回 304,只花一個 round trip),所以**部署後使用者正常重新整理就拿到新版**,不需要 Ctrl+F5。沒有這個標頭時瀏覽器會依 `Last-Modified` 自行推算效期,就會出現「部署成功但畫面沒變」。nginx 的 `add_header` 不會繼承到自己也有 `add_header` 的子 block,所以 `location /`(SPA fallback)與 `location = /index.html`(`try_files` 的內部轉址會重新比對 location)各寫一份。改了 `nginx.conf` 之後,驗收方式是 `curl -I https://erp-<環境>.cookhome.online/` 看 `Cache-Control`。
- **改了 `.dockerignore` / Dockerfile 之後要用 `-f force=true` 部署**:這兩個檔不屬於任何 package,`turbo ls --affected` 看不到,不加 force 會整個 build 步驟被跳過。
- **新增「會被烘進前端產物」的環境變數時,同步登記進該 package `turbo.json` 的 `tasks.build.env`**(規則正本 STRUCT-08):`VITE_*` / `NEXT_PUBLIC_*` 是 build 的輸入,沒登記就不在 build 的快取鍵裡,換一個值重 build 會直接 `cache hit`,部署出去的 image 裡烘的還是前一個值,而且沒有任何一步會失敗。admin 每環境各建一顆 image,正是最容易吃到這個坑的形狀。三處一起動:`turbo.json` 的 `env`、`docs/env-registry.md`、該環境的 build 參數(deploy.yml 的 `--build-arg` 或 Vercel dashboard)。
- **Vercel 的 `Deployment rate limited` 是帳號層級的額度**:front 在免費方案上短時間內推太多次就會碰到,等額度回復再推即可,不要為此改 workflow 或重試設定;它不影響 api / admin 的 Cloud Run 部署。

### 認證與回滾

- **認證**:Workload Identity Federation,OIDC 短期憑證換 `github-deployer` 身分,repo 裡零 GCP 金鑰,provider 限定本 repo。
- **回滾**:`gcloud run services update-traffic cookhome-api --to-revisions=<先前的 revision>=100`,或從先前的 commit 觸發部署。

正本:`.github/workflows/ci.yml`、`.github/workflows/deploy.yml`、`.github/workflows/reset-db.yml`、`.github/workflows/e2e.yml`、`.github/workflows/docs.yml`、`.github/workflows/project-status.yml`、`.dockerignore`、`apps/admin/Dockerfile`、`apps/admin/scripts/check-help-bundle.mjs`、`apps/admin/nginx.conf`

## 三、手動操作(維運速查)

### 本地容器

```bash
docker compose up -d                  # 日常開發:只起 MongoDB
docker compose --profile full up -d   # 部署前驗證:mongo + api + admin 整套容器
```

正本:`docker-compose.yml`

### 手動部署(CD 掛掉時的備援;平常交給 deploy.yml)

**照 `.github/workflows/deploy.yml` 的「deploy api」步驟打,不要憑記憶**:`gcloud run deploy` 必須同時帶 `--env-vars-file=deploy/env/<環境>.yaml`(非機密變數,整包取代)與完整的 `--set-secrets=MONGODB_URI=…,FIELD_ENCRYPTION_KEY=…,JWT_SECRET=…,RESEND_API_KEY=…`(服務名、registry 與 secret 名稱以 `node scripts/project-settings/read-config.mjs --scope cloud --environment <環境> --repository taiwanhua/cookhome` 的輸出為準)。`--set-secrets` 是整組取代,少列一個就等於把那個 secret 從服務拿掉。build / push 的部分:

```bash
SHA=$(git rev-parse --short HEAD)
REG=asia-east1-docker.pkg.dev/cookhome-online/cookhome
docker build -f apps/api/Dockerfile -t $REG/api:$SHA . && docker push $REG/api:$SHA
# 接著複製 deploy.yml「deploy api」步驟裡的 gcloud run deploy 指令,把 $VAR 換成讀取器輸出的該環境值
```

正本:`.github/workflows/deploy.yml`(deploy api / deploy admin 步驟)、`deploy/project/cloud.json`、`apps/api/Dockerfile`、`apps/admin/Dockerfile`

### 資料庫還原(reset;僅 dev / staging)

驗收要反覆重建租戶與使用者時,用手動 workflow 把該環境的資料庫還原。**規則正本是 ADR-0002「還原(reset)」**(兩種模式的定義、`data` 的刪 / 留判準、三道安全閥),這裡只寫怎麼操作。

- UI:Actions → **Reset DB** → Run workflow → 選 `environment`(dev / staging)與 `mode`
- CLI:`gh workflow run "Reset DB" --ref dev -f environment=dev -f mode=data`

| mode   | 做什麼                                                                              | 什麼時候用                                            |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `data` | 只刪人建的資料(租戶、使用者、租戶角色、資料範圍規則、示範與業務資料…),再跑一次 seed | 重測開通租戶那條線;**模組頁調過的開關 / 圖示會留著**  |
| `full` | `dropDatabase` → `migrate` → `seed`                                                 | 要一個全新安裝的環境(連調過的開關 / 圖示也回到宣告值) |

限制:

- **沒有 production 選項**:workflow 的 choice 只有 dev / staging,第一個步驟再擋一次 dev / staging 以外的值(專案設定檔三個環境都有,不能靠設定缺值來擋),指令端另有三道安全閥(`--confirm` 要等於資料庫名、目標環境由資料庫名推得且 production 永遠拒絕、`RESET_ALLOW_ENV` 要含目標環境),兩層都擋。
- **只碰資料庫,不動 Cloud Run**:服務不會重新部署,`full` 之後 api 也不必重啟(它不快取這些資料)。
- **不還原 GCS 上的檔案**(商標、封面…):物件留在 bucket 裡變成孤兒,不影響功能。
- **root 帳號的密碼**:`data` 保留原帳號整筆(含密碼雜湊,改過的密碼仍有效);`full` 會重新建立帳號,密碼回到 `root-admin-password*` secret 的當前值。
- job 掛在 GitHub `environment: <env>` 底下,要加人工審核就在該 environment 設 required reviewers。
- 本機跑同一支指令(本地資料庫名要以 `-dev` 結尾,否則會被當成 production 拒絕):

  ```bash
  RESET_ALLOW_ENV=dev MONGODB_URI=mongodb://127.0.0.1:27017/cookhome-dev \
    pnpm --filter @repo/db-migrator reset --mode=data --confirm=cookhome-dev
  ```

正本:`.github/workflows/reset-db.yml`、`deploy/project/cloud.json`(Secret 名稱與 seed 帳號,與 deploy.yml 同一份)、`apps/db-migrator/src/reset/`(三道安全閥在 `reset-safety.ts`)、ADR-0002「還原(reset)」

### 觀測與維運

```bash
gcloud run services list                                   # 服務清單與 URL
gcloud run revisions list --service=cookhome-api           # 歷史版本(回滾用)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="cookhome-api"' --limit=30
gcloud secrets versions list mongodb-uri                   # secret 版本
gcloud beta run domain-mappings describe --domain=api.cookhome.online --region=asia-east1  # 網域/憑證狀態
```

- Cloud Run UI:console.cloud.google.com → Cloud Run。編輯表單顯示的 max instances「20」是表單的建議值,實際生效值看 Revisions 分頁(2)。
- Atlas UI:cloud.mongodb.com → Network Access(0.0.0.0/0)/ Database Access / Browse Collections
- Cloudflare:`api`、`erp`、`api-dev`、`erp-dev`、`api-staging`、`erp-staging` CNAME → `ghs.googlehosted.com`(灰雲,對應 6 筆 Cloud Run domain mapping);`www`、`@`、`dev`、`staging`、`design` CNAME → Vercel(灰雲);TXT 為 Google 網域驗證,勿刪

## 四、環境變數管理

環境變數只有三個家,依「性質」決定放哪。要改某個變數,先問它是哪一種,就知道去哪改:

| 性質                                  | 放哪(真實來源)                                                                                                                      | 進版控?                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **非機密、雲端用**(網址、開關、效期…) | **`deploy/env/<環境>.yaml`**(dev / staging / production 各一檔),deploy.yml 以 `--env-vars-file` 整包餵給 Cloud Run                  | ✅(走 PR,可審)                |
| **機密**(連線字串、金鑰、API key)     | Secret Manager,名稱 `<名稱>-dev` / `-staging` / `<名稱>`(名稱登記在 `deploy/project/cloud.json`);deploy.yml 以 `--set-secrets` 引用 | ❌ 值永不進版控               |
| **本地開發**                          | 各 app 的 `.env`(範本 `.env.example`)                                                                                               | `.env` ❌ / `.env.example` ✅ |

各服務的來源:

| 層               | 真實來源                                                                                                                                                                                          | 進版控?                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Cloud Run(api)   | 上表前兩列(`deploy/env/<環境>.yaml` + Secret Manager)。YAML 是該環境**全部明文變數**的唯一來源:`--env-vars-file` 整包取代,檔內沒寫的變數部署後即不存在;`--set-secrets` 掛入的 secret 變數不受影響 | ✅ / ❌                     |
| Cloud Run(admin) | `deploy.yml` 的 `--build-arg`(Vite 值烘進 image;API 網址取自 `deploy/project/cloud.json` 的 `apiUrl`)                                                                                             | ✅                          |
| Vercel(front)    | Vercel dashboard(Settings → Environment Variables)                                                                                                                                                | ❌(平台保存;清單記載於下表) |

Vercel 現有變數(唯一 key:`NEXT_PUBLIC_GRAPHQL_ENDPOINT`,全部 Config 型):

| 範圍                                | 值                                            |
| ----------------------------------- | --------------------------------------------- |
| Production                          | `https://api.cookhome.online/graphql`         |
| Preview → branch `staging`          | `https://api-staging.cookhome.online/graphql` |
| Preview → branch `dev`              | `https://api-dev.cookhome.online/graphql`     |
| Preview(其他分支 = feat 的 preview) | `https://api-dev.cookhome.online/graphql`     |

**新增一個環境變數**(依用到它的地方,最多三處):

1. 本地:加進該 app 的 `.env` + 同步 `.env.example`(讓別人 / AI 知道有這個變數)。
2. api / admin 雲端:機密 → `gcloud secrets create`(步驟見下節)+ deploy.yml `--set-secrets`;非機密 → 加進 `deploy/env/<環境>.yaml`(三個環境各給值,走 PR)。程式端一律給**內建預設值**,變數不設也能跑。
3. front 雲端:Vercel dashboard 加(Type 選 **Config**,除非真是機密;`NEXT_PUBLIC_` 前綴 = 會進瀏覽器,機密絕不可加此前綴)。

**機密判斷準則**:「這個值出現在瀏覽器 / 版控裡會不會出事?」會 → Secret Manager(Cloud Run)或 Secret 型(Vercel);不會 → 明文設定即可。

變數清單(用途 / 是否機密 / 放哪 / 狀態)的正本是 `docs/env-registry.md`,新增或異動變數時必須更新它。

正本:`deploy/env/<環境>.yaml`、`deploy/project/cloud.json`(Secret 名稱、API 網址)、`.github/workflows/deploy.yml`(`--env-vars-file` / `--set-secrets` / `--build-arg`)、`docs/env-registry.md`

### 新增一個 Secret Manager 機密的標準步驟

指令都在 Claude Code 的 `!` 提示或 Git Bash 執行(**是 bash,不是 PowerShell**;`$env:TEMP` 這種 PowerShell 語法在這裡不會動)。

**1. 命名慣例**:每個環境各一份、值互不相同:`<名稱>-dev`、`<名稱>-staging`、`<名稱>`(production 無後綴)。例:`mongodb-uri-dev`、`field-encryption-key`。

**2. 建立**,依值的來源選一種:

- **程式產生的金鑰**(沒有人需要看到它):node 把值寫進 Windows 暫存資料夾 → gcloud 從檔案讀 → 刪檔。值不會印在螢幕、不進 shell 歷史。

  ```
  node -e "require('fs').writeFileSync(process.env.TEMP+'/k.txt', require('crypto').randomBytes(32).toString('base64'))" && gcloud secrets create <名稱>-dev --data-file="$TEMP/k.txt" --replication-policy=automatic --project=cookhome-online; rm -f "$TEMP/k.txt"
  ```

  路徑要用 `$TEMP`(node 是 Windows 程式,`/tmp` 會被當成不存在的 `C:\tmp`)。

- **人打的密碼、連線字串**:走 GCP Console(Secret Manager → Create secret → 貼值 → Create),或**另開自己的終端機**跑 `printf '%s' '<值>' | gcloud secrets create <名稱>-dev --data-file=- --replication-policy=automatic --project=cookhome-online`。**不要在 AI 對話裡貼密碼**(對話紀錄會留存,等於外洩)。

**3. 授權讀取者**(漏這步,部署或 CI 會報讀不到 secret):

| 誰會讀這個 secret                              | 授權對象(`--member`)                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud Run 執行中的 api(`--set-secrets` 掛進去) | Cloud Run 執行身分;查法:`gcloud run services describe cookhome-api-dev --region=asia-east1 --format="value(spec.template.spec.serviceAccountName)"`,目前為預設 `728045896207-compute@developer.gserviceaccount.com` |
| CI 步驟(如 deploy.yml 跑 migrate / seed)       | 部署身分 `github-deployer@cookhome-online.iam.gserviceaccount.com`                                                                                                                                                  |

```
gcloud secrets add-iam-policy-binding <名稱>-dev --member="serviceAccount:<上表身分>" --role="roles/secretmanager.secretAccessor" --project=cookhome-online
```

三個環境各跑一次。

**4. 接線**(走 PR):secret 名稱登記在 `deploy/project/cloud.json` 各環境的 `secrets`,讀取器(`scripts/project-settings/config.mjs`)的欄位與固定輸出鍵同步加一個,並補測試。Cloud Run 用的 → deploy.yml「deploy api」步驟的 `env:` 接該輸出、`--set-secrets` 追加 `<環境變數名>=$<變數>:latest`;CI 步驟用的 → 該步驟 `gcloud secrets versions access latest --secret="$<變數>"`。

**5. 登記**:更新 `docs/env-registry.md`(狀態、secret 名稱、讀取身分)與本檔「資源清單」。

**陷阱**:

- 貼值時尾端多一個換行或空白,會變成值的一部分(密碼登入失敗最常見的原因)。
- 欄位加密金鑰(`field-encryption-key*`)**建立後不可輪替或刪除**,換鑰匙 = 既有密文全部解不開。
- seed 只在帳號**不存在**時建立、存在就不動:帳號建立後再改 `root-admin-password*` 的值,**不會**改到資料庫裡的密碼;要改密碼在系統內改。

小工具:裝了 vercel CLI 並登入後,`vercel env pull` 可把 Vercel 的變數拉成本地 `.env.local`(本地 front 想直連雲端 dev api 時方便)。

正本:`deploy/project/cloud.json`(secret 名稱)、`.github/workflows/deploy.yml`(`--set-secrets` 與 migrate → seed 步驟讀 secret)、`docs/env-registry.md`

### GCS bucket 與 IAM(重建或加新環境時照此)

檔案儲存走 GCS 簽名網址直傳(ADR-0010):瀏覽器拿 api 簽的 V4 網址直接上傳 / 讀取,檔案不經過 api。**簽名不下載金鑰檔**:Cloud Run 執行身分沒有私鑰,`@google-cloud/storage` 會改呼叫 IAM Credentials 的 `signBlob`,所以那個 SA 必須能簽自己的名(第 3 步)。指令在 Git Bash 執行,`<env>` 取 `dev` / `staging` / `prod`。

**1. 建 bucket**(私有;region 與 Cloud Run 同 asia-east1,跨區會付流量費):

```
gcloud storage buckets create gs://cookhome-assets-<env> --project=cookhome-online --location=asia-east1 --uniform-bucket-level-access --public-access-prevention
```

公開 bucket 同一條指令,名稱改 `gs://cookhome-public-<env>`、**拿掉 `--public-access-prevention`**,再加一行開公開讀:

```
gcloud storage buckets add-iam-policy-binding gs://cookhome-public-<env> --member=allUsers --role=roles/storage.objectViewer
```

**2. 授權 Cloud Run 執行身分讀寫物件**(六個 bucket 各跑一次;身分同 Secret Manager 那張表的查法):

```
gcloud storage buckets add-iam-policy-binding gs://cookhome-assets-<env> --member=serviceAccount:728045896207-compute@developer.gserviceaccount.com --role=roles/storage.objectAdmin
```

**3. 讓執行身分能簽自己的名**(V4 簽名走 signBlob;漏這步 api 會在簽名時報 `iam.serviceAccounts.signBlob` 權限不足):

```
gcloud services enable iamcredentials.googleapis.com --project=cookhome-online
gcloud iam service-accounts add-iam-policy-binding 728045896207-compute@developer.gserviceaccount.com --member=serviceAccount:728045896207-compute@developer.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator --project=cookhome-online
```

**4. 設 CORS**(瀏覽器對簽名網址 `PUT` 直傳受 CORS 限制;沒設時商標、封面上傳會在瀏覽器端失敗):

```bash
# cors.json:origin = erp-dev / erp-staging / erp 三個網域 + http://localhost:3001,method GET / PUT / HEAD,responseHeader Content-Type,maxAge 3600
gcloud storage buckets update gs://cookhome-assets-dev --cors-file=cors.json   # 六個 bucket 各一次
gcloud storage buckets describe gs://cookhome-assets-dev --format="value(cors_config)"
```

新增前端網域(例如自訂網域)時要把 origin 加進去再更新。

**5. 接線**(走 PR):`deploy/env/<環境>.yaml` 的 `GCS_BUCKET_PRIVATE` / `GCS_BUCKET_PUBLIC` 填 bucket 名稱(非機密,不進 Secret Manager);登記於 `docs/env-registry.md`。`GCS_BUCKET_PRIVATE` 沒設時 api 照常啟動,但改用記錄用 adapter(簽出來的網址是假的、檔案不會真的上傳),本地開發與測試即此模式。

**驗證**(需要 Cloud Run 的執行身分,本地做不到):部署後以 GraphQL 要一張上傳票 → 用該網址 PUT 一張圖 → 讀回簽名網址能開。

正本:`apps/api/src/storage/`、`deploy/env/<環境>.yaml`、ADR-0010

### Vercel 補充設定

- **分支網域**:`dev.cookhome.online` → branch `dev`、`staging.cookhome.online` → branch `staging`(Settings → Domains,各綁 Git Branch);api / admin 的 dev / staging 子網域走 Cloud Run domain mapping(`api-dev`、`erp-dev`、`api-staging`、`erp-staging`,Cloudflare 灰雲 CNAME → ghs.googlehosted.com)。
- **Deploy Hooks**(Settings → Git 最下方):`dev-front`、`staging-front`。對 hook URL 發 POST 即可**不靠 commit** 重 build 該分支的 front(Vercel 會跳過無檔案變更的 commit,分支剛建立或只想重烘時用這個)。
- **Deployment Protection 關閉**(Vercel Authentication):dev / staging 的 api / admin 在 Cloud Run 本就公開,單獨保護 front preview 沒有實益;要全面保護測試環境時再一起設計。
- 三環境 admin image 烘入的 api 端點皆為自訂子網域(`api` / `api-dev` / `api-staging.cookhome.online`)。

## 五、安全與費用備忘

- 連線字串(含密碼)只存在 Atlas、Secret Manager、擁有者本機,從未進版控或指令輸出。
- GraphQL Sandbox、收件白名單、審核流程通知信的各環境設定見一、「環境對照」。
- 費用防線:全服務 `max-instances=2`(費用天花板)+ Budget NT$600 三段警告。
- 連線池:三環境的 MongoDB URI 均含 `maxPoolSize=10`,理論上限 6 實例 × 10 = 60 連線,遠低於 M0 的 500(三環境共用同一 cluster 額度;拆 cluster 見 `docs/tmp/dis.md` 搜「Atlas」)。
- 評估過、目前不做:固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲 WAF(需 Global LB ~US$18/月)、production api `min-instances=1`(用冷啟動換省錢,有流量後再開)。
- 待議:api schema 演進規範(向後相容 + 破壞性變更配遷移腳本),預定寫進 `docs/standards/api/`。
