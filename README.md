# CookHome 🍳

家常食譜分享網站 — Turborepo monorepo。

## 專案結構

- `apps/api` — NestJS + GraphQL(code-first)+ Mongoose,GraphQL endpoint 於 `http://localhost:5001/graphql`
- `apps/front` — Next.js 前台(SEO:Server Component + ISR)
- `apps/admin` — Vite + React 後台
- `packages/graphql` — GraphQL codegen:型別 + TanStack Query hooks(front/admin 共用)
- `packages/ui`、`packages/logger`、`packages/*-config` — 共用元件與設定

詳細架構與技術決策見 [docs/architecture.md](docs/architecture.md)。

## 快速開始

```bash
docker compose up -d   # 啟動 MongoDB
pnpm install
pnpm dev               # 同時啟動 api / front / admin
```

| 服務        | 網址                          |
| ----------- | ----------------------------- |
| GraphQL API | http://localhost:5001/graphql |
| 前台 front  | http://localhost:3002         |
| 後台 admin  | http://localhost:5173         |

## 常用指令

```bash
pnpm build        # 建置全部(front 的 ISR 頁面需要 api 在線)
pnpm lint         # Lint 全部
pnpm check-types  # 型別檢查全部
pnpm test         # 測試全部
pnpm --filter @repo/graphql generate   # 後端 schema 變更後重新產生前端型別/hooks
```
