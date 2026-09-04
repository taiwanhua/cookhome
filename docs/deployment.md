# CookHome 部署架構與操作手冊

> 最後更新:2026-09-04。**學習路線 ①~⑤ 全部完成**:CI + CD 上線,www / erp / api 運行於自訂網域;三環境分支模型(`dev` / `staging` / `main`),部署一律手動觸發。

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

dev / staging 環境:api 與 admin 各有 -dev、-staging 服務(run.app 網址),由對應分支手動部署

```

### 環境對照(分支 ↔ 環境)

|                         | dev(開發測試)                             | staging(預發布)                               | production                        |
| ----------------------- | ----------------------------------------- | --------------------------------------------- | --------------------------------- |
| 對應分支                | `dev`                                     | `staging`                                     | `main`                            |
| api                     | `cookhome-api-dev-...run.app`(Sandbox 開) | `cookhome-api-staging-...run.app`(Sandbox 關) | `api.cookhome.online`(Sandbox 關) |
| admin                   | `cookhome-admin-dev-...run.app`           | `cookhome-admin-staging-...run.app`           | `erp.cookhome.online`             |
| front                   | `dev.cookhome.online`                     | `staging.cookhome.online`                     | `www.cookhome.online`(merge 自動) |
| 資料庫(同一 M0 cluster) | db `cookhome-dev`                         | db `cookhome-staging`                         | db `cookhome`                     |
| secret                  | `mongodb-uri-dev`                         | `mongodb-uri-staging`                         | `mongodb-uri`                     |
| 部署                    | 手動觸發 deploy.yml                       | 手動觸發 deploy.yml                           | 手動觸發 deploy.yml               |

### 資源清單

| 資源                | 識別                                                                                   | 費用            |
| ------------------- | -------------------------------------------------------------------------------------- | --------------- |
| GCP 專案            | `cookhome-online`(region 預設 asia-east1)                                              | —               |
| Artifact Registry   | `asia-east1-docker.pkg.dev/cookhome-online/cookhome`                                   | 儲存費 ~NT$1/月 |
| Cloud Run ×6        | api / admin 各 ×(prod, staging, dev)(全部 min=0 / max=2)                               | 無流量 = $0     |
| Secret Manager      | `mongodb-uri`、`mongodb-uri-staging`、`mongodb-uri-dev`                                | ~$0             |
| WIF + 部署身分      | pool `github` / provider `github-oidc` / SA `github-deployer`(只認 taiwanhua/cookhome) | $0              |
| Budget              | NT$600/月,50%/90%/100% 郵件警告                                                        | $0              |
| MongoDB Atlas       | cluster `cookhome-dev`(M0)                                                             | $0              |
| Cloudflare / Vercel | DNS 代管 / front(Hobby)                                                                | $0              |

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
  - image tag = 該分支 HEAD 的 git SHA;admin 每環境各建一顆(VITE 端點烘入)
- **dev 汙染重置**:`git checkout dev && git fetch && git reset --hard origin/main && git push --force origin dev`
- **認證**:Workload Identity Federation — OIDC 短期憑證換 `github-deployer` 身分,repo 裡**零 GCP 金鑰**,provider 限定本 repo
- **回滾**:`gcloud run services update-traffic cookhome-api --to-revisions=<舊revision>=100`,或從舊 commit 觸發部署

## 三、手動操作(維運速查)

### 本地容器

```bash
docker compose up -d                  # 日常開發:只起 MongoDB
docker compose --profile full up -d   # 部署前驗證:mongo + api + admin 整套容器
```

### 手動部署(CD 掛掉時的備援;平常交給 deploy.yml)

```bash
SHA=$(git rev-parse --short HEAD)
REG=asia-east1-docker.pkg.dev/cookhome-online/cookhome
docker build -f apps/api/Dockerfile -t $REG/api:$SHA . && docker push $REG/api:$SHA
gcloud run deploy cookhome-api --image=$REG/api:$SHA \
  --port=5001 --allow-unauthenticated --min-instances=0 --max-instances=2 \
  --set-secrets=MONGODB_URI=mongodb-uri:latest
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
- Cloudflare:`api`、`erp` CNAME → `ghs.googlehosted.com`(灰雲);`www`、`@` CNAME → Vercel(灰雲);TXT 為 Google 網域驗證,勿刪

