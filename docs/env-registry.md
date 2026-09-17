# 環境變數註冊表

所有環境變數的單一清單:用途、是否機密、放哪、誰用。**新增或異動環境變數時必須更新此表。**

判準:**憑證/金鑰/密碼/token → Google Secret Manager(機密);設定/開關/非敏感值 → 普通環境變數。** `NEXT_PUBLIC_*` 會進瀏覽器,**絕不可放機密**。

## 機密(Google Secret Manager)

Secret 命名:三環境各一份 `<名稱>-dev` / `<名稱>-staging` / `<名稱>`(production)。建立與授權步驟見 `docs/deployment.md`「新增一個 Secret Manager 機密的標準步驟」。

| 變數 | 用途 | 用於 | 格式 | Secret 名稱 / 讀取身分 | 狀態 |
|---|---|---|---|---|---|
| `MONGODB_URI` | DB 連線(含帳密) | api runtime、db-migrator(deploy.yml 的 migrate → seed 步驟)、CI 測試 | `mongodb+srv://…/<db>` | `mongodb-uri*` / Cloud Run compute SA + `github-deployer` SA | 已設、已接線 |
| `FIELD_ENCRYPTION_KEY` | 欄位級加密金鑰(ADR-0007;nationalId) | api runtime(用到加密欄位時) | 32 bytes 的 base64 | `field-encryption-key*` / Cloud Run compute SA | 已設、已接線(deploy.yml `--set-secrets`) |
| `ROOT_ADMIN_PASSWORD` | seed 建立首個超管的初始密碼(ADR-0002;只在帳號不存在時用) | db-migrator seed(deploy.yml 步驟) | 字串 | `root-admin-password*` / `github-deployer` SA | 已設、已接線 |
| `JWT_SECRET`(暫名,未實作) | access token HS256 簽章(ADR-0003) | api runtime | 隨機字串 | 未實作(登入線) |
| `RESEND_API_KEY`(未實作) | 寄交易信(ADR-0010) | api runtime | Resend 提供 | 未實作(登入線) |

## 非機密(普通環境變數:deploy.yml / Cloud Run env / .env)

| 變數 | 用途 | 用於 |
|---|---|---|
| `ROOT_ADMIN_ACCOUNT` / `ROOT_ADMIN_EMAIL` | seed 首個超管的帳號與信箱(ADR-0002);帳號 `root`、信箱寫在 deploy.yml(三環境同一個) | db-migrator seed(deploy.yml 步驟) |
| `GRAPHQL_SANDBOX` | GraphQL Sandbox 開關(雲端預設關) | api runtime |
| `PORT` / `NODE_ENV` | 服務埠 / 執行模式 | api runtime |
| `REGION` / `REGISTRY` | 部署區域 / Artifact Registry | deploy.yml |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | 前端打的 api 位址(**公開**,烘入 bundle) | front/admin build |

## GitHub(非應用執行期,另一套保險箱)

| 名稱 | 用途 | 放哪 |
|---|---|---|
| `GH_PROJECT_TOKEN` | 看板移卡自動化(PAT classic,`repo`+`project` scope) | GitHub repo Secrets |
| WIF 相關 | deploy.yml 免金鑰認證 | GitHub + GCP Workload Identity Federation |

## 相關

- 部署與 Secret Manager 設定流程:`docs/deployment.md`
- token 效期等:ADR-0009;加密:ADR-0007;寄信:ADR-0010
