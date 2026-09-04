# CookHome 部署架構與操作手冊

> 最後更新:2026-09-04。學習路線進度:**①②③⑤ 完成**(www / erp / api 全數上線於自訂網域;⑤ 僅剩 GitHub Environments 核准閘門,併入 ④),**④ CD 自動化未做 — 目前 admin/api 部署為手動,front 由 Vercel 自動**。

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
```

| 資源              | 識別                                                 | 費用                                     |
| ----------------- | ---------------------------------------------------- | ---------------------------------------- |
| GCP 專案          | `cookhome-online`(region 預設 asia-east1)            | —                                        |
| Artifact Registry | `asia-east1-docker.pkg.dev/cookhome-online/cookhome` | 儲存費 ~NT$1/月                          |
| Cloud Run         | `cookhome-api`、`cookhome-admin`(min=0 / max=2)      | 無流量 = $0,`max-instances` 是費用天花板 |
| Secret Manager    | `mongodb-uri`(連線字串,含密碼,絕不進版控)            | ~$0                                      |
| MongoDB Atlas     | cluster `cookhome-dev`,DB `cookhome`(M0 免費層)      | $0                                       |
| Cloudflare        | DNS 代管(NS 已從 GoDaddy 轉入)                       | $0                                       |
| Vercel            | front(Hobby 免費層)                                  | $0                                       |

## 二、各環節指令與 UI 對照

### 1. 本地容器(學習路線 ①)

```bash
docker compose up -d                  # 日常開發:只起 MongoDB
docker compose --profile full up -d   # 部署前驗證:mongo + api + admin 整套容器

# 單獨重建 image(從 repo 根目錄;Dockerfile 用 turbo prune 裁最小子集)
docker build -f apps/api/Dockerfile   -t cookhome-api .
docker build -f apps/admin/Dockerfile -t cookhome-admin \
  --build-arg VITE_GRAPHQL_ENDPOINT=https://api.cookhome.online/graphql .
```

注意:admin 是 Vite,`VITE_*` 環境變數在 **build 時烘進靜態檔** — 一個環境一顆 image。

### 2. 推 image 上 Artifact Registry(②)

```bash
SHA=$(git rev-parse --short HEAD)     # tag 一律用 git SHA:build once, deploy many
REG=asia-east1-docker.pkg.dev/cookhome-online/cookhome

docker tag  cookhome-api $REG/api:$SHA
docker push $REG/api:$SHA
```

- 首次設定(已做過,免重做):`gcloud auth configure-docker asia-east1-docker.pkg.dev`
- UI 查看:console.cloud.google.com → 專案選 CookHome → 搜「Artifact Registry」→ `cookhome` 倉庫

### 3. 部署 Cloud Run(②③)

```bash
# api(連線字串從 Secret Manager 注入,不出現在任何指令或設定檔)
gcloud run deploy cookhome-api \
  --image=$REG/api:$SHA \
  --port=5001 --allow-unauthenticated \
  --min-instances=0 --max-instances=2 \
  --set-secrets=MONGODB_URI=mongodb-uri:latest
  # dev/staging 環境要開 GraphQL Sandbox 時加:--set-env-vars=GRAPHQL_SANDBOX=true

# admin
gcloud run deploy cookhome-admin \
  --image=$REG/admin:$SHA \
  --port=8080 --allow-unauthenticated \
  --min-instances=0 --max-instances=2
