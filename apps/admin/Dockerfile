# syntax=docker/dockerfile:1
# 建置方式(從 repo 根目錄):
#   docker build -f apps/admin/Dockerfile -t cookhome-admin \
#     --build-arg VITE_GRAPHQL_ENDPOINT=https://api.cookhome.online/graphql .

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- pruner:turbo prune 裁出 admin 所需的最小 monorepo 子集 ----
FROM base AS pruner
RUN npm install -g turbo@^2.10
COPY . .
RUN turbo prune @repo/admin --docker

# ---- builder ----
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Vite 的環境變數在 build 時烘進靜態產物 —— 不同環境要用不同 build-arg 各建一次
ARG VITE_GRAPHQL_ENDPOINT=http://localhost:5001/graphql
ENV VITE_GRAPHQL_ENDPOINT=$VITE_GRAPHQL_ENDPOINT
RUN pnpm exec turbo run build --filter=@repo/admin

# ---- runner:nginx 服務靜態檔 ----
FROM nginx:1.29-alpine AS runner
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
# Cloud Run 慣例埠 8080
EXPOSE 8080
