# CookHome 部署現況

本專案在[部署操作手冊](../deployment.md)與[環境變數登記](../env-registry.md)各項的實際值。流程、規則與指令格式以底座兩份為準;這裡只列本專案的網域、資源、各環境設定值與維運常用指令。值的正本是 `deploy/project/cloud.json`、`deploy/project/github.json`、`deploy/env/<環境>.yaml`,與本檔不一致時以它們為準並回頭修本檔。

## 架構

```text
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
```

dev / staging 是同構的一套,由對應分支部署。

## 網域與環境對照

|                         | dev(開發測試)                         | staging(預發布)                           | production                        |
| ----------------------- | ------------------------------------- | ----------------------------------------- | --------------------------------- |
| 對應分支                | `dev`                                 | `staging`                                 | `main`                            |
| api                     | `api-dev.cookhome.online`(Sandbox 開) | `api-staging.cookhome.online`(Sandbox 關) | `api.cookhome.online`(Sandbox 關) |
| admin                   | `erp-dev.cookhome.online`             | `erp-staging.cookhome.online`             | `erp.cookhome.online`             |
| front                   | `dev.cookhome.online`                 | `staging.cookhome.online`                 | `www.cookhome.online`             |
| 即時通道                | `rt-dev.cookhome.online`              | `rt-staging.cookhome.online`              | `rt.cookhome.online`              |
| 資料庫(同一 M0 cluster) | db `cookhome-dev`                     | db `cookhome-staging`                     | db `cookhome`                     |
| secret 後綴             | `-dev`                                | `-staging`                                | 無後綴                            |
| 通知 email              | 開(`WORKFLOW_MAIL_ENABLED`)           | 關                                        | 關                                |
| 收件白名單              | 不設(不限收件人)                      | 不設                                      | 不設                              |
| api / admin 部署        | 手動觸發 deploy.yml                   | 手動觸發 deploy.yml                       | 手動觸發 deploy.yml               |
| front 部署              | Vercel 隨分支 push 自動建置           | 同左                                      | 同左                              |

## 資源清單

