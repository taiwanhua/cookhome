# CookHome 部署架構與操作手冊

> 最後更新:2026-09-22(#309:release 一批一次、release 後 `dev` / `staging` 以 `reset --hard` 對齊 `main`,取代原本把 `main` 空合併回去的做法;2026-09-21 #270:admin nginx 的 `index.html` 回 `Cache-Control: no-cache`、`/assets/` 維持 immutable 長快取;#259:`.dockerignore` 對 admin 模組說明開例外 + Dockerfile 加打包資產檢查;2026-09-19 #69:api 非機密環境變數改由 `deploy/env/<環境>.yaml` 提供、Secret Manager 加 `jwt-secret*`、`resend-api-key*`)。**學習路線 ①~⑤ 全部完成**:CI + CD 上線,www / erp / api 運行於自訂網域;三環境分支模型(`dev` / `staging` / `main`),部署一律手動觸發。

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

dev / staging 環境:同構的一套(front=dev./staging.、admin=erp-dev./erp-staging.、api=api-dev./api-staging.cookhome.online),由對應分支手動部署

```

### 環境對照(分支 ↔ 環境)

|                         | dev(開發測試)                         | staging(預發布)                           | production                        |
| ----------------------- | ------------------------------------- | ----------------------------------------- | --------------------------------- |
| 對應分支                | `dev`                                 | `staging`                                 | `main`                            |
| api                     | `api-dev.cookhome.online`(Sandbox 開) | `api-staging.cookhome.online`(Sandbox 關) | `api.cookhome.online`(Sandbox 關) |
| admin                   | `erp-dev.cookhome.online`             | `erp-staging.cookhome.online`             | `erp.cookhome.online`             |
| front                   | `dev.cookhome.online`                 | `staging.cookhome.online`                 | `www.cookhome.online`(merge 自動) |
| 資料庫(同一 M0 cluster) | db `cookhome-dev`                     | db `cookhome-staging`                     | db `cookhome`                     |
| secret                  | `mongodb-uri-dev`                     | `mongodb-uri-staging`                     | `mongodb-uri`                     |
| 部署                    | 手動觸發 deploy.yml                   | 手動觸發 deploy.yml                       | 手動觸發 deploy.yml               |

### 資源清單

| 資源                | 識別                                                                                                                                                                  | 費用            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| GCP 專案            | `cookhome-online`(region 預設 asia-east1)                                                                                                                             | —               |
| Artifact Registry   | `asia-east1-docker.pkg.dev/cookhome-online/cookhome`                                                                                                                  | 儲存費 ~NT$1/月 |
| Cloud Run ×6        | api / admin 各 ×(prod, staging, dev)(全部 min=0 / max=2)                                                                                                              | 無流量 = $0     |
| Secret Manager      | 三環境各一份(`-dev` / `-staging` / 無後綴):`mongodb-uri`、`field-encryption-key`、`root-admin-password`、`jwt-secret`、`resend-api-key`;清單見 `docs/env-registry.md` | ~$0             |
| GCS bucket ×6       | 私有 `cookhome-assets-dev` / `-staging` / `-prod`(uniform access、封鎖公開存取);公開讀 `cookhome-public-dev` / `-staging` / `-prod`(ADR-0010;建立與授權見下節)        | 空 bucket = $0  |
| WIF + 部署身分      | pool `github` / provider `github-oidc` / SA `github-deployer`(只認 taiwanhua/cookhome)                                                                                | $0              |
| Budget              | NT$600/月,50%/90%/100% 郵件警告                                                                                                                                       | $0              |
| MongoDB Atlas       | cluster `cookhome-dev`(M0)                                                                                                                                            | $0              |
| Cloudflare / Vercel | DNS 代管 / front(Hobby)                                                                                                                                               | $0              |
| Vercel 第二專案     | `cookhome-design` → `design.cookhome.online`(Storybook,root `apps/storybook`,output `storybook-static`,只建 main:Ignored Build Step = Only build production)          | $0              |

## 二、分支模型與 CI/CD 流程

```
main(= production)
  │  feat 分支一律從 main 切出
  ├─▶ feat/xxx ──PR──▶ dev(整合測試環境;可被汙染,可隨時 reset 回 main)
  │        │  測試通過、確定要上線的 feat,「逐一」PR 合併 ──▶ staging(預發布驗證)
  │        ▼
  ◀────── staging ──PR 合回 main = 正式發布
release 後:進行中的 feat 分支 rebase 到最新 main
```

- **CI(ci.yml)**:所有 PR + push 到 `main`/`dev`/`staging` 自動驗證(lint/typecheck/test/build)
- **CD(deploy.yml)**:**只能手動觸發,merge 不會自動部署**
  - UI:Actions → Deploy → Run workflow →「Use workflow from」選分支 + environment 選環境
  - CLI:`gh workflow run Deploy --ref dev -f environment=dev`(staging 同理;production 的 ref 是 `main`)
  - 防呆:分支與環境不對應會直接失敗(dev→`dev`、staging→`staging`、production→`main`)
  - **只部署改到的 app**(2026-09-19):workflow 讀 Cloud Run 上目前跑的 image tag(= 上次部署的 git SHA)當 base,`turbo ls --affected` 判斷 api / admin / db-migrator 有沒有受影響,沒受影響的步驟整個跳過(migrate → seed 也只在 api 或 db-migrator 受影響時跑);判斷結果印在 run 的 notice。要全部重部署加 `-f force=true`(第一次部署或 Cloud Run 讀不到 tag 時會自動全部)
  - image tag = 該分支 HEAD 的 git SHA;admin 每環境各建一顆(VITE 端點烘入)
  - **部署成功後自動跑 `migrate → seed`**(ADR-0002):CI runner 以 `github-deployer` 身分讀該環境的 `mongodb-uri*` 與 `root-admin-password*`,執行 `pnpm --filter @repo/db-migrator migrate` 再 `seed`;seed 摘要(新增 N / 更新 M / 未變 K)印在 Actions log — 第一次跑應全為新增,之後每次應為 0 / 0 / K。runner 只裝 db-migrator 及其依賴(`MONGOMS_DISABLE_POSTINSTALL=1` 略過測試用 mongod 下載)
- **release 一批一次**:同一批票各自 PR 合進 `dev`、各自 PR 合進 `staging`,**累積成一批之後才走一次 release**(一個 `staging → main` 的 PR + 一次 production 部署);`dev` 的部署也等該批最後一張合完才觸發,不要一張一部署。release 完成後照下面第 4 點把 `dev` / `staging` reset 對齊 `main`。例外只有**產物依賴**(後面的票要拿前面的票已上線的產物才做得下去),這種才單獨先 release 一次
- **Release 步驟(每次一樣;票的看板狀態見 `docs/agents/issue-tracker.md`)**:
  1. dev 的 CI 綠 → 要上線的 feat 分支**逐一** PR 合進 `staging`(PR 內文帶 `Refs #票號`,自動化才移卡);合完 `git diff --stat origin/dev origin/staging` 應為空
  2. `gh workflow run Deploy --ref staging -f environment=staging` → 對 `api-staging` 打一個 smoke(如登入 mutation 錯帳密回 `INVALID_CREDENTIALS`)
  3. PR `staging → main`、合併 → `gh workflow run Deploy --ref main -f environment=production` → 同樣 smoke
  4. **release PR 一合進 `main`,立刻把 `dev` 與 `staging` reset 到 `main`**(下一點的預防措施,由主流程做;即 CLAUDE.md「`dev` 汙染時整支重置」,現在是 release 後的常規動作)。**不要把 `main` 合併(或空合併)回 `dev` / `staging`** —— 那只會讓兩條線各自長出 merge commit、歷史繼續分岔。先做前置檢查再推:

     ```
     git fetch origin
     git diff --stat origin/main origin/dev
     git diff --stat origin/main origin/staging
     gh pr list --base dev --state open
     git push --force origin origin/main:refs/heads/dev
     git push --force origin origin/main:refs/heads/staging
     ```

     兩個 `git diff --stat` 都要是**空的**,代表該批已全部進 `main`、reset 不會丟掉東西;`gh pr list` 是確認沒有「已合進 `dev` 但不在這批 release 裡」的 feat。若真的有未 release 的 feat 在上面,**照樣 reset**,再逐一把那些 feat 合回去(`gh pr merge`,或本地 merge 後推)。reset 之後,從 `main` 切出來的分支對 `dev` / `staging` 都只剩一個 merge base

  5. 關票(`gh issue close <n> --comment "<release PR>"`)→ 自動化移到 Released;刪已合併的遠端分支
  6. **交叉 merge base(dev 與 staging 都會發生)**:feat 一律從 `main` 切,而 `dev` / `staging` 各自往前走一條線,同一批票在兩條線上各合一次之後,PR 就有兩個 merge base。徵兆是 **GitHub 顯示 CONFLICTING,但本地 `git merge-tree --write-tree origin/<base> <feat>` 乾淨**。後果不只是紅字:**GitHub 不建 merge ref ⇒ 這張 PR 一個 Actions run 都不會跑**,CI 沒結果、`project-status.yml` 也不會移卡(看板停在原格不是自動化壞了)。處理:先照第 4 點把該 base reset 到 `main`(reset 後 base 與 `main` 是同一個 commit,交叉 merge base 直接消失;base 上有未 release 的 feat 就 reset 後再合回去),**接著把 PR close → reopen** 才會重跑 CI(base 更新本身不觸發 `pull_request` 事件)
- **Docker build context 排除 `.md`,但 admin 的 help.md 是程式資產**(#259):根目錄 `.dockerignore` 有 `**/*.md`(文件不進 image),而 `apps/admin/src/md/module-help/*.help.md` 是 Vite 在 build 時用 `import.meta.glob` 內嵌進 bundle 的**程式資產** —— 被排除時本機 `pnpm build` 照樣正常、CI 建出來的 image 卻讓每頁的「?」全部 disabled,而且沒有任何一步會失敗。例外規則寫在 `.dockerignore`(`!apps/admin/src/md/**/*.md`,必須排在 `**/*.md` 之後才生效),防回歸檢查在 `apps/admin/Dockerfile` 的 builder stage:build 之後 `RUN pnpm --filter @repo/admin check:help-bundle`(腳本 `apps/admin/scripts/check-help-bundle.mjs`,比對每份說明的內容是否出現在 `dist/assets/*.js`;掃不到說明檔也算失敗)。**日後再有這類「跟著 build 烘進產物的非程式檔」**(i18n 字典、範本、憑證…),一律同時做兩件事:在 `.dockerignore` 補例外 + 在 Dockerfile 加一條驗產物的檢查
- **admin 的靜態檔快取策略:`index.html` = `no-cache`、`/assets/` = `immutable` 一年**(#270,設定在 `apps/admin/nginx.conf`):`index.html` 是唯一指向「這次部署的 bundle 檔名」的入口,一旦被快取,部署後重新整理仍會載入舊 HTML → 舊 `assets/index-<hash>.js`;`/assets/` 底下的檔名帶 content hash,內容一變檔名就變,可以永久快取。`no-cache` 不是「不快取」,是「每次都先向伺服器驗證」(ETag 命中回 304,只花一個 round trip)。**部署後使用者正常重新整理即可拿到新版,不需要 Ctrl+F5 / 清快取**;先前沒有這個標頭時瀏覽器會用啟發式快取(依 `Last-Modified` 自行推算效期),於是出現「部署成功但畫面沒變」。注意 nginx 的 `add_header` **不會**繼承到自己也有 `add_header` 的子 block,所以 `location /`(SPA fallback)與 `location = /index.html`(`try_files` 的內部轉址會重新比對 location)各寫一份。**改了 `apps/admin/nginx.conf` 之後,驗收方式是 `curl -I https://erp-<環境>.cookhome.online/` 看 `Cache-Control`**
- **改了 `.dockerignore` / Dockerfile 之後要用 `-f force=true` 部署**:這兩個檔不屬於任何 package,`turbo ls --affected` 看不到,不加 force 會整個 build 步驟被跳過
- **dev / staging 重置**:`git push --force origin origin/main:refs/heads/dev`(`staging` 同)。這條指令不需要切分支、不動本地工作目錄,既是 release 後的常規對齊(上面第 4 點),也是 `dev` 被汙染時的救援手段
- **認證**:Workload Identity Federation — OIDC 短期憑證換 `github-deployer` 身分,repo 裡**零 GCP 金鑰**,provider 限定本 repo
- **回滾**:`gcloud run services update-traffic cookhome-api --to-revisions=<舊revision>=100`,或從舊 commit 觸發部署

## 三、手動操作(維運速查)

### 本地容器

```bash
docker compose up -d                  # 日常開發:只起 MongoDB
docker compose --profile full up -d   # 部署前驗證:mongo + api + admin 整套容器
```

### 手動部署(CD 掛掉時的備援;平常交給 deploy.yml)

**照 `.github/workflows/deploy.yml` 的「deploy」步驟打,不要憑記憶**:`gcloud run deploy` 必須同時帶 `--env-vars-file=deploy/env/<環境>.yaml`(非機密變數,整包取代)與完整的 `--set-secrets=MONGODB_URI=…,FIELD_ENCRYPTION_KEY=…,JWT_SECRET=…,RESEND_API_KEY=…`(secret 名稱依環境加 `-dev` / `-staging` 後綴)。`--set-secrets` 是整組取代,少列一個就等於把那個 secret 從服務拿掉。build / push 的部分:

```bash
SHA=$(git rev-parse --short HEAD)
REG=asia-east1-docker.pkg.dev/cookhome-online/cookhome
docker build -f apps/api/Dockerfile -t $REG/api:$SHA . && docker push $REG/api:$SHA
# 接著複製 deploy.yml「deploy」步驟裡 api 的 gcloud run deploy 指令,把 ${{ … }} 換成該環境的值
```

### 觀測與維運

```bash
gcloud run services list                                   # 服務清單與 URL
gcloud run revisions list --service=cookhome-api           # 歷史版本(回滾用)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="cookhome-api"' --limit=30
gcloud secrets versions list mongodb-uri                   # secret 版本
gcloud beta run domain-mappings describe --domain=api.cookhome.online --region=asia-east1  # 網域/憑證狀態
```

- Cloud Run UI:console.cloud.google.com → Cloud Run(注意:編輯表單顯示的 max instances「20」是表單預設建議值,實際生效值看 Revisions 分頁,目前為 2)
- Atlas UI:cloud.mongodb.com → Network Access(0.0.0.0/0)/ Database Access / Browse Collections
- Cloudflare:`api`、`erp`、`api-dev`、`erp-dev`、`api-staging`、`erp-staging` CNAME → `ghs.googlehosted.com`(灰雲,對應 6 筆 Cloud Run domain mapping);`www`、`@`、`dev`、`staging`、`design` CNAME → Vercel(灰雲);TXT 為 Google 網域驗證,勿刪

## 四、環境變數管理

**核心觀念:環境變數只有三個家,依「性質」決定放哪** — 要改某個變數,先問它是哪一種,就知道去哪改:

| 性質                                  | 放哪(真實來源)                                                                                                     | 進版控?                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **非機密、雲端用**(網址、開關、效期…) | **`deploy/env/<環境>.yaml`**(dev / staging / production 各一檔),deploy.yml 以 `--env-vars-file` 整包餵給 Cloud Run | ✅(走 PR,可審)                |
| **機密**(連線字串、金鑰、API key)     | Secret Manager,名稱 `<名稱>-dev` / `-staging` / `<名稱>`;deploy.yml 以 `--set-secrets` 引用                        | ❌ 值永不進版控               |
| **本地開發**                          | 各 app 的 `.env`(範本 `.env.example` 列出全部變數與預設值)                                                         | `.env` ❌ / `.env.example` ✅ |

其他層:

| 層               | 真實來源                                                                                                                                                                                                                               | 進版控?                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Cloud Run(api)   | 上表前兩列(`deploy/env/<環境>.yaml` + Secret Manager)。YAML 自 #69 起是該環境**全部明文變數**的唯一來源(`GRAPHQL_SANDBOX` 也在檔內):`--env-vars-file` 整包取代,檔內沒寫的變數部署後即不存在;`--set-secrets` 掛入的 secret 變數不受影響 | ✅ / ❌                     |
| Cloud Run(admin) | `deploy.yml` 的 `--build-arg`(Vite 值烘進 image)                                                                                                                                                                                       | ✅                          |
| Vercel(front)    | Vercel dashboard(Settings → Environment Variables)                                                                                                                                                                                     | ❌(平台保存;清單記載於下表) |

Vercel 現有變數(唯一 key:`NEXT_PUBLIC_GRAPHQL_ENDPOINT`,全部 Config 型):

| 範圍                                     | 值                                            |
| ---------------------------------------- | --------------------------------------------- |
| Production                               | `https://api.cookhome.online/graphql`         |
| Preview → branch `staging`               | `https://api-staging.cookhome.online/graphql` |
| Preview → branch `dev`                   | `https://api-dev.cookhome.online/graphql`     |
| Preview(其他分支 = 未來 feat 的 preview) | `https://api-dev.cookhome.online/graphql`     |

**新增一個環境變數的 SOP**(依用到它的地方,最多三處):

1. 本地:加進該 app 的 `.env` + 同步 `.env.example`(讓別人/AI 知道有這個變數)
2. api/admin 雲端:機密 → `gcloud secrets create`(SOP 見下節)+ deploy.yml `--set-secrets`;非機密 → 加進 `deploy/env/<環境>.yaml`(三個環境各給值;走 PR,可審查)。程式端一律給**內建預設值**,變數不設也能跑
3. front 雲端:Vercel dashboard 加(注意 Type 選 **Config**,除非真是機密;`NEXT_PUBLIC_` 前綴 = 會進瀏覽器,機密絕不可加此前綴)

**機密判斷準則**:「這個值出現在瀏覽器/版控裡會不會出事?」會 → Secret Manager(Cloud Run)或 Secret 型(Vercel);不會 → 明文設定即可。

變數清單(用途/是否機密/放哪/狀態)的正本是 `docs/env-registry.md`,新增或異動變數時必須更新它。

### GCS bucket 的 CORS(瀏覽器直傳必要)

瀏覽器對簽名網址 `PUT` 直傳受 CORS 限制,六個 bucket 都已設(2026-09-19;#140 驗收時開通租戶因此失敗過):

```bash
# cors.json:origin = erp-dev / erp-staging / erp 三個網域 + http://localhost:3001,method GET / PUT / HEAD,responseHeader Content-Type,maxAge 3600
gcloud storage buckets update gs://cookhome-assets-dev --cors-file=cors.json   # 六個 bucket 各一次
gcloud storage buckets describe gs://cookhome-assets-dev --format="value(cors_config)"
```

新增前端網域(例如自訂網域)時要把 origin 加進去再更新。

### 新增一個 Secret Manager 機密的標準步驟

指令都在 Claude Code 的 `!` 提示或 Git Bash 執行(**是 bash,不是 PowerShell** — `$env:TEMP` 這種 PowerShell 語法在這裡不會動)。

**1. 命名慣例**:每個環境各一份、值互不相同 — `<名稱>-dev`、`<名稱>-staging`、`<名稱>`(production 無後綴)。例:`mongodb-uri-dev`、`field-encryption-key`。

**2. 建立** — 依值的來源選一種:

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
| CI 步驟(如 deploy.yml 跑 migrate/seed)         | 部署身分 `github-deployer@cookhome-online.iam.gserviceaccount.com`                                                                                                                                                  |

```
gcloud secrets add-iam-policy-binding <名稱>-dev --member="serviceAccount:<上表身分>" --role="roles/secretmanager.secretAccessor" --project=cookhome-online
```

三個環境各跑一次。

**4. 接線**(走 PR):Cloud Run 用的 → deploy.yml 環境參數區加對應輸出、`--set-secrets` 追加 `<環境變數名>=<secret 名>:latest`;CI 步驟用的 → 該步驟 `gcloud secrets versions access latest --secret=<名稱>`。

**5. 登記**:更新 `docs/env-registry.md`(狀態、secret 名稱、讀取身分)與本檔「資源清單」。

**陷阱**:

- 貼值時尾端多一個換行或空白,會變成值的一部分(密碼登入失敗最常見原因)。
- 欄位加密金鑰(`field-encryption-key*`)**建立後不可輪替或刪除**,換鑰匙 = 舊密文全部解不開。
- seed 只在帳號**不存在**時建立、存在就不動 — 帳號建立後再改 `root-admin-password*` 的值,**不會**改到資料庫裡的密碼;要改密碼在系統內改。

小工具:裝了 vercel CLI 並登入後,`vercel env pull` 可把 Vercel 的變數拉成本地 `.env.local`(本地 front 想直連雲端 dev api 時方便)。

### GCS bucket 與 IAM(已建於 2026-09-19,重建或加新環境時照此)

檔案儲存走 GCS 簽名網址直傳(ADR-0010):瀏覽器拿 API 簽的 V4 網址直接上傳 / 讀取,檔案不經過 api。**簽名不下載金鑰檔** — Cloud Run 執行身分沒有私鑰,`@google-cloud/storage` 會改呼叫 IAM Credentials 的 `signBlob`,所以那個 SA 必須能簽自己的名(第 3 步)。指令在 Git Bash 執行,`<env>` 取 `dev` / `staging` / `prod`。

**1. 建 bucket**(私有;region 與 Cloud Run 同 asia-east1,跨區會付流量費):

```
gcloud storage buckets create gs://cookhome-assets-<env> --project=cookhome-online --location=asia-east1 --uniform-bucket-level-access --public-access-prevention
```

公開 bucket 同一條指令,名稱改 `gs://cookhome-public-<env>`、**拿掉 `--public-access-prevention`**,再加一行開公開讀:

```
gcloud storage buckets add-iam-policy-binding gs://cookhome-public-<env> --member=allUsers --role=roles/storage.objectViewer
```

**2. 授權 Cloud Run 執行身分讀寫物件**(六顆 bucket 各跑一次;身分同 Secret Manager 那張表的查法):

```
gcloud storage buckets add-iam-policy-binding gs://cookhome-assets-<env> --member=serviceAccount:728045896207-compute@developer.gserviceaccount.com --role=roles/storage.objectAdmin
```

**3. 讓執行身分能簽自己的名**(V4 簽名走 signBlob;漏這步 api 會在簽名時報 `iam.serviceAccounts.signBlob` 權限不足):

```
gcloud services enable iamcredentials.googleapis.com --project=cookhome-online
gcloud iam service-accounts add-iam-policy-binding 728045896207-compute@developer.gserviceaccount.com --member=serviceAccount:728045896207-compute@developer.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator --project=cookhome-online
```

**4. 接線**(走 PR):`deploy/env/<環境>.yaml` 的 `GCS_BUCKET_PRIVATE` / `GCS_BUCKET_PUBLIC` 填 bucket 名稱(非機密,不進 Secret Manager);登記於 `docs/env-registry.md`。`GCS_BUCKET_PRIVATE` 沒設時 api 照常啟動,但改用記錄用 adapter(簽出來的網址是假的、檔案不會真的上傳)—— 本地開發與測試即此模式。

**驗證**(需要 Cloud Run 的執行身分,本地做不到):部署後以 GraphQL 要一張上傳票 → 用該網址 PUT 一張圖 → 讀回簽名網址能開,步驟見 #137 的 PR 內文。

### Vercel 補充設定(2026-09-04)

- **分支網域**:`dev.cookhome.online` → branch `dev`、`staging.cookhome.online` → branch `staging`(Settings → Domains,各綁 Git Branch);api/admin 的 dev/staging 子網域走 Cloud Run domain mapping(`api-dev`、`erp-dev`、`api-staging`、`erp-staging`,Cloudflare 灰雲 CNAME → ghs.googlehosted.com)
- **Deploy Hooks**(Settings → Git 最下方):`dev-front`、`staging-front` — 對 hook URL 發 POST 即可**不靠 commit** 重 build 該分支的 front(Vercel 會跳過無檔案變更的 commit,分支剛建立或只想重烘時用這個)
- **Deployment Protection:已關閉** Vercel Authentication(決策:dev/staging 的 api/admin 在 Cloud Run 本就公開,單獨保護 front preview 無實益;未來要全面保護測試環境再另議)
- 三環境 admin image 烘入的 api 端點皆為自訂子網域(`api` / `api-dev` / `api-staging.cookhome.online`,2026-09-05 C11 完成)

## 五、安全與費用備忘

- 連線字串(含密碼)只存在:Atlas、Secret Manager、擁有者本機 — 從未進版控或指令輸出
- GraphQL Sandbox / introspection:production 關、dev 開(`GRAPHQL_SANDBOX`,值寫在 `deploy/env/dev.yaml`,其他環境的檔不寫此鍵 = 關);本地 dev 恆開
- 費用防線:全服務 `max-instances=2`(費用天花板)+ Budget NT$600 三段警告
- 連線池:三環境的 MongoDB URI 均含 `maxPoolSize=10` — 理論上限 6 實例 × 10 = 60 連線,遠低於 M0 的 500(三環境共用同一 cluster 額度,拆 cluster 見 dis.md 待辦)
- 已評估先不做:固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲 WAF(需 Global LB ~US$18/月)、production api `min-instances=1`(冷啟動換省錢,有流量後再開)
- 待議:api schema 演進規範(向後相容 + 破壞性變更配遷移腳本)→ `docs/standards/api/`
