# CookHome 部署架構與操作手冊

> 最後更新:2026-09-04。**學習路線 ①~⑤ 全部完成**:CI + CD 上線,www / erp / api 運行於自訂網域,dev 環境自動部署。

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

dev 環境(merge main 自動部署):cookhome-api-dev / cookhome-admin-dev(run.app 網址)
```

### 環境對照

|          | production                                 | dev                                                                  |
| -------- | ------------------------------------------ | -------------------------------------------------------------------- |
| front    | `www.cookhome.online`(Vercel,merge 自動)   | Vercel 的 PR Preview 網址                                            |
| admin    | `erp.cookhome.online`                      | `cookhome-admin-dev-eozioc5kjq-de.a.run.app`                         |
| api      | `api.cookhome.online`(Sandbox **關**)      | `cookhome-api-dev-...run.app`(Sandbox **開**,`GRAPHQL_SANDBOX=true`) |
| 資料庫   | Atlas db `cookhome`(secret `mongodb-uri`)  | Atlas db `cookhome-dev`(secret `mongodb-uri-dev`,同一 M0 cluster)    |
| 部署方式 | **手動觸發** deploy.yml(workflow_dispatch) | merge main **自動**                                                  |

### 資源清單

| 資源                | 識別                                                                                   | 費用            |
| ------------------- | -------------------------------------------------------------------------------------- | --------------- |
| GCP 專案            | `cookhome-online`(region 預設 asia-east1)                                              | —               |
| Artifact Registry   | `asia-east1-docker.pkg.dev/cookhome-online/cookhome`                                   | 儲存費 ~NT$1/月 |
| Cloud Run ×4        | api / admin / api-dev / admin-dev(全部 min=0 / max=2)                                  | 無流量 = $0     |
| Secret Manager      | `mongodb-uri`、`mongodb-uri-dev`                                                       | ~$0             |
| WIF + 部署身分      | pool `github` / provider `github-oidc` / SA `github-deployer`(只認 taiwanhua/cookhome) | $0              |
| Budget              | NT$600/月,50%/90%/100% 郵件警告                                                        | $0              |
| MongoDB Atlas       | cluster `cookhome-dev`(M0)                                                             | $0              |
| Cloudflare / Vercel | DNS 代管 / front(Hobby)                                                                | $0              |

## 二、CI/CD 流程(現行)

```
開 branch → PR ──▶ ci.yml:lint / typecheck / test / build(mongo service + 起 api)
   │ CI 綠 → merge main
   ▼
deploy.yml(自動)──▶ build image(tag = git SHA;admin 分 dev/prod 兩顆,VITE 端點烘入)
                     → 推 Artifact Registry → 部署 dev(api-dev + admin-dev)
                     ;Vercel 同時自動部署 front
   │ 在 dev 環境人工驗收
   ▼
deploy.yml(手動)──▶ GitHub → Actions → Deploy → Run workflow → confirm 欄輸入 production
                     → 同一顆 SHA image 部署到正式環境(build once, deploy many,不重建)
```

- **認證**:Workload Identity Federation — GitHub Actions 以 OIDC 短期憑證換 `github-deployer` 身分,repo 裡**沒有任何 GCP 金鑰**;provider 條件限定只有本 repo 能換
- **production 閘門**:免費方案沒有 Environments 核准,改用 workflow_dispatch 手動觸發等效替代
- **回滾**:`gcloud run services update-traffic cookhome-api --to-revisions=<舊revision>=100`,或手動觸發舊 SHA 的部署

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

## 四、安全與費用備忘

- 連線字串(含密碼)只存在:Atlas、Secret Manager、擁有者本機 — 從未進版控或指令輸出
- GraphQL Sandbox / introspection:production 關、dev 開(`GRAPHQL_SANDBOX` env);本地 dev 恆開
- 費用防線:全服務 `max-instances=2`(費用天花板)+ Budget NT$600 三段警告
- 已評估先不做:固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲 WAF(需 Global LB ~US$18/月)、production api `min-instances=1`(冷啟動換省錢,有流量後再開)
- 待議:api schema 演進規範(向後相容 + 破壞性變更配遷移腳本)→ `docs/standards/api/`