| 資源                | 識別                                                                                                                                                           | 費用            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| GCP 專案            | `cookhome-online`(region asia-east1)                                                                                                                           | —               |
| Artifact Registry   | `asia-east1-docker.pkg.dev/cookhome-online/cookhome`                                                                                                           | 儲存費 ~NT$1/月 |
| Cloud Run ×6        | api / admin 各 ×(prod, staging, dev)(全部 min=0 / max=2):`cookhome-api[-dev\|-staging]`、`cookhome-admin[-dev\|-staging]`                                      | 無流量 = $0     |
| Secret Manager      | 三環境各一份:`mongodb-uri`、`field-encryption-key`、`root-admin-password`、`jwt-secret`、`resend-api-key`、`realtime-ticket-secret`、`realtime-publish-secret` | ~$0             |
| GCS bucket ×6       | 私有 `cookhome-assets-dev` / `-staging` / `-prod`(uniform access、封鎖公開存取);公開讀 `cookhome-public-dev` / `-staging` / `-prod`                            | 空 bucket = $0  |
| WIF + 部署身分      | pool `github` / provider `github-oidc` / SA `github-deployer@cookhome-online.iam.gserviceaccount.com`(只認 taiwanhua/cookhome)                                 | $0              |
| api 執行身分        | 預設 compute SA `728045896207-compute@developer.gserviceaccount.com`(讀 Secret、寫私有 bucket、自簽簽名網址)                                                   | —               |
| Cloud Scheduler     | 工作 `cookhome-api[-dev\|-staging]-scheduled-jobs`,呼叫身分 `scheduler-invoker@cookhome-online.iam.gserviceaccount.com`                                        | $0              |
| 即時通道            | Cloudflare Worker `cookhome-realtime[-dev\|-staging]`                                                                                                          | $0              |
| 列印代理程式安裝檔  | 三個私有 bucket 的 `print-agent/`                                                                                                                              | $0              |
| Budget              | NT$600/月,50% / 90% / 100% 郵件警告                                                                                                                            | $0              |
| MongoDB Atlas       | cluster `cookhome-dev`(M0)                                                                                                                                     | $0              |
| Cloudflare / Vercel | DNS 代管 / front(Hobby)                                                                                                                                        | $0              |
| Vercel 第二專案     | `cookhome-design` → `design.cookhome.online`(Storybook,root `apps/storybook`,output `storybook-static`,只建 main:Ignored Build Step = Only build production)   | $0              |
| GitHub 看板         | Project「CookHome」(#3,owner taiwanhua);IDs 在 `deploy/project/github.json`                                                                                    | $0              |

## 環境變數的本專案值

變數的用途、未設行為與判準見[環境變數登記](../env-registry.md);本專案沒有自己新增的變數。

| 變數                                             | 本專案的值                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 機密(`MONGODB_URI` 等五個 + 即時通道兩把)        | 三環境都已接線;`FIELD_ENCRYPTION_KEY` 建立後不可輪替;Resend 網域已驗證                                          |
| `ADMIN_APP_URL`                                  | `https://erp-dev.cookhome.online` / `https://erp-staging.cookhome.online` / `https://erp.cookhome.online`       |
| `COOKIE_DOMAIN`                                  | 三環境 `.cookhome.online`                                                                                       |
| `GCS_BUCKET_PRIVATE` / `GCS_BUCKET_PUBLIC`       | `cookhome-assets-<env>` / `cookhome-public-<env>`(`<env>` = `dev` / `staging` / `prod`)                         |
| `REALTIME_URL`                                   | `https://rt-dev.cookhome.online` / `https://rt-staging.cookhome.online` / `https://rt.cookhome.online`          |
| `SCHEDULER_INVOKER_EMAIL` / `SCHEDULER_AUDIENCE` | `scheduler-invoker@cookhome-online.iam.gserviceaccount.com`;audience = 該環境 api 網址                          |
| `GRAPHQL_SANDBOX`                                | 只有 dev 為 `"true"`                                                                                            |
| `WORKFLOW_MAIL_ENABLED`                          | 只有 dev 為 `"true"`(省寄信額度;免費額度 100 封 / 日、3000 封 / 月)                                             |
| `MAIL_ALLOWLIST`                                 | 三環境都不設                                                                                                    |
| `ROOT_ADMIN_ACCOUNT` / `ROOT_ADMIN_EMAIL`        | 帳號 `root`,三環境同一個信箱(`cloud.json` 的 `rootAdmin`)                                                       |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT`(Vercel)           | Production `https://api.cookhome.online/graphql`;Preview `staging` → `api-staging`,`dev` 與其他分支 → `api-dev` |
| `COMPOSE_PROJECT_NAME` / `LOCAL_MONGO_DB`        | `cookhome`(本機)                                                                                                |
| `E2E_COMPOSE_PROJECT`                            | `cookhome-e2e`                                                                                                  |

## 維運速查

```bash
gcloud run services list --project=cookhome-online --region=asia-east1 # 服務清單與 URL
gcloud run revisions list --service=cookhome-api --project=cookhome-online --region=asia-east1 # 歷史版本(回滾用)
gcloud run services update-traffic cookhome-api --project=cookhome-online --region=asia-east1 --to-revisions=<先前的 revision>=100 # 回滾
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="cookhome-api"' --limit=30 --project=cookhome-online
gcloud secrets versions list mongodb-uri --project=cookhome-online # secret 版本
gcloud beta run domain-mappings describe --domain=api.cookhome.online --project=cookhome-online --region=asia-east1 # 網域/憑證狀態
gh workflow run "Reset DB" --ref dev -f environment=dev -f mode=data -f confirmation="reset:dev:cookhome-dev:data"
```

本機還原資料庫:`MONGODB_URI="mongodb://127.0.0.1:27017/cookhome-dev?directConnection=true&replicaSet=cookhome"`,確認字串 `reset:dev:cookhome-dev:data`(其餘照 [toolbox](../agents/toolbox.md))。

- Cloud Run UI:console.cloud.google.com → Cloud Run。編輯表單顯示的 max instances「20」是表單的建議值,實際生效值看 Revisions 分頁(2)。
- Atlas UI:cloud.mongodb.com → Network Access(0.0.0.0/0)/ Database Access / Browse Collections。
- Cloudflare:`api`、`erp`、`api-dev`、`erp-dev`、`api-staging`、`erp-staging` CNAME → `ghs.googlehosted.com`(灰雲,對應 6 筆 Cloud Run domain mapping);`www`、`@`、`dev`、`staging`、`design` CNAME → Vercel(灰雲);TXT 為 Google 網域驗證,勿刪。
- Vercel:分支網域 `dev.cookhome.online` → branch `dev`、`staging.cookhome.online` → branch `staging`;Deployment Protection 關閉(dev / staging 的 api / admin 在 Cloud Run 本就公開,單獨保護 front preview 沒有實益;要全面保護測試環境時再一起設計)。

## 安全與費用

- 連線字串(含密碼)只存在 Atlas、Secret Manager、擁有者本機,從未進版控或指令輸出。
- 費用防線:全服務 `max-instances=2`(費用天花板)+ Budget NT$600 三段警告。
- 連線池:三環境的 MongoDB URI 均含 `maxPoolSize=10`,理論上限 6 實例 × 10 = 60 連線,遠低於 M0 的 500(三環境共用同一 cluster 額度;拆 cluster 見 `docs/tmp/project-dis.md` 搜「Atlas」)。
- 評估過、目前不做:固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲 WAF(需 Global LB ~US$18/月)、production api `min-instances=1`(用冷啟動換省錢,有流量後再開)。
- 待議:api schema 演進規範(向後相容 + 破壞性變更配遷移腳本)。
