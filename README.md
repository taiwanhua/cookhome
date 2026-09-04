# CookHome 🍳

家常食譜分享網站 — Turborepo monorepo,三環境(dev / staging / production)全雲端運行。

## 線上環境

|      | dev(開發測試)                                      | staging(預發布)                                            | **production**                                     |
| ---- | -------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| 前台 | [dev.cookhome.online](https://dev.cookhome.online) | [staging.cookhome.online](https://staging.cookhome.online) | [www.cookhome.online](https://www.cookhome.online) |
| 後台 | erp-dev.cookhome.online                            | erp-staging.cookhome.online                                | erp.cookhome.online                                |
| API  | api-dev.cookhome.online(Sandbox 開)                | api-staging.cookhome.online                                | api.cookhome.online                                |

對應分支:`dev` / `staging` / `main`。資料庫三環境完全隔離(MongoDB Atlas 同 cluster 三個 db)。

## 專案結構

```
apps/
├── api        NestJS + GraphQL(code-first)+ Mongoose(Cloud Run)
├── front      Next.js 前台,SEO:Server Component + ISR(Vercel)
├── admin      Vite + React 後台(Cloud Run + nginx)
└── storybook  設計系統目錄 + Palette Lab(stories 住在 packages/ui)
packages/
├── graphql    GraphQL codegen:型別 + TanStack Query hooks(front/admin 共用)
├── ui         設計系統:兩層 tokens、MUI theme(light/dark)、元件+測試+story 三件套
├── logger     共用 logger(全 repo 唯一可用 console 之處)
├── i18n       多語訊息檔(zh-TW / en)+ locale 定義(front: next-intl、admin: use-intl)
└── config-*   eslint / prettier / typescript / jest 共用設定(單一入口)
```

## 快速開始

```bash
docker compose up -d   # 啟動 MongoDB
pnpm install
pnpm dev               # 同時啟動 api / front / admin / storybook
```

| 本地服務               | 網址                          |
| ---------------------- | ----------------------------- |
| GraphQL API(+ Sandbox) | http://localhost:5001/graphql |
| 前台 front             | http://localhost:3002         |
| 後台 admin             | http://localhost:3001         |
| Storybook              | http://localhost:6006         |

## 常用指令

```bash
pnpm lint / check-types / test / build   # 品質檢查與建置(CI 跑同一套)
pnpm format                              # Prettier(含 import 排序)
pnpm --filter @repo/graphql generate     # 後端 schema 變更後重生前端型別/hooks
pnpm --filter @repo/storybook dev        # 只開設計系統
docker compose --profile full up -d      # 整套容器本地驗證(mongo+api+admin)

# 部署(一律手動觸發,merge 不自動部署;分支↔環境有防呆)
gh workflow run Deploy --ref dev -f environment=dev
gh workflow run Deploy --ref staging -f environment=staging
gh workflow run Deploy --ref main -f environment=production
```

## 開發流程(摘要)

feat 分支一律從 `main` 切出 → PR 合併 `dev` 整合測試 → 要上線的 feat 逐一 PR 合併 `staging` 預發布 → `staging` 合回 `main` = 發布 → feat rebase 最新 main。完整規則見 [CLAUDE.md](CLAUDE.md)。

品質三層約束:ESLint(strictTypeChecked 積木組合)+ TS strict + Prettier(機器強制)/ [docs/standards/](docs/standards/README.md) 編號規範(可審查)/ CLAUDE.md(原則)。

## 文件索引

| 文件                                         | 內容                                                 |
| -------------------------------------------- | ---------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md) | 專案架構、資料流、codegen、技術決策                  |
| [docs/deployment.md](docs/deployment.md)     | 部署操作手冊:環境對照、CI/CD、環境變數管理、維運速查 |
| [docs/standards/](docs/standards/README.md)  | 程式碼規範(GEN/STRUCT/REACT/DATA/GQL/TEST)           |
| [docs/branding.md](docs/branding.md)         | 品牌落點清單(換皮 / 以本 repo 為模板開新專案)        |
| [docs/agents/](docs/agents/)                 | AI 工作流程設定(issue tracker、triage、domain docs)  |
| [docs/tmp/dis.md](docs/tmp/dis.md)           | 決策共識與待辦追蹤                                   |
