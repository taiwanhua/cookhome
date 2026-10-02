# 領域文件(Domain Docs)

engineering skills 在探索 codebase 時,應如何使用本 repo 的領域文件。

## 結構

本 repo 是**單一 context**:

```
/
├── CONTEXT.md        ← 詞彙表(唯一一份)
├── docs/adr/         ← 決策、理由、取捨
├── docs/concepts/    ← 底座現況:是什麼、怎麼運作
└── docs/modules/     ← 各模組的畫面、權限表、api 介面
```

沒有 `CONTEXT-MAP.md`,也沒有各 context 自己的 `docs/adr/`。`CONTEXT.md` 與 ADR 由 `/domain-modeling` 在術語或決策真正敲定時新增或改寫。

## 概念導讀(依理解順序)

想理解底座如何運作,照這個順序讀:

1. **`docs/README.md`**:系統地圖、核心概念、閱讀路線
2. **`CONTEXT.md`**:詞彙表;產出內容一律用它的術語
3. **`docs/concepts/`**(現況說明,「是什麼 / 怎麼運作」),依序:
   1. `accounts-and-tenants.md`:兩套帳號、組織樹、角色授予資格、租戶開通與擁有者保護
   2. `authorization.md`:模組 = 頁面、權限、wildcard、解析流程、防越權、角色種類、稽核
   3. `data-layer-and-isolation.md`:三類資料、核心關聯、租戶隔離、管理範圍 vs 可見範圍、資料範圍規則、種子
   4. `storage-and-mail.md`:GCS 上傳與讀取、寄信
   5. `frontend-architecture.md`:admin 分層與所有權、頁面登記與替換、表單設定注入、help、殼、路由與頁籤、共版型、快取(寫前端前必讀)
   6. `form-engine.md`:表單模組:骨架 seed vs 表單畫面管理、版本、分派 / 啟用、提交與修訂、欄位級權限、引擎零件與預設組裝
   7. `workflow-engine.md`:審核流程:流程 / 版本 / 分派 / 綁定、送出時檢查、實例是唯一權威與推進、分流 / 匯合、阻擋與改派、申請中心與讀取授權
4. **需要「為什麼」時才讀 `docs/adr/`**:ADR 只記決策、理由、取捨與影響;每份檔頭指向對應的 concepts

讀完 1–3 即有全貌。各模組的畫面、權限表、api 介面在 `docs/modules/<key>.md`。

正本:`docs/README.md`「閱讀路線」、`docs/concepts/`、`docs/adr/`

### 要動手長一個新模組時

concepts 讀完之後,接著看「規則長成程式之後的樣子」。示範模組分兩條路線:

- **固定欄位模組**(欄位寫在程式裡):
  1. **[示範模組1](../modules/demo.sub.sample-one.md)**:所有選配都打開的完整示範:三層模組樹、隱藏頁、欄位級權限、頁面自有權限、資料範圍目標、公開 / 私有雙路檔案、變更歷程
  2. **[示範模組2](../modules/demo.sample-two.md)**:對照組,拿掉全部選配之後的**最小可行模組**(它「少了什麼」那張表就是選配清單)
- **表單模組**(欄位由使用者在後台設計):**[示範表單](../modules/demo-form.md)**,三個表單模組示範側欄的三種位置(頂層 `demo-form`、群組內 `demo.form`、次群組內 `demo.sub.form`),頁面全用表單引擎的預設組裝

然後:

1. **[module-scaffold](./module-scaffold.md)**:從上面抽出來的藍本:要動哪些檔、照什麼順序、每一步的正本;表單模組走同檔的「表單模組路線」
2. **[權限測試劇本](../testing/permission-scenarios.md)**:24 條劇本,每條標明用哪一頁、哪個帳號、什麼步驟、預期什麼;新模組做完拿它自檢

底座示範頁在 `apps/admin/src/pages/base/demo/`:示範模組1 / 2 各一組頁面(`SampleOne*` / `SampleTwo*`),共用 CRUD 模板在 `apps/admin/src/components/base/crud/`。示範表單沒有專屬頁面,在 `app/base/module-pages.ts` 的 `forms` 宣告,由固定入口 `app/module-pages.tsx` 展開引擎四頁與 options。前端要動手之前先讀 `docs/concepts/frontend-architecture.md` 與 `DemoModuleConfig` 的逐項 JSDoc(前端藍本的規格)。

引用專案新增頁放 `pages/project/`,在 `app/project/module-pages.ts` 登記;客製底座頁另放 `app/project/page-replacements.ts`,保留底座原版。help 同樣分 `md/module-help/base/`、`project/additions/`、`project/replacements/`;表單 options 經 RootProviders 注入,不要新增全域可變登記表。API 功能與資料也有各自的專案來源;新增資料要同時登記刪組織與撤銷開通檢查。接手前讀[功能登記規格](../plans/feature-registration.md),依 STRUCT-12 查固定入口,依 TEST-07 / TEST-08 驗真正組裝路徑。

正本:`apps/admin/src/components/base/crud/demo-module-config.ts`、`apps/admin/src/app/base/module-pages.ts`、`apps/admin/src/app/project/`、`apps/db-migrator/seeds/modules/`、`docs/agents/module-scaffold.md`、`docs/standards/general/structure.md`、`docs/standards/testing/testing.md`

## 使用詞彙表的用語

當產出內容涉及領域概念(issue 標題、重構提案、假設、測試名稱)時,使用 `CONTEXT.md` 定義的術語,不要偏移到詞彙表明確避免的同義詞(每個詞條的 `_Avoid_`)。

如果需要的概念還不在詞彙表裡,這本身就是訊號:要嘛你正在發明專案沒有使用的語言(請重新考慮),要嘛存在真正的缺口(記下來留給 `/domain-modeling`)。

## 標記與 ADR 的衝突

如果產出內容與既有 ADR 矛盾,明確指出,而不是默默地推翻:

> _Contradicts ADR-0004(權限模型)—— 但值得重新討論,因為…_
