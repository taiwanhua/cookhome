# 種子資料以 key 冪等 seed;業務資料只整庫快照;禁止局部合併

跨環境的 id 對不上問題,靠把資料分成兩類解決:設定類(模組、權限、預設角色、欄位管理、scope 目錄)是「種子資料」— 由程式碼中的 seed 腳本定義,以穩定 kebab-case `key` 在各環境冪等 upsert,id 各環境各自生成、無需一致;業務資料(帳號、食譜等)不做跨環境搬移,重現正式環境問題時用整庫 mongodump/restore(id 整包帶走,還原後補跑 seed 與測試帳號腳本)。任何「把部分資料塞進已有資料的環境」的局部合併都禁止 — id 災難只來自這種操作。

種子記錄以 `isSystem` 旗標保護:不可刪、不可改 key,僅 seed 腳本可維護。

## 執行手段:`apps/db-migrator`(migrate-mongo + seed runner)

獨立工具 workspace,不部署、不常駐,只被 CI 與本地指令呼叫。連現有各環境資料庫(URI 走 secret),**不新開資料庫** — 唯一新增物是 migrate-mongo 自建的 `changelog` collection(記錄哪些遷移跑過)。

```
apps/db-migrator/
├─ migrate-mongo-config.js        讀 MONGODB_URI
├─ migrations/                    一次性、版本化(migrate-mongo 管;raw db handle,up/down)
│    檔名:<時間戳>_<類別>_<描述>;類別:schema(索引/結構)| data(回填/轉換)| cleanup(清理)
└─ seeds/                         冪等、每次部署都跑(薄 runner 依 key upsert)
     registry.ts                  收齊所有種子
     orgs.ts / roles.ts / field-categories.ts / scope-catalog.ts
     modules/<key>.ts             每模組一檔:模組樹節點 + permissions + dataScopeTarget
```

**遷移 vs 種子的語意差異**:遷移一次性(跑過記 changelog,變更寫新檔不改舊檔);種子冪等(直接改宣告檔,每次部署重跑等於同步)。

**執行時機與順序**:build 不碰 DB(build once, deploy many)。deploy.yml 部署 api 成功後,對該環境依序跑 `pnpm --filter db-migrator migrate` → `pnpm --filter db-migrator seed`(CI runner 直連)。本地開發同兩條指令。不放在 server 啟動時自動執行(Cloud Run 冷啟要快,且避免多實例併發寫)。
