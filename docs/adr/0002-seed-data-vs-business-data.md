# 種子資料以 key 冪等 seed;業務資料只整庫快照;禁止局部合併

跨環境的 id 對不上問題,靠把資料分成兩類解決:設定類(模組、權限、預設角色、欄位管理、scope 目錄)是「種子資料」— 由程式碼中的 seed 腳本定義,以穩定 kebab-case `key` 在各環境冪等 upsert,id 各環境各自生成、無需一致;業務資料(帳號、食譜等)不做跨環境搬移,重現正式環境問題時用整庫 mongodump/restore(id 整包帶走,還原後補跑 seed 與測試帳號腳本)。任何「把部分資料塞進已有資料的環境」的局部合併都禁止 — id 災難只來自這種操作。

種子記錄以 `isSystem` 旗標保護:不可刪、不可改 key,僅 seed 腳本可維護。

## 執行手段:`apps/db-migrator`(migrate-mongo + seed runner)

獨立工具 workspace,不部署、不常駐,只被 CI 與本地指令呼叫。連現有各環境資料庫(URI 走 secret),**不新開資料庫** — 唯一新增物是 migrate-mongo 自建的 `changelog` collection(記錄哪些遷移跑過)。

```
apps/db-migrator/
├─ migrate-mongo-config.js        讀 MONGODB_URI
├─ migrations/                    一次性、版本化(migrate-mongo 管;raw db handle,up/down)
│    檔名:<時間戳>_<類別>_<描述>.js
│    時間戳 = 14 位 YYYYMMDDHHmmss(決定執行順序);類別:schema(索引/結構)| data(回填/轉換)| cleanup(清理);
│    描述 = kebab-case。規約由測試全掃強制(程式正本:apps/db-migrator/src/migration-filename.ts)
└─ seeds/                         冪等、每次部署都跑(薄 runner 依 key upsert)
     執行:TypeScript 直跑 — package.json `"seed": "tsx src/seed/run.ts"`(tsx 為 devDependency,零編譯步驟;
     型別檢查由 tsc --noEmit 管)。migrations 維持 .js(migrate-mongo 自己的載入器,不值得為 TS 駭它)
     registry.ts                  收齊所有種子
     orgs.ts / roles.ts / root-admin.ts / field-categories.ts / fields.ts / role-bindings.ts
     modules/<key>.ts             每模組一檔:模組樹節點 + permissions + dataScopeTarget(每模組的 `*` 自動產生)
```

**遷移 vs 種子的語意差異**:遷移一次性(跑過記 changelog,變更寫新檔不改舊檔);種子冪等(直接改宣告檔,每次部署重跑等於同步)。

**種子文件的兩種欄位**(runner 以 key 找到既有那筆後,逐欄比對宣告值):

- **每次都 seed 的欄位**(預設):每次部署都同步回宣告值 — 改宣告檔的 route / name / order 等,下次 seed 即生效(摘要計「更新」);人在資料庫手動改的會被拉回宣告值。
- **初始 seed 值的欄位**:**欄位有值就永不覆寫;只有欄位根本不存在時補寫宣告的初值**,之後由人在系統內管理。補的是「從未被寫過的欄位」,不是「被人改過的值」— 否則後來才加進宣告的初值欄位(如 `modules.icon`),在早就種過的環境永遠落不了地。runner 預設 `initialSeedValueFields = ["enabled"]`,對所有種子表統一生效(模組、角色、欄位類別、欄位選項)— 停用/啟用是給人操作的開關,seed 不得每次翻回去;個別種子表可自行加欄位(`modules` 為 `["enabled", "icon"]`)。
  - 連帶約束:**可變欄位清空時要寫 `null`,不要 `$unset`** — 欄位留著才算「人改過的值」,`$unset` 會讓下次部署把宣告的初值補回來(`setModuleIcon` 清空即寫 `icon: null`)。
- key 是識別,不是欄位:改 key = 新種一筆、舊的變孤兒,要配 cleanup migration。

**seed 不分環境**:三環境跑同一份宣告(無環境變數)。示範家族在 production 要關閉,就在「模組與權限」頁手動停用 — `enabled` 是初始 seed 值欄位,不會被下次部署翻回。

**root 初始帳號**:seed 需建立平台第一個超級管理員帳號 — account/email/密碼自環境變數讀取(`ROOT_ADMIN_ACCOUNT` / `ROOT_ADMIN_EMAIL` / `ROOT_ADMIN_PASSWORD`,雲端存 Secret Manager);**僅在帳號不存在時建立**,已存在則完全不動(不會因部署重設密碼)。

**種子 key 與內容定案**(2026-09-16):

