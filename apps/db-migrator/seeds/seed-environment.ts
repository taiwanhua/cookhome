/**
 * seed 執行環境:示範家族「全環境灌;production 預設 enabled=false」
 * (docs/modules/demo.sub.sample-one.md「Seed 與環境」)需要知道是否為 production。
 * 以 NODE_ENV=production 判定(docs/env-registry.md;deploy.yml 接 seed 步驟時注入)。
 */
export const isProductionSeed = process.env.NODE_ENV === "production";