```

常用維運指令:

```bash
gcloud run services list                                   # 服務清單與 URL
gcloud run revisions list --service=cookhome-api           # 歷史版本
gcloud run services update-traffic cookhome-api \
  --to-revisions=cookhome-api-00003-r7t=100                # 回滾:流量切回舊 revision
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="cookhome-api"' --limit=30
```

- UI:console → 搜「Cloud Run」→ 點服務 → Revisions / Logs / Metrics 分頁

### 4. Secret Manager(③)

```bash
gcloud secrets versions add mongodb-uri --data-file=檔案   # 換連線字串:加新版本
gcloud secrets versions destroy 舊版號 --secret=mongodb-uri
gcloud secrets versions list mongodb-uri
```

- 已授權 Cloud Run 的執行帳戶讀取(`roles/secretmanager.secretAccessor`)
- UI:console → 搜「Secret Manager」

### 5. MongoDB Atlas(③,全在 UI:cloud.mongodb.com)

| 操作                            | 位置                                                |
| ------------------------------- | --------------------------------------------------- |
| 看/改網路白名單(現為 0.0.0.0/0) | Security → Network Access                           |
| 資料庫使用者與密碼              | Security → Database Access                          |
| 瀏覽/刪除資料                   | Database → cluster → Browse Collections             |
| 拿連線字串                      | Database → Connect → Drivers(**用 Copy 鈕,別手抄**) |

### 6. 自訂網域(⑤)

```bash
gcloud domains verify cookhome.online        # 一次性:開 Search Console,加 TXT 驗證所有權
gcloud beta run domain-mappings create --service=cookhome-api --domain=api.cookhome.online --region=asia-east1
gcloud beta run domain-mappings describe --domain=api.cookhome.online --region=asia-east1   # 看憑證狀態
```

- Cloudflare UI(dash.cloudflare.com → cookhome.online → DNS → Records):
  - `CNAME api → ghs.googlehosted.com`(**灰雲 DNS only,必須**,橙雲會擋憑證簽發/更新)
  - `CNAME erp → ghs.googlehosted.com`(灰雲)
  - `TXT @ → google-site-verification=...`(驗證用,保留)
- 憑證由 Google 自動簽發與續期,`CertificateProvisioned` 變 `True` 即完成

### 7. front → Vercel(⑤,全在 UI:vercel.com)

1. Add New Project → Import `taiwanhua/cookhome` → **Root Directory = `apps/front`**
2. 環境變數:`NEXT_PUBLIC_GRAPHQL_ENDPOINT = https://api.cookhome.online/graphql`
3. Deploy(注意:front 的 ISR 在 **build 時就打 api** — api 必須先活著,部署順序 api → front)
4. Settings → Domains 加 `www.cookhome.online` 與 `cookhome.online`,照指示到 Cloudflare 加記錄(灰雲)
5. 之後每次 merge `main`,Vercel 自動重新 build + 部署 front(它自帶 CD)

## 三、CI/CD 現況

| 段                | 狀態                     | 內容                                                                                                                                                                                                 |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CI**            | ✅ 已完成                | `.github/workflows/ci.yml`:PR 與 main push 觸發 → mongo service + 起 api → `turbo run lint check-types test` → `build`。與本地 hooks 同一套指令。                                                    |
| **CD(admin/api)** | ❌ **未做 = 學習路線 ④** | 目前「二、2~3」的推 image + 部署全是手動。④ 要做的:`deploy.yml`(merge main → build 有變動的 app → 推 Artifact Registry → 部署)+ **Workload Identity Federation**(GitHub Actions 免金鑰向 GCP 認證)。 |
| **CD(front)**     | ✅ Vercel 內建           | 連上 repo 後 merge 即自動部署,無需自寫。                                                                                                                                                             |
| **⑤ 收尾**        | 🔄 進行中                | 網域憑證等待中;Vercel 匯入中;之後加 GitHub Environments 核准閘門(production 部署前人工點核准)。                                                                                                      |

目前的手動更新完整循環(= ④ 自動化的規格):

```
改程式碼 → branch → PR → CI 綠 → merge main
  → SHA=$(git rev-parse --short HEAD)
  → docker build + push(見 二、1~2)
  → gcloud run deploy(見 二、3)
  → curl / 瀏覽器驗證
```

## 四、安全備忘

- 連線字串(含密碼)只存在:Atlas、Secret Manager、你的本機檔案 — 從未進版控或指令輸出
- GraphQL Sandbox / introspection:雲端預設關;`GRAPHQL_SANDBOX=true` 才開(本地 dev 恆開)
- 費用防線:`max-instances=2` + Budget 警告(Budget 尚未設,見待辦)
- 已評估先不做:固定出口 IP(VPC connector + NAT ~US$10/月)、Cloudflare 橙雲(需 Global LB ~US$18/月)