## 四、環境變數管理

**核心觀念:雲端沒有「env 檔案」— 環境變數是平台設定,不是檔案。** 各層的真實來源:

| 層               | 真實來源                                                                                                               | 進版控?                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 本地開發         | 各 app 的 `.env`(範本:`.env.example`)                                                                                  | `.env` ❌(gitignored)/ `.env.example` ✅ |
| Cloud Run(api)   | **`deploy.yml` 各環境區塊**:非機密走 `--set-env-vars`(如 `GRAPHQL_SANDBOX`),機密走 `--set-secrets` 引用 Secret Manager | deploy.yml ✅ / 機密值永不進版控         |
| Cloud Run(admin) | `deploy.yml` 的 `--build-arg`(Vite 值烘進 image)                                                                       | ✅                                       |
| Vercel(front)    | Vercel dashboard(Settings → Environment Variables)                                                                     | ❌(平台保存;清單記載於下表)              |

Vercel 現有變數(唯一 key:`NEXT_PUBLIC_GRAPHQL_ENDPOINT`,全部 Config 型):

| 範圍                                     | 值                                            |
| ---------------------------------------- | --------------------------------------------- |
| Production                               | `https://api.cookhome.online/graphql`         |
| Preview → branch `staging`               | `https://api-staging.cookhome.online/graphql` |
| Preview → branch `dev`                   | `https://api-dev.cookhome.online/graphql`     |
| Preview(其他分支 = 未來 feat 的 preview) | `https://api-dev.cookhome.online/graphql`     |

**新增一個環境變數的 SOP**(依用到它的地方,最多三處):

1. 本地:加進該 app 的 `.env` + 同步 `.env.example`(讓別人/AI 知道有這個變數)
2. api/admin 雲端:機密 → `gcloud secrets create` + deploy.yml `--set-secrets`;非機密 → deploy.yml `--set-env-vars`(走 PR,可審查)
3. front 雲端:Vercel dashboard 加(注意 Type 選 **Config**,除非真是機密;`NEXT_PUBLIC_` 前綴 = 會進瀏覽器,機密絕不可加此前綴)

**機密判斷準則**:「這個值出現在瀏覽器/版控裡會不會出事?」會 → Secret Manager(Cloud Run)或 Secret 型(Vercel);不會 → 明文設定即可。

小工具:裝了 vercel CLI 並登入後,`vercel env pull` 可把 Vercel 的變數拉成本地 `.env.local`(本地 front 想直連雲端 dev api 時方便)。

### Vercel 補充設定(2026-09-04)

- **分支網域**:`dev.cookhome.online` → branch `dev`、`staging.cookhome.online` → branch `staging`(Settings → Domains,各綁 Git Branch);api/admin 的 dev/staging 子網域走 Cloud Run domain mapping(`api-dev`、`erp-dev`、`api-staging`、`erp-staging`,Cloudflare 灰雲 CNAME → ghs.googlehosted.com)
- **Deploy Hooks**(Settings → Git 最下方):`dev-front`、`staging-front` — 對 hook URL 發 POST 即可**不靠 commit** 重 build 該分支的 front(Vercel 會跳過無檔案變更的 commit,分支剛建立或只想重烘時用這個)
- **Deployment Protection:已關閉** Vercel Authentication(決策:dev/staging 的 api/admin 在 Cloud Run 本就公開,單獨保護 front preview 無實益;未來要全面保護測試環境再另議)

## 五、安全與費用備忘

- 連線字串(含密碼)只存在:Atlas、Secret Manager、擁有者本機 — 從未進版控或指令輸出
- GraphQL Sandbox / introspection:production 關、dev 開(`GRAPHQL_SANDBOX` env);本地 dev 恆開
- 費用防線:全服務 `max-instances=2`(費用天花板)+ Budget NT$600 三段警告
- 已評估先不做:固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲 WAF(需 Global LB ~US$18/月)、production api `min-instances=1`(冷啟動換省錢,有流量後再開)
- 待議:api schema 演進規範(向後相容 + 破壞性變更配遷移腳本)→ `docs/standards/api/`