- 根組織 key `root`(name 依 branding.md);種子角色 key `super-admin`、`tenant-admin`,兩者的擁有組織(org_role)= 根組織,隨角色一起種。
- root 初始帳號的顯示名 `name` = account 值,建立後可在系統內改。
- **seed 以原生 mongodb driver 手寫文件形狀**,不 import `apps/api` 的 Mongoose schema:STRUCT-01 禁 app 互相 import,且 BaseRepository 的租戶過濾對沒有操作者上下文的查詢一律拋錯(seed 本來就不該走它)。代價是欄位形狀存在兩處,schema 改了 seed 要跟(索引測試不會抓欄位漂移);若漂移變嚴重,再抽 `@repo/db-schemas` 共用型別(dis.md #27)。
- key 一旦對 production 跑過 seed 就不可再改(改 key = 視為新資料多種一筆)。

**執行時機與順序**:build 不碰 DB(build once, deploy many)。deploy.yml 部署 api 成功後,對該環境依序跑 `pnpm --filter db-migrator migrate` → `pnpm --filter db-migrator seed`(CI runner 直連;filter 不帶 scope 亦可匹配 `@repo/db-migrator`,執行的是該套件 package.json 的同名 script)。本地開發同兩條指令。不放在 server 啟動時自動執行(Cloud Run 冷啟要快,且避免多實例併發寫)。

## 還原(reset):驗收重測用,只給 dev / staging

`apps/db-migrator` 的第三支指令(程式正本 `src/reset/`;用法與 workflow 見 `docs/deployment.md`「資料庫還原(reset)」):

```
pnpm --filter @repo/db-migrator reset --mode=<full|data> --confirm=<資料庫名>
```

- **`full`(整庫重建)**:`dropDatabase` → `migrate` → `seed`,等同全新安裝 —— **連「初始 seed 值的欄位」也回到宣告值**(人在模組頁調過的 `enabled` / `icon` 一併消失)。
- **`data`(只清人建的資料)**:刪掉人建的資料,再跑一次 `seed` 把宣告的內容補回來。**seed 管的文件與其現值留著**,所以調過的 `enabled` / `icon` 不變 —— 這正是上面「初始 seed 值的欄位」機制的效果,**seed 端不必為 reset 做任何事**。

**`data` 模式「seed 管 / 人建」的判準只有一個來源:registry**。每個 documents 種子表都宣告了識別鍵欄位(`keyField`,預設 `key`)與全部 key,所以「識別鍵在宣告清單裡」= seed 管的,留下;不在(含根本沒有那一欄的租戶自建文件)= 人建的,刪掉。**不看 `isSystem`**(租戶副本也可能掛著它),reset 裡也不寫死「哪個 collection 有哪幾筆」。四個例外(正本 `src/reset/reset-plan.ts`):

| 例外                                | 處置                                                   | 為什麼                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `changelog` / `changelog_lock`      | 完全不動                                               | migrate-mongo 的遷移紀錄;`data` 不碰 schema                                                                                       |
| `users`                             | 只留 root 初始帳號(以 `ROOT_ADMIN_ACCOUNT` 識別)       | root 帳號不在 documents 種子表裡(`kind: "root-admin"`,文件上沒有 key 欄位)                                                        |
| `core_relationships`                | 刪「任一端(`firstId` / `secondId`)指向被刪文件」的那些 | 關聯兩端只存 id、各 type 指向不同 collection(ADR-0001)。留下的即 root ↔ 根組織、root ↔ 超級管理員、種子角色的 org_role / 角色綁定 |
| `demo_items_one` / `demo_items_two` | 整表清空,由同一次執行的 `seed` 依宣告補回              | 示範資料是**資料**不是設定;留著等於留下被玩壞的狀態,而 seed 本來就會把宣告的那幾筆種回來                                          |

**不在 registry 的 collection 一律整表清空**(`data_scope_rules`、`audit_logs`、`action_tokens`、`refresh_tokens`、`customers`…):reset 掃的是資料庫**現有**的 collection,不是寫死的清單,所以日後長出來的業務表自動被清掉,不必回頭改 reset。

**安全閥三道,依序檢查,不過即 exit 1 並印原因**(正本 `src/reset/reset-safety.ts`):

1. `--confirm` 必須等於連線字串裡的資料庫名。
2. 目標環境由資料庫名推得(`-dev` / `-staging` 結尾即該環境;**其餘一律視為 production**,含 `prod` 字樣者同)—— **production 永遠拒絕**,沒有任何旗標可以打開。
3. `RESET_ALLOW_ENV`(逗號分隔)必須含目標環境;未設 = 空名單 = 全部拒絕。
